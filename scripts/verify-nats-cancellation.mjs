import { randomUUID } from "node:crypto";
import { NatsRelayBus } from "../apps/server/dist/nats-relay-bus.js";
import { RelayCoordinator } from "../apps/server/dist/relay-coordinator.js";

const mode = process.argv[2];
const servers = process.env.NATS_URL ?? "nats://127.0.0.1:4342";
let sessionId = process.env.RELAY_CANCEL_SESSION_ID;
const participantAgentIds = [
  "00000000-0000-4000-8000-000000000201",
  "00000000-0000-4000-8000-000000000202",
];
if (mode === "read" && !sessionId) throw new Error("RELAY_CANCEL_SESSION_ID is required");

class HangingAgentGateway {
  runs = new Map();
  cancelledRunIds = [];

  getAgent(agentId) {
    if (!participantAgentIds.includes(agentId)) throw new Error("Agent not found");
    return { id: agentId, name: `Cancellation Agent ${agentId.slice(-1)}`, status: "ready" };
  }

  async sendMessage(agentId, prompt) {
    const timestamp = new Date().toISOString();
    const run = {
      id: randomUUID(),
      agentId,
      status: "running",
      prompt,
      output: null,
      error: null,
      usage: null,
      startedAt: timestamp,
      completedAt: null,
      createdAt: timestamp,
    };
    this.runs.set(run.id, run);
    return { run };
  }

  getRun(runId) {
    const run = this.runs.get(runId);
    if (!run) throw new Error("Run not found");
    return run;
  }

  async cancelRun(runId) {
    const run = this.getRun(runId);
    run.status = "cancelled";
    run.error = "cancelled by durable relay proof";
    run.completedAt = new Date().toISOString();
    this.cancelledRunIds.push(runId);
    return run;
  }
}

const gateway = new HangingAgentGateway();
const bus = new NatsRelayBus({ servers, ackWaitMs: 1_000, maxDeliver: 10 });
const coordinator = new RelayCoordinator(bus, gateway, {
  pollIntervalMs: 1,
  retryDelayMs: 0,
});
await coordinator.initialize();

try {
  if (mode === "write") {
    const session = await coordinator.createSession({
      name: "Durable operator cancellation proof",
      participantAgentIds,
      initialValue: 2,
      maxAttempts: 2,
      turnTimeoutMs: 5_000,
    });
    sessionId = session.id;
    const processing = coordinator.processNext(2_000);

    let activeRunId = null;
    for (let poll = 0; poll < 1_000; poll += 1) {
      activeRunId = (await coordinator.getSession(sessionId)).activeRunId ?? null;
      if (activeRunId) break;
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
    if (!activeRunId) throw new Error("Agent Run did not become active");

    await coordinator.cancelSession(sessionId);
    await processing;
    const cancelled = await coordinator.getSession(sessionId);
    const eventTypes = cancelled.events.map((event) => event.type);
    if (
      cancelled.status !== "cancelled" ||
      cancelled.acceptedTurns.length !== 0 ||
      cancelled.activeRunId != null ||
      !eventTypes.includes("session.cancelled") ||
      !eventTypes.includes("run.cancelled") ||
      gateway.cancelledRunIds.length !== 1
    ) {
      throw new Error("Live cancellation did not reach the required terminal state");
    }
    console.log(
      JSON.stringify({
        phase: "before-restart",
        sessionId,
        status: cancelled.status,
        acceptedValues: [],
        agentRunCancelled: true,
      }),
    );
  } else if (mode === "read") {
    const restored = await coordinator.getSession(sessionId);
    const unexpectedDelivery = await coordinator.processNext(250);
    if (
      restored.status !== "cancelled" ||
      restored.acceptedTurns.length !== 0 ||
      unexpectedDelivery
    ) {
      throw new Error("Cancelled session was not inert after NATS restart");
    }
    console.log(
      JSON.stringify({
        phase: "after-restart",
        status: restored.status,
        acceptedValues: [],
        pendingDelivery: false,
      }),
    );
  } else {
    throw new Error(`Unknown verification mode: ${mode}`);
  }
} finally {
  await coordinator.close();
}
