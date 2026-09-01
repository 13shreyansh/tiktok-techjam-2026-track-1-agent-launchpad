import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import { createHash, timingSafeEqual } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { AppConfig } from "./config.js";
import { HttpError } from "./errors.js";
import { verifyRelayEventChain } from "./event-chain.js";
import { verifyRunTraceChain } from "./run-trace-chain.js";
import type { AgentService } from "./agent-service.js";
import type { RelayCoordinator } from "./relay-coordinator.js";

const agentIdParams = z.object({ id: z.string().uuid() });
const runIdParams = z.object({ id: z.string().uuid() });
const createAgentBody = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().max(500).optional(),
  instructions: z.string().max(10_000).optional(),
});
const updateAgentBody = createAgentBody.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required",
);
const messageBody = z.object({
  content: z.string().trim().min(1).max(50_000),
});
const coordinatedTaskBody = z.object({
  content: z.string().trim().min(1).max(50_000),
});
const previewPathParams = z.object({
  id: z.string().uuid(),
  "*": z.string().max(500).optional(),
});
const relaySessionIdParams = z.object({ id: z.string().uuid() });
const attestationArtifactParams = z.object({
  id: z.string().uuid(),
  file: z.enum(["mobile-375.png", "desktop-1440.png"]),
});
const createRelaySessionBody = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  participantAgentIds: z.array(z.string().uuid()).min(1).max(20),
  workspaceAgentId: z.string().uuid().optional(),
  taskType: z
    .enum(["countdown", "ordered-sequence", "team-task", "checkpoint-workflow"])
    .optional(),
  initialValue: z.number().int().min(1).max(100).optional(),
  steps: z
    .array(z.string().trim().min(1).max(800))
    .min(1)
    .max(20)
    .optional(),
  taskBrief: z.string().trim().min(10).max(4_000).optional(),
  successCriteria: z
    .array(z.string().trim().min(3).max(300))
    .min(1)
    .max(8)
    .optional(),
  maxRevisions: z.number().int().min(0).max(3).optional(),
  maxAttempts: z.number().int().min(1).max(20).optional(),
  turnTimeoutMs: z.number().int().min(250).max(600_000).optional(),
  faultMode: z.enum(["none", "fail-first-claim"]).optional(),
});

export async function createApp(
  config: AppConfig,
  service: AgentService,
  relay: RelayCoordinator | null = null,
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: ["req.headers.authorization", "req.headers.cookie"],
    },
    bodyLimit: 1_048_576,
  });
  const activeSseResponses = new Set<ServerResponse>();
  const source = {
    revision: config.sourceRevision,
    dirty: config.sourceDirty,
    buildSha256: config.buildSha256,
    runtimeVersion: config.runtimeVersion,
  };
  let appClosing = false;

  app.addHook("preClose", async () => {
    appClosing = true;
    for (const response of activeSseResponses) {
      if (!response.destroyed) response.end();
    }
    activeSseResponses.clear();
  });

  await app.register(cors, {
    origin:
      config.nodeEnv === "development"
        ? ["http://localhost:5173", "http://127.0.0.1:5173"]
        : false,
  });

  app.addHook("onRequest", async (request, reply) => {
    if (
      !config.authToken ||
      !request.url.startsWith("/api/") ||
      request.url === "/api/health" ||
      request.url === "/api/auth"
    ) {
      return;
    }
    const header = request.headers.authorization ?? "";
    const candidate = header.startsWith("Bearer ") ? header.slice(7) : "";
    const expectedBuffer = Buffer.from(config.authToken);
    const candidateBuffer = Buffer.from(candidate);
    const valid =
      candidateBuffer.length === expectedBuffer.length &&
      timingSafeEqual(candidateBuffer, expectedBuffer);
    if (!valid) {
      return reply.code(401).send({ error: "Authentication required" });
    }
  });

  app.get("/api/health", async () => ({
    ok: true,
    service: "volc-agent-launchpad",
  }));

  app.get("/api/auth", async () => ({ required: config.authToken.length > 0 }));

  app.get("/api/system", async () => ({
    ...(await service.systemInfo()),
    proofGateEnabled: Boolean(config.playwrightModulePath),
    source,
  }));

  app.get("/api/relay/sessions", async () => ({
    enabled: relay !== null,
    sessions: relay ? await relay.listSessions() : [],
  }));

  app.get("/api/relay/sessions/stream", async (request, reply) => {
    reply.hijack();
    activeSseResponses.add(reply.raw);
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    let closed = false;
    let lastSnapshot = "";
    let pending = Promise.resolve();
    const close = () => {
      closed = true;
      activeSseResponses.delete(reply.raw);
    };
    request.raw.once("close", close);

    const pushSnapshot = async () => {
      if (closed || reply.raw.destroyed) return;
      const snapshot = JSON.stringify({
        enabled: relay !== null,
        sessions: relay ? await relay.listSessions() : [],
      });
      if (snapshot === lastSnapshot) return;
      lastSnapshot = snapshot;
      reply.raw.write(`event: sessions\ndata: ${snapshot}\n\n`);
    };
    const queueSnapshot = () => {
      pending = pending.then(pushSnapshot).catch((error) => {
        if (appClosing || closed || reply.raw.destroyed) return;
        request.log.error(error);
        reply.raw.end();
      });
    };

    const unsubscribe = relay?.subscribeChanges(queueSnapshot) ?? (() => undefined);
    const resync = setInterval(queueSnapshot, 5_000);
    resync.unref();
    const heartbeat = setInterval(() => {
      if (!closed && !reply.raw.destroyed) reply.raw.write(": keep-alive\n\n");
    }, 15_000);
    heartbeat.unref();

    queueSnapshot();
    await new Promise<void>((resolve) => request.raw.once("close", resolve));
    unsubscribe();
    clearInterval(resync);
    clearInterval(heartbeat);
    await pending;
  });

  app.post("/api/relay/sessions", async (request, reply) => {
    if (!relay) throw new HttpError(503, "Durable Agent Relay is not enabled");
    const body = createRelaySessionBody.parse(request.body);
    const session = await relay.createSession(body);
    return reply.code(201).send({ session });
  });

  app.post("/api/relay/sessions/:id/cancel", async (request) => {
    if (!relay) throw new HttpError(503, "Durable Agent Relay is not enabled");
    const { id } = relaySessionIdParams.parse(request.params);
    return { session: await relay.cancelSession(id) };
  });

  app.post("/api/relay/sessions/:id/interrupt", async (request) => {
    if (!relay) throw new HttpError(503, "Durable Agent Relay is not enabled");
    const { id } = relaySessionIdParams.parse(request.params);
    return await relay.interruptActiveRun(id);
  });

  app.get("/api/relay/sessions/:id/evidence", async (request) => {
    if (!relay) throw new HttpError(503, "Durable Agent Relay is not enabled");
    const { id } = relaySessionIdParams.parse(request.params);
    const session = await relay.getSession(id);
    const acceptedValues = session.acceptedTurns.map((turn) => turn.value);
    const acceptedOutputs = session.acceptedTurns.map((turn) => turn.output);
    const expectedValues = Array.from({ length: session.initialValue }, (_, index) =>
      session.taskType === "checkpoint-workflow" ? index + 1 : session.initialValue - index,
    );
    const taskType = session.taskType ?? "countdown";
    const expectedOutputs =
      taskType === "ordered-sequence" || taskType === "checkpoint-workflow"
        ? (session.steps ?? [])
        : expectedValues.map(String);
    const exactSequence =
      (taskType === "countdown" || taskType === "ordered-sequence") &&
      session.status === "completed" &&
      acceptedOutputs.length === expectedOutputs.length &&
      acceptedOutputs.every((output, index) => output === expectedOutputs[index]);
    const runReceiptIds = [...new Set([
      ...session.acceptedTurns.map((turn) => turn.runId),
      ...session.events
        .filter((event) => event.type === "run.started" && event.runId)
        .map((event) => event.runId as string),
    ])];
    const runReceipts = runReceiptIds.map((runId) => {
      const acceptedTurn = session.acceptedTurns.find((turn) => turn.runId === runId);
      const startedEvent = session.events.find(
        (event) => event.type === "run.started" && event.runId === runId,
      );
      try {
        const run = service.getRun(runId);
        return {
          id: run.id,
          agentId: run.agentId,
          status: run.status,
          usage: run.usage,
          startedAt: run.startedAt,
          completedAt: run.completedAt,
          error: run.error,
          trace: run.trace,
          traceChain: verifyRunTraceChain(run.trace),
        };
      } catch {
        return {
          id: runId,
          agentId: acceptedTurn?.agentId ?? startedEvent?.agentId ?? null,
          status: "receipt-unavailable",
          usage: null,
          startedAt: startedEvent?.at ?? null,
          completedAt: acceptedTurn?.completedAt ?? null,
          error: "The Agent Run receipt is no longer present in local runtime storage",
          trace: null,
        };
      }
    });
    const artifactTurn = [...session.acceptedTurns]
      .reverse()
      .find((turn) => turn.stage === "draft" || turn.stage === "revise");
    const reviewTurn = [...session.acceptedTurns]
      .reverse()
      .find((turn) => turn.stage === "review");
    const distinctReviewer = Boolean(
      artifactTurn && reviewTurn && artifactTurn.agentId !== reviewTurn.agentId,
    );
    const sessionSource = session.sourceAttestation ?? {
      revision: "unknown",
      dirty: null,
      buildSha256: "unknown",
      runtimeVersion: "unknown",
    };
    const flightRecorder = verifyRelayEventChain(session.events);
    const evidence = {
      schemaVersion: 10,
      generatedAt: new Date().toISOString(),
      source: sessionSource,
      participantAgents: session.participantAgentIds.map((agentId) => {
        try {
          const agent = service.getAgent(agentId);
          return { id: agent.id, name: agent.name };
        } catch {
          return { id: agentId, name: "Deleted Agent" };
        }
      }),
      semantics: {
        transport: "at-least-once",
        acceptance: "application-level idempotent",
        physicalExecutionExactlyOnce: false,
        qualityReview:
          taskType === "team-task"
            ? "independent-model-review-against-user-criteria"
            : "not-part-of-this-protocol",
      },
      proof: {
        status: session.status,
        taskType,
        acceptedValues: taskType === "team-task" ? null : acceptedValues,
        acceptedOutputs: taskType === "team-task" ? null : acceptedOutputs,
        expectedOutputs: taskType === "team-task" ? null : expectedOutputs,
        exactSequence:
          taskType === "countdown" || taskType === "ordered-sequence" ? exactSequence : null,
        exactCountdown:
          taskType === "countdown"
            ? exactSequence &&
              acceptedValues.length === expectedValues.length &&
              acceptedValues.every((value, index) => value === expectedValues[index])
            : null,
        uniqueAcceptedTurnIds:
          new Set(session.acceptedTurns.map((turn) => turn.turnId)).size ===
          session.acceptedTurns.length,
        retries: session.events.filter((event) => event.type === "turn.retrying").length,
        duplicatesSuppressed: session.events.filter(
          (event) => event.type === "turn.duplicate-suppressed",
        ).length,
        recoveryDrill: session.faultMode === "fail-first-claim",
        injectedFaults: session.events.filter((event) => event.type === "fault.injected").length,
        operatorCancelled: session.status === "cancelled",
        activeRunPresent: Boolean(session.activeRunId),
        agentRunsCancelled: runReceipts.filter((run) => run.status === "cancelled").length,
        operatorInterruptedRuns: (session.operatorInterruptions ?? []).filter(
          (interruption) => interruption.status === "cancelled",
        ).length,
        operatorInterruptions: session.operatorInterruptions ?? [],
        previewAttestations: session.previewAttestations ?? [],
        flightRecorder,
        teamTask:
          taskType === "team-task"
            ? {
                taskBrief: session.taskBrief,
                successCriteria: session.successCriteria,
                artifactVersion: session.artifactVersion,
                artifactSha256: session.artifact
                  ? createHash("sha256").update(session.artifact).digest("hex")
                  : null,
                reviewVerdict: session.reviewVerdict,
                reviewChecks: session.reviewChecks,
                artifactAgentId: artifactTurn?.agentId ?? null,
                reviewAgentId: reviewTurn?.agentId ?? null,
                distinctReviewer,
                completedWithIndependentReview:
                  session.status === "completed" &&
                  session.reviewVerdict === "PASS" &&
                  distinctReviewer,
              }
            : null,
      },
      runReceipts,
      session,
    };
    const sha256 = createHash("sha256").update(JSON.stringify(evidence)).digest("hex");
    const { generatedAt, ...contentEvidence } = evidence;
    void generatedAt;
    const contentSha256 = createHash("sha256")
      .update(JSON.stringify(contentEvidence))
      .digest("hex");
    return {
      evidence,
      digest: { algorithm: "sha256", value: sha256 },
      contentDigest: { algorithm: "sha256", value: contentSha256 },
    };
  });

  app.get("/api/relay/attestations/:id/:file", async (request, reply) => {
    const { id, file } = attestationArtifactParams.parse(request.params);
    const target = path.join(config.dataDirectory, "attestations", id, file);
    let body: Buffer;
    try {
      body = await readFile(target);
    } catch {
      throw new HttpError(404, "Browser attestation artifact not found");
    }
    reply.header("Cache-Control", "no-store");
    return reply.type("image/png").send(body);
  });

  app.get("/api/relay/sessions/:id", async (request) => {
    if (!relay) throw new HttpError(503, "Durable Agent Relay is not enabled");
    const { id } = relaySessionIdParams.parse(request.params);
    return { session: await relay.getSession(id) };
  });

  app.get("/api/agents", async () => ({ agents: service.listAgents() }));

  app.post("/api/agents", async (request, reply) => {
    const body = createAgentBody.parse(request.body);
    const agent = await service.createAgent(body);
    return reply.code(201).send({ agent });
  });

  app.get("/api/agents/:id", async (request) => {
    const { id } = agentIdParams.parse(request.params);
    return { agent: service.getAgent(id) };
  });

  app.patch("/api/agents/:id", async (request) => {
    const { id } = agentIdParams.parse(request.params);
    const body = updateAgentBody.parse(request.body);
    return { agent: await service.updateAgent(id, body) };
  });

  app.delete("/api/agents/:id", async (request) => {
    const { id } = agentIdParams.parse(request.params);
    return service.deleteAgent(id);
  });

  app.post("/api/agents/:id/start", async (request) => {
    const { id } = agentIdParams.parse(request.params);
    return { agent: await service.startAgent(id) };
  });

  app.post("/api/agents/:id/stop", async (request) => {
    const { id } = agentIdParams.parse(request.params);
    return { agent: await service.stopAgent(id) };
  });

  app.post("/api/agents/:id/tasks", async (request, reply) => {
    if (!relay) throw new HttpError(503, "Durable Agent middleware is not enabled");
    const { id } = agentIdParams.parse(request.params);
    const { content } = coordinatedTaskBody.parse(request.body);
    const { plan, run: planningRun } = await service.planTask(id, content);
    if (plan.needsClarification) {
      return reply.code(200).send({
        status: "needs-clarification",
        plan,
        planningRun,
      });
    }

    const workers = [];
    for (const workerPlan of plan.workers) {
      workers.push(await service.createTaskWorker(id, plan.id, workerPlan));
    }
    const workerByRole = new Map(
      workers.map((worker) => [worker.role ?? "", worker]),
    );
    const plannedWorkers = plan.workers.map((workerPlan) => {
      const worker = workerByRole.get(workerPlan.role);
      if (!worker) throw new Error(`Task worker ${workerPlan.role} was not created`);
      return {
        agentId: worker.id,
        role: workerPlan.role,
        name: workerPlan.name,
        purpose: workerPlan.purpose,
        skills: workerPlan.skills,
      };
    });
    const plannedSteps = plan.steps.map((step) => {
      const owner = workerByRole.get(step.ownerRole);
      if (!owner) throw new Error(`Task stage ${step.id} has no worker`);
      return { ...step, ownerAgentId: owner.id };
    });
    const session = await relay.createSession({
      name: plan.summary,
      participantAgentIds: workers.map((worker) => worker.id),
      workspaceAgentId: id,
      taskType: "checkpoint-workflow",
      taskBrief: plan.request,
      steps: plannedSteps.map((step) =>
        [
          step.title,
          step.description,
          `Required evidence: ${step.successEvidence}`,
        ].join(" — ").slice(0, 800),
      ),
      stepAgentIds: plannedSteps.map((step) => step.ownerAgentId),
      planningRunId: planningRun.id,
      coordinationPlan: {
        id: plan.id,
        summary: plan.summary,
        rationale: plan.rationale,
        riskLevel: plan.riskLevel,
        workers: plannedWorkers,
        steps: plannedSteps,
        createdAt: plan.createdAt,
      },
      maxAttempts: Math.max(3, workers.length + 1),
      // Real coding checkpoints regularly include browser/build verification.
      // Ten minutes remains bounded while avoiding false recovery caused by an
      // otherwise healthy Codex turn crossing the former five-minute limit.
      turnTimeoutMs: 600_000,
      faultMode: "none",
    });
    return reply.code(201).send({
      status: "started",
      plan,
      planningRun,
      workers,
      session,
    });
  });

  app.get("/api/agents/:id/messages", async (request) => {
    const { id } = agentIdParams.parse(request.params);
    return { messages: service.getMessages(id) };
  });

  app.get("/api/agents/:id/runs", async (request) => {
    const { id } = agentIdParams.parse(request.params);
    return { runs: service.getRuns(id) };
  });

  app.get("/api/agents/:id/preview-status", async (request) => {
    const { id } = agentIdParams.parse(request.params);
    const indexPath = path.join(service.getAgent(id).workspacePath, "index.html");
    try {
      const file = await stat(indexPath);
      return { available: file.isFile(), url: `/api/agents/${id}/preview/` };
    } catch {
      return { available: false, url: null };
    }
  });

  app.get("/api/agents/:id/preview", async (request, reply) => {
    const { id } = agentIdParams.parse(request.params);
    return reply.redirect(`/api/agents/${id}/preview/`);
  });

  app.get("/api/agents/:id/preview/*", async (request, reply) => {
    const parsed = previewPathParams.parse(request.params);
    const workspaceRoot = path.resolve(service.getAgent(parsed.id).workspacePath);
    const requested = parsed["*"] || "index.html";
    const target = path.resolve(workspaceRoot, requested);
    if (!target.startsWith(workspaceRoot + path.sep) || requested.split("/").some((part) => part.startsWith("."))) {
      throw new HttpError(404, "Preview file not found");
    }
    let body: Buffer;
    try {
      const [realWorkspaceRoot, realTarget] = await Promise.all([
        realpath(workspaceRoot),
        realpath(target),
      ]);
      if (!realTarget.startsWith(realWorkspaceRoot + path.sep)) {
        throw new Error("Preview path escaped the workspace");
      }
      body = await readFile(realTarget);
    } catch {
      throw new HttpError(404, "Preview file not found");
    }
    const extension = path.extname(target).toLowerCase();
    const contentTypes: Record<string, string> = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".ico": "image/x-icon",
    };
    const contentType = contentTypes[extension];
    if (!contentType) throw new HttpError(415, "Preview file type is not supported");
    reply.header(
      "Content-Security-Policy",
      "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'none'; frame-ancestors 'self'; form-action 'none'; base-uri 'none'",
    );
    reply.header("Cache-Control", "no-store");
    return reply.type(contentType).send(body);
  });

  app.post("/api/agents/:id/messages", async (request, reply) => {
    const { id } = agentIdParams.parse(request.params);
    const body = messageBody.parse(request.body);
    const result = await service.sendMessage(id, body.content);
    return reply.code(202).send(result);
  });

  app.get("/api/runs/:id", async (request) => {
    const { id } = runIdParams.parse(request.params);
    return { run: service.getRun(id) };
  });

  if (config.nodeEnv === "production") {
    const webRoot = fileURLToPath(new URL("../../web/dist", import.meta.url));
    await app.register(fastifyStatic, {
      root: webRoot,
      prefix: "/",
    });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api/")) {
        return reply.code(404).send({ error: "API route not found" });
      }
      return reply.sendFile("index.html");
    });
  }

  app.setErrorHandler((error, request, reply) => {
    const appError = error instanceof Error ? error : new Error(String(error));
    const validationError = error instanceof z.ZodError;
    const frameworkStatus =
      typeof (error as { statusCode?: unknown }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : null;
    const statusCode =
      error instanceof HttpError
        ? error.statusCode
        : validationError
          ? 400
          : frameworkStatus && frameworkStatus >= 400 && frameworkStatus <= 599
            ? frameworkStatus
            : 500;
    if (statusCode >= 500) {
      request.log.error(appError);
    }
    return reply.code(statusCode).send({
      error: appError.message,
      ...(validationError ? { details: error.issues } : {}),
    });
  });

  return app;
}
