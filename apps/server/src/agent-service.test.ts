import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { AgentService } from "./agent-service.js";
import { loadConfig } from "./config.js";
import { RunCancelledError } from "./errors.js";
import { JsonStore } from "./store.js";
import type { AgentRunner, RunnerRequest, RunnerResult } from "./types.js";
import { WorkspaceManager } from "./workspace.js";

class FakeRunner implements AgentRunner {
  async run(request: RunnerRequest): Promise<RunnerResult> {
    return {
      output: "Completed: " + request.prompt,
      threadId: request.threadId ?? "fake-thread",
      usage: { inputTokens: 12, outputTokens: 5 },
    };
  }
  async cancel(): Promise<boolean> {
    return false;
  }
  async isAvailable(): Promise<boolean> {
    return true;
  }
}

const temporaryDirectories: string[] = [];

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function makeService(runner: AgentRunner = new FakeRunner()): Promise<AgentService> {
  const root = await mkdtemp(path.join(tmpdir(), "launchpad-test-"));
  temporaryDirectories.push(root);
  const config = loadConfig({
    NODE_ENV: "test",
    APP_DATA_DIR: path.join(root, "data"),
    AGENT_WORKSPACE_ROOT: path.join(root, "workspaces"),
    CODEX_HOME: path.join(root, "codex"),
    ARK_API_KEY: "test-key",
    ARK_MODEL: "ep-test",
  });
  const service = new AgentService(
    config,
    new JsonStore(path.join(root, "data", "db.json")),
    new WorkspaceManager(path.join(root, "workspaces")),
    runner,
  );
  await service.initialize();
  return service;
}

describe("Agent lifecycle", () => {
  it("creates, updates, stops, starts and deletes an Agent", async () => {
    const service = await makeService();
    const agent = await service.createAgent({ name: "Builder" });
    expect(service.listAgents()).toHaveLength(1);
    expect((await service.updateAgent(agent.id, { description: "Builds apps" })).description)
      .toBe("Builds apps");
    expect((await service.stopAgent(agent.id)).status).toBe("stopped");
    expect((await service.startAgent(agent.id)).status).toBe("ready");
    await service.deleteAgent(agent.id);
    expect(service.listAgents()).toHaveLength(0);
  });

  it("persists a playground conversation", async () => {
    const service = await makeService();
    const agent = await service.createAgent({ name: "Coder" });
    const { run } = await service.sendMessage(agent.id, "write hello world");
    await expect.poll(() => service.getRun(run.id).status).toBe("completed");
    const messages = service.getMessages(agent.id);
    expect(messages.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(messages[1]?.content).toContain("write hello world");
    expect(service.getAgent(agent.id).codexThreadId).toBe("fake-thread");
  });

  it("atomically accepts only one concurrent run per Agent", async () => {
    let finish!: (result: RunnerResult) => void;
    const pending = new Promise<RunnerResult>((resolve) => {
      finish = resolve;
    });
    const runner: AgentRunner = {
      run: () => pending,
      cancel: async () => false,
      isAvailable: async () => true,
    };
    const service = await makeService(runner);
    const agent = await service.createAgent({ name: "Concurrent" });
    const attempts = await Promise.allSettled([
      service.sendMessage(agent.id, "first"),
      service.sendMessage(agent.id, "second"),
    ]);

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    const rejected = attempts.find((attempt) => attempt.status === "rejected");
    expect(rejected).toMatchObject({ reason: { statusCode: 409 } });
    expect(service.getMessages(agent.id)).toHaveLength(1);

    finish({ output: "done", threadId: "thread", usage: null });
    const accepted = attempts.find((attempt) => attempt.status === "fulfilled");
    if (accepted?.status === "fulfilled") {
      await expect.poll(() => service.getRun(accepted.value.run.id).status).toBe("completed");
    }
  });

  it("does not let start reset a busy Agent and admit a second run", async () => {
    let finish!: (result: RunnerResult) => void;
    const pending = new Promise<RunnerResult>((resolve) => {
      finish = resolve;
    });
    const service = await makeService({
      run: () => pending,
      cancel: async () => false,
      isAvailable: async () => true,
    });
    const agent = await service.createAgent({ name: "Busy" });
    const { run } = await service.sendMessage(agent.id, "first");

    await expect(service.startAgent(agent.id)).rejects.toMatchObject({ statusCode: 409 });
    await expect(service.sendMessage(agent.id, "second")).rejects.toMatchObject({
      statusCode: 409,
    });

    finish({ output: "done", threadId: "thread", usage: null });
    await expect.poll(() => service.getRun(run.id).status).toBe("completed");
  });

  it("cancels one active run without stopping the Agent", async () => {
    let cancel!: () => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const pending = new Promise<RunnerResult>((_resolve, reject) => {
      cancel = () => reject(new RunCancelledError());
    });
    const service = await makeService({
      run: () => {
        markStarted();
        return pending;
      },
      cancel: async () => {
        cancel();
        return true;
      },
      isAvailable: async () => true,
    });
    const agent = await service.createAgent({ name: "Cancellable" });
    const { run } = await service.sendMessage(agent.id, "wait");
    await started;

    const cancelled = await service.cancelRun(run.id);

    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.output).toBeNull();
    expect(cancelled.trace.filter((event) => event.kind === "control").map((event) => event.title))
      .toEqual(["Kill Switch requested", "Runtime terminated"]);
    expect(service.getMessages(agent.id).map((message) => message.role)).toEqual(["user"]);
    expect(service.getAgent(agent.id).status).toBe("ready");
  });

  it("cancels active Runs during graceful service shutdown", async () => {
    let cancel!: () => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const pending = new Promise<RunnerResult>((_resolve, reject) => {
      cancel = () => reject(new RunCancelledError());
    });
    const service = await makeService({
      run: () => {
        markStarted();
        return pending;
      },
      cancel: async () => {
        cancel();
        return true;
      },
      isAvailable: async () => true,
    });
    const agent = await service.createAgent({ name: "Shutdown safe" });
    const { run } = await service.sendMessage(agent.id, "wait");
    await started;

    await service.close();

    expect(service.getRun(run.id).status).toBe("cancelled");
    expect(service.getAgent(agent.id).status).toBe("ready");
  });

  it("promotes only accepted coordinated workspace changes", async () => {
    const service = await makeService({
      run: async (request) => {
        await writeFile(path.join(request.workspacePath, "transaction-proof.txt"), "accepted", "utf8");
        return { output: "Created transaction proof", threadId: null, usage: null };
      },
      cancel: async () => false,
      isAvailable: async () => true,
    });
    const lead = await service.createAgent({ name: "Lead" });
    const worker = await service.createAgent({ name: "Worker", kind: "worker" });
    const { run } = await service.sendCoordinatedMessage(worker.id, "make proof", lead.id);
    await expect.poll(() => service.getRun(run.id).status).toBe("completed");

    await expect(readFile(path.join(lead.workspacePath, "transaction-proof.txt"), "utf8"))
      .rejects.toMatchObject({ code: "ENOENT" });
    await service.commitRunWorkspace(run.id);
    await expect(readFile(path.join(lead.workspacePath, "transaction-proof.txt"), "utf8"))
      .resolves.toBe("accepted");
    expect(service.getRun(run.id).workspaceTransaction?.status).toBe("committed");
  });

  it("discards an unaccepted coordinated workspace", async () => {
    const service = await makeService({
      run: async (request) => {
        await writeFile(path.join(request.workspacePath, "partial.txt"), "unfinished", "utf8");
        return { output: "Unaccepted work", threadId: null, usage: null };
      },
      cancel: async () => false,
      isAvailable: async () => true,
    });
    const lead = await service.createAgent({ name: "Lead" });
    const worker = await service.createAgent({ name: "Worker", kind: "worker" });
    const { run } = await service.sendCoordinatedMessage(worker.id, "make partial", lead.id);
    await expect.poll(() => service.getRun(run.id).status).toBe("completed");
    await service.discardRunWorkspace(run.id);

    await expect(readFile(path.join(lead.workspacePath, "partial.txt"), "utf8"))
      .rejects.toMatchObject({ code: "ENOENT" });
    expect(service.getRun(run.id).workspaceTransaction?.status).toBe("discarded");
  });
});
