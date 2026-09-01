import { randomUUID } from "node:crypto";
import type { AppConfig } from "./config.js";
import { isArkConfigured, isModelConfigured } from "./config.js";
import { HttpError, RunCancelledError } from "./errors.js";
import { JsonStore } from "./store.js";
import type {
  Agent,
  AgentRun,
  AgentRunner,
  CreateAgentInput,
  Message,
  UpdateAgentInput,
} from "./types.js";
import { WorkspaceManager } from "./workspace.js";
import { parseTaskPlan, taskPlanningPrompt, type TaskPlan, type TaskWorkerPlan } from "./task-planner.js";
import { linkRunTraceEvent, RUN_TRACE_GENESIS } from "./run-trace-chain.js";

const now = () => new Date().toISOString();

export class AgentService {
  private readonly activeExecutions = new Map<string, Promise<void>>();
  private readonly cancellationRequests = new Set<string>();

  constructor(
    private readonly config: AppConfig,
    private readonly store: JsonStore,
    private readonly workspaces: WorkspaceManager,
    private readonly runner: AgentRunner,
  ) {}

  async initialize(): Promise<void> {
    await this.store.initialize();
    await this.workspaces.initialize();
    const openTransactions = this.store
      .snapshot()
      .runs.filter((run) => run.workspaceTransaction?.status === "open")
      .map((run) => run.id);
    await Promise.allSettled(
      openTransactions.map((runId) => this.workspaces.discardTransaction(runId)),
    );
    await this.store.mutate((database) => {
      for (const run of database.runs) {
        if (!Array.isArray(run.trace)) run.trace = [];
        if (run.workspaceTransaction?.status === "open") {
          run.workspaceTransaction.status = "discarded";
        }
        if (run.status === "queued" || run.status === "running") {
          run.status = "cancelled";
          run.error = "Server restarted while this run was active";
          run.completedAt = now();
        }
      }
      for (const agent of database.agents) {
        if (agent.status === "busy") {
          agent.status = "ready";
          agent.updatedAt = now();
        }
      }
    });
  }

  listAgents(): Agent[] {
    return this.store
      .snapshot()
      .agents.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  getAgent(id: string): Agent {
    const agent = this.store.snapshot().agents.find((item) => item.id === id);
    if (!agent) {
      throw new HttpError(404, "Agent not found");
    }
    return agent;
  }

  async createAgent(input: CreateAgentInput): Promise<Agent> {
    const timestamp = now();
    const id = randomUUID();
    const agent: Agent = {
      id,
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      instructions: input.instructions?.trim() ?? "",
      status: "ready",
      workspacePath: this.workspaces.workspacePath(id),
      codexThreadId: null,
      lastError: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      kind: input.kind ?? "lead",
      parentAgentId: input.parentAgentId ?? null,
      taskPlanId: input.taskPlanId ?? null,
      role: input.role ?? null,
    };
    await this.workspaces.create(agent);
    await this.store.mutate((database) => database.agents.push(agent));
    return agent;
  }

  async createTaskWorker(
    parentAgentId: string,
    taskPlanId: string,
    worker: TaskWorkerPlan,
  ): Promise<Agent> {
    this.getAgent(parentAgentId);
    return await this.createAgent({
      name: worker.name,
      description: worker.purpose,
      instructions: [
        `You are the ${worker.role} worker for one coordinated task.`,
        worker.purpose,
        worker.skills.length ? `Relevant capabilities: ${worker.skills.join(", ")}.` : "",
        "Complete only work assigned by the Launchpad coordinator and leave auditable evidence.",
      ].filter(Boolean).join("\n\n"),
      kind: "worker",
      parentAgentId,
      taskPlanId,
      role: worker.role,
    });
  }

  async planTask(agentId: string, request: string): Promise<{ plan: TaskPlan; run: AgentRun }> {
    const agent = this.getAgent(agentId);
    if ((agent.kind ?? "lead") !== "lead") {
      throw new HttpError(400, "Only a lead Agent can plan a new task");
    }
    const { run } = await this.sendCoordinatedMessage(
      agentId,
      taskPlanningPrompt(request),
      agentId,
    );
    const terminal = await this.waitForRun(run.id, 600_000);
    if (terminal.status !== "completed" || !terminal.output) {
      await this.discardRunWorkspace(run.id);
      throw new HttpError(502, terminal.error ?? "The planning Agent did not complete");
    }
    try {
      return { plan: parseTaskPlan(request, terminal.output), run: terminal };
    } catch (error) {
      throw new HttpError(
        502,
        `The planning Agent returned an invalid coordination plan: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      await this.discardRunWorkspace(run.id);
    }
  }

  async waitForRun(runId: string, timeoutMs: number): Promise<AgentRun> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const run = this.getRun(runId);
      if (!["queued", "running"].includes(run.status)) return run;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await this.cancelRun(runId, "timeout");
    throw new HttpError(504, "The Agent Run exceeded its planning deadline");
  }

  async updateAgent(id: string, input: UpdateAgentInput): Promise<Agent> {
    const current = this.getAgent(id);
    if (current.status === "busy") {
      throw new HttpError(409, "Stop the active run before editing this Agent");
    }
    const updated = await this.store.mutate((database) => {
      const agent = database.agents.find((item) => item.id === id);
      if (!agent) {
        throw new HttpError(404, "Agent not found");
      }
      if (agent.status === "busy") {
        throw new HttpError(409, "Stop the active run before editing this Agent");
      }
      if (input.name !== undefined) agent.name = input.name.trim();
      if (input.description !== undefined) agent.description = input.description.trim();
      if (input.instructions !== undefined) agent.instructions = input.instructions.trim();
      agent.lastError = null;
      agent.updatedAt = now();
      return structuredClone(agent);
    });
    await this.workspaces.writeInstructions(updated);
    return updated;
  }

  async deleteAgent(id: string): Promise<{ archivedWorkspace: string }> {
    const agent = this.getAgent(id);
    await this.cancelExecution(id);
    const archivedWorkspace = await this.workspaces.archive(agent);
    await this.store.mutate((database) => {
      database.agents = database.agents.filter((item) => item.id !== id);
      database.messages = database.messages.filter((item) => item.agentId !== id);
      database.runs = database.runs.filter((item) => item.agentId !== id);
    });
    return { archivedWorkspace };
  }

  async startAgent(id: string): Promise<Agent> {
    return this.setStatus(id, "ready");
  }

  async stopAgent(id: string): Promise<Agent> {
    this.getAgent(id);
    const activeRun = this.getRuns(id).find((run) => ["queued", "running"].includes(run.status));
    if (activeRun) await this.cancelRun(activeRun.id);
    else await this.cancelExecution(id);
    return this.setStatus(id, "stopped");
  }

  getMessages(agentId: string): Message[] {
    this.getAgent(agentId);
    return this.store
      .snapshot()
      .messages.filter((message) => message.agentId === agentId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  getRun(runId: string): AgentRun {
    const run = this.store.snapshot().runs.find((item) => item.id === runId);
    if (!run) {
      throw new HttpError(404, "Run not found");
    }
    return run;
  }

  getRunWorkspacePath(runId: string): string {
    const run = this.getRun(runId);
    if (!run.workspaceTransaction || run.workspaceTransaction.status !== "open") {
      throw new Error("Run has no open workspace transaction");
    }
    return this.workspaces.transactionPath(runId);
  }

  getRuns(agentId: string): AgentRun[] {
    this.getAgent(agentId);
    return this.store
      .snapshot()
      .runs.filter((run) => run.agentId === agentId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async cancelRun(
    runId: string,
    reason: "operator" | "timeout" | "session-stop" = "operator",
  ): Promise<AgentRun> {
    const run = this.getRun(runId);
    if (!["queued", "running"].includes(run.status)) return run;
    const controlCopy = reason === "timeout"
      ? {
          id: "runtime-timeout-requested",
          title: "Runtime deadline exceeded",
          summary: "Coordinator requested termination after the checkpoint deadline",
          detail: "Unfinished output and unaccepted file changes remain ineligible.",
        }
      : reason === "session-stop"
        ? {
            id: "job-stop-requested",
            title: "Job stop reached the Runtime",
            summary: "Coordinator requested termination because the durable job was stopped",
            detail: "Unfinished output will not be accepted.",
          }
        : {
            id: "kill-switch-requested",
            title: "Kill Switch requested",
            summary: "Operator requested termination of the active Codex Runtime",
            detail: "Unfinished output will not be accepted.",
          };
    await this.appendControlTrace(runId, {
      id: controlCopy.id,
      phase: "started",
      title: controlCopy.title,
      summary: controlCopy.summary,
      detail: controlCopy.detail,
    });
    try {
      await this.cancelExecution(run.agentId);
    } catch (error) {
      await this.appendControlTrace(runId, {
        id: "kill-switch-failed",
        phase: "failed",
        title: "Kill Switch failed",
        summary: "Runtime termination could not be confirmed",
        detail: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
    const terminal = this.getRun(runId);
    await this.appendControlTrace(runId, {
      id: `${controlCopy.id}:finished`,
      phase: terminal.status === "cancelled" ? "completed" : "failed",
      title:
        terminal.status === "cancelled"
          ? reason === "timeout"
            ? "Timed-out Runtime terminated"
            : "Runtime terminated"
          : "Runtime already finished",
      summary:
        terminal.status === "cancelled"
          ? "Active Codex process stopped · unfinished answer rejected"
          : `Kill Switch arrived after the Run reached ${terminal.status}`,
      detail: `Run ${runId} · final status ${terminal.status}`,
    });
    return this.getRun(runId);
  }

  async commitRunWorkspace(runId: string): Promise<void> {
    const run = this.getRun(runId);
    const transaction = run.workspaceTransaction;
    if (!transaction || transaction.status !== "open") {
      if (transaction?.status === "committed") return;
      throw new Error("Run has no open workspace transaction");
    }
    if (run.status !== "completed") {
      throw new Error(`Cannot commit workspace for a ${run.status} run`);
    }
    const workspace = this.getAgent(transaction.workspaceAgentId);
    await this.workspaces.commitTransaction(runId, workspace.workspacePath);
    await this.store.mutate((database) => {
      const storedRun = database.runs.find((item) => item.id === runId);
      if (storedRun?.workspaceTransaction) {
        storedRun.workspaceTransaction.status = "committed";
      }
    });
  }

  async discardRunWorkspace(runId: string): Promise<void> {
    const run = this.getRun(runId);
    const transaction = run.workspaceTransaction;
    if (!transaction || transaction.status !== "open") return;
    await this.workspaces.discardTransaction(runId);
    await this.store.mutate((database) => {
      const storedRun = database.runs.find((item) => item.id === runId);
      if (storedRun?.workspaceTransaction) {
        storedRun.workspaceTransaction.status = "discarded";
      }
    });
  }

  async close(): Promise<void> {
    await Promise.allSettled(
      [...this.activeExecutions.keys()].map((agentId) => this.cancelExecution(agentId)),
    );
  }

  async sendMessage(
    agentId: string,
    prompt: string,
  ): Promise<{ run: AgentRun; message: Message }> {
    if (!isModelConfigured(this.config)) {
      throw new HttpError(
        503,
        "A model is not configured. Set MODEL_API_KEY and MODEL_ID, or ARK_API_KEY and ARK_MODEL, then restart.",
      );
    }
    const timestamp = now();
    const runId = randomUUID();
    const run: AgentRun = {
      id: runId,
      agentId,
      status: "queued",
      prompt,
      output: null,
      error: null,
      usage: null,
      trace: [],
      startedAt: null,
      completedAt: null,
      createdAt: timestamp,
    };
    const message: Message = {
      id: randomUUID(),
      agentId,
      runId,
      role: "user",
      content: prompt,
      createdAt: timestamp,
    };
    const agentAtStart = await this.store.mutate((database) => {
      const storedAgent = database.agents.find((item) => item.id === agentId);
      if (!storedAgent) {
        throw new HttpError(404, "Agent not found");
      }
      if (storedAgent.status === "stopped") {
        throw new HttpError(409, "Start the Agent before sending a message");
      }
      if (storedAgent.status === "busy") {
        throw new HttpError(409, "This Agent is already running");
      }
      database.runs.push(run);
      database.messages.push(message);
      const snapshot = structuredClone(storedAgent);
      storedAgent.status = "busy";
      storedAgent.lastError = null;
      storedAgent.updatedAt = timestamp;
      return snapshot;
    });
    const execution = this.executeRun(agentAtStart, run);
    this.activeExecutions.set(agentId, execution);
    void execution
      .finally(() => {
        if (this.activeExecutions.get(agentId) === execution) {
          this.activeExecutions.delete(agentId);
        }
      })
      .catch(() => undefined);
    return { run, message };
  }

  async sendCoordinatedMessage(
    agentId: string,
    prompt: string,
    workspaceAgentId: string,
  ): Promise<{ run: AgentRun }> {
    if (!isModelConfigured(this.config)) {
      throw new HttpError(
        503,
        "A model is not configured. Set MODEL_API_KEY and MODEL_ID, or ARK_API_KEY and ARK_MODEL, then restart.",
      );
    }
    const timestamp = now();
    const run: AgentRun = {
      id: randomUUID(),
      agentId,
      status: "queued",
      prompt,
      output: null,
      error: null,
      usage: null,
      trace: [],
      startedAt: null,
      completedAt: null,
      createdAt: timestamp,
      workspaceTransaction: {
        workspaceAgentId,
        status: "open",
      },
    };
    const workspaceAgent = this.getAgent(workspaceAgentId);
    const transactionWorkspace = await this.workspaces.beginTransaction(
      run.id,
      workspaceAgent.workspacePath,
    );
    let agentAtStart: Agent;
    try {
      agentAtStart = await this.store.mutate((database) => {
        const storedAgent = database.agents.find((item) => item.id === agentId);
        if (!storedAgent) throw new HttpError(404, "Agent not found");
        if (storedAgent.status === "stopped") {
          throw new HttpError(409, "Start the Agent before assigning coordinated work");
        }
        if (storedAgent.status === "busy") {
          throw new HttpError(409, "This Agent is already running");
        }
        database.runs.push(run);
        storedAgent.status = "busy";
        storedAgent.lastError = null;
        storedAgent.updatedAt = timestamp;
        return {
          ...structuredClone(storedAgent),
          workspacePath: transactionWorkspace,
          codexThreadId: null,
        };
      });
    } catch (error) {
      await this.workspaces.discardTransaction(run.id);
      throw error;
    }
    const execution = this.executeRun(agentAtStart, run, {
      recordAssistantMessage: false,
      persistThread: false,
    });
    this.activeExecutions.set(agentId, execution);
    void execution
      .finally(() => {
        if (this.activeExecutions.get(agentId) === execution) {
          this.activeExecutions.delete(agentId);
        }
      })
      .catch(() => undefined);
    return { run };
  }

  async systemInfo(): Promise<Record<string, unknown>> {
    return {
      arkConfigured: isArkConfigured(this.config),
      arkBaseUrl: this.config.arkBaseUrl,
      arkModel: this.config.arkModel || null,
      modelConfigured: isModelConfigured(this.config),
      modelBaseUrl: this.config.modelBaseUrl,
      modelId: this.config.modelId || null,
      modelProviderName: this.config.modelProviderName,
      codexAuthMode: this.config.codexAuthMode,
      codexAvailable: await this.runner.isAvailable(),
      codexSandboxMode: this.config.codexSandboxMode,
      runtimeProvider: this.config.runtimeProvider,
      containerEngine:
        this.config.runtimeProvider === "container"
          ? this.config.containerEngine
          : null,
      runtime:
        this.config.runtimeProvider === "container"
          ? "Codex CLI in " + this.config.containerEngine + " Runtime"
          : "Codex CLI in a local host process",
    };
  }

  private async executeRun(
    agentAtStart: Agent,
    run: AgentRun,
    options: { recordAssistantMessage?: boolean; persistThread?: boolean } = {},
  ): Promise<void> {
    await this.store.mutate((database) => {
      const storedRun = database.runs.find((item) => item.id === run.id);
      if (storedRun) {
        storedRun.status = "running";
        storedRun.startedAt = now();
      }
    });
    try {
      if (this.cancellationRequests.has(agentAtStart.id)) {
        throw new RunCancelledError();
      }
      const result = await this.runner.run({
        runId: run.id,
        agentId: agentAtStart.id,
        workspacePath: agentAtStart.workspacePath,
        prompt: run.prompt,
        threadId: agentAtStart.codexThreadId,
        onTrace: (event) => {
          void this.store
            .mutate((database) => {
              const storedRun = database.runs.find((item) => item.id === run.id);
              if (!storedRun) return;
              if (!Array.isArray(storedRun.trace)) storedRun.trace = [];
              if (storedRun.trace.some((trace) => trace.id === event.id)) return;
              const previousHash = storedRun.trace.at(-1)?.eventHash ?? RUN_TRACE_GENESIS;
              storedRun.trace.push(linkRunTraceEvent(event, previousHash));
            })
            .catch(() => undefined);
        },
      });
      const completedAt = now();
      await this.store.mutate((database) => {
        const storedRun = database.runs.find((item) => item.id === run.id);
        const agent = database.agents.find((item) => item.id === agentAtStart.id);
        if (!storedRun || !agent) return;
        storedRun.status = "completed";
        storedRun.output = result.output;
        storedRun.usage = result.usage;
        storedRun.completedAt = completedAt;
        if (options.recordAssistantMessage !== false) {
          database.messages.push({
            id: randomUUID(),
            agentId: agent.id,
            runId: run.id,
            role: "assistant",
            content: result.output,
            createdAt: completedAt,
          });
        }
        agent.status = "ready";
        if (options.persistThread !== false) agent.codexThreadId = result.threadId;
        agent.lastError = null;
        agent.updatedAt = completedAt;
      });
    } catch (error) {
      const completedAt = now();
      const cancelled = error instanceof RunCancelledError;
      const message = error instanceof Error ? error.message : String(error);
      await this.store.mutate((database) => {
        const storedRun = database.runs.find((item) => item.id === run.id);
        const agent = database.agents.find((item) => item.id === agentAtStart.id);
        if (storedRun) {
          storedRun.status = cancelled ? "cancelled" : "failed";
          storedRun.error = message;
          storedRun.completedAt = completedAt;
        }
        if (agent) {
          if (agent.status !== "stopped") {
            agent.status = cancelled ? "ready" : "error";
          }
          agent.lastError = cancelled ? null : message;
          agent.updatedAt = completedAt;
        }
      });
    }
  }

  private async setStatus(id: string, status: Agent["status"]): Promise<Agent> {
    return this.store.mutate((database) => {
      const agent = database.agents.find((item) => item.id === id);
      if (!agent) {
        throw new HttpError(404, "Agent not found");
      }
      if (status === "ready" && agent.status === "busy") {
        throw new HttpError(409, "Stop the active run before starting this Agent");
      }
      agent.status = status;
      if (status === "ready") agent.lastError = null;
      agent.updatedAt = now();
      return structuredClone(agent);
    });
  }

  private async appendControlTrace(
    runId: string,
    event: {
      id: string;
      phase: "started" | "completed" | "failed";
      title: string;
      summary: string;
      detail: string;
    },
  ): Promise<void> {
    await this.store.mutate((database) => {
      const run = database.runs.find((item) => item.id === runId);
      if (!run) return;
      if (!Array.isArray(run.trace)) run.trace = [];
      const timestamp = now();
      const trace = {
        ...event,
        id: `${event.id}:${event.phase}`,
        kind: "control" as const,
        sequence: Math.max(0, ...run.trace.map((item) => item.sequence)) + 1,
        at: timestamp,
        updatedAt: timestamp,
        exitCode: null,
      };
      if (run.trace.some((item) => item.id === trace.id)) return;
      const previousHash = run.trace.at(-1)?.eventHash ?? RUN_TRACE_GENESIS;
      run.trace.push(linkRunTraceEvent(trace, previousHash));
    });
  }

  private async cancelExecution(agentId: string): Promise<void> {
    this.cancellationRequests.add(agentId);
    try {
      await this.runner.cancel(agentId);
      const execution = this.activeExecutions.get(agentId);
      if (execution) {
        await execution;
      }
    } finally {
      this.cancellationRequests.delete(agentId);
    }
  }
}
