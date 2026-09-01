import { randomUUID } from "node:crypto";
import { NatsRelayBus } from "../apps/server/dist/nats-relay-bus.js";
import { RelayCoordinator } from "../apps/server/dist/relay-coordinator.js";

const mode = process.argv[2];
const servers = process.env.NATS_URL ?? "nats://127.0.0.1:4340";
let sessionId = process.env.RELAY_RESTART_SESSION_ID;
const participantAgentIds = [
  "00000000-0000-4000-8000-000000000101",
  "00000000-0000-4000-8000-000000000102",
];
if (mode === "read" && !sessionId) throw new Error("RELAY_RESTART_SESSION_ID is required");

class DeterministicAgentGateway {
  runs = new Map();

  getAgent(agentId) {
    if (!participantAgentIds.includes(agentId)) throw new Error("Agent not found");
    return { id: agentId, name: `Proof Agent ${agentId.slice(-1)}`, status: "ready" };
  }

  async sendMessage(agentId, prompt) {
    const match = prompt.match(/Return exactly ("(?:[^"\\]|\\.)*") and nothing else/);
    if (!match?.[1]) throw new Error("Proof prompt did not contain an expected output");
    const requiredOutput = JSON.parse(match[1]);
    if (!/^\d+$/.test(requiredOutput)) {
      throw new Error("Countdown proof prompt did not contain an integer output");
    }
    const timestamp = new Date().toISOString();
    const run = {
      id: randomUUID(),
      agentId,
      status: "completed",
      prompt,
      output: requiredOutput,
      error: null,
      usage: null,
      startedAt: timestamp,
      completedAt: timestamp,
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
    return this.getRun(runId);
  }
}

const bus = new NatsRelayBus({ servers, ackWaitMs: 1_000, maxDeliver: 10 });
const coordinator = new RelayCoordinator(bus, new DeterministicAgentGateway(), {
  pollIntervalMs: 1,
  retryDelayMs: 0,
});
await coordinator.initialize();

try {
  if (mode === "write") {
    const session = await coordinator.createSession({
      name: "Coordinator restart proof",
      participantAgentIds,
      initialValue: 3,
      maxAttempts: 2,
      turnTimeoutMs: 1_000,
    });
    sessionId = session.id;
  } else if (mode !== "read") {
    throw new Error(`Unknown verification mode: ${mode}`);
  }

  const targetAcceptedTurns = mode === "write" ? 1 : 3;
  for (let index = 0; index < 10; index += 1) {
    const session = await coordinator.getSession(sessionId);
    if (session.acceptedTurns.length >= targetAcceptedTurns) break;
    if (!(await coordinator.processNext(2_000))) continue;
  }

  const session = await coordinator.getSession(sessionId);
  const acceptedValues = session.acceptedTurns.map((turn) => turn.value);
  if (mode === "write") {
    if (session.status !== "running" || acceptedValues.join(",") !== "3") {
      throw new Error("Pre-restart state did not stop after exactly one accepted turn");
    }
    console.log(
      JSON.stringify({
        phase: "before-restart",
        sessionId,
        status: session.status,
        acceptedValues,
        expectedValue: session.expectedValue,
      }),
    );
  } else {
    const uniqueTurnIds =
      new Set(session.acceptedTurns.map((turn) => turn.turnId)).size ===
      session.acceptedTurns.length;
    if (
      session.status !== "completed" ||
      acceptedValues.join(",") !== "3,2,1" ||
      !uniqueTurnIds
    ) {
      throw new Error("Post-restart coordinator did not complete the exact sequence");
    }
    console.log(
      JSON.stringify({
        phase: "after-restart",
        status: session.status,
        acceptedValues,
        uniqueTurnIds,
      }),
    );
  }
} finally {
  await coordinator.close();
}
