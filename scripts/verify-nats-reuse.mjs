import { randomUUID } from "node:crypto";
import { NatsRelayBus } from "../apps/server/dist/nats-relay-bus.js";
import { RelayCoordinator } from "../apps/server/dist/relay-coordinator.js";

const servers = process.env.NATS_URL ?? "nats://127.0.0.1:4345";
const participantAgentIds = [
  "00000000-0000-4000-8000-000000000401",
  "00000000-0000-4000-8000-000000000402",
  "00000000-0000-4000-8000-000000000403",
];

class DeterministicSequenceGateway {
  runs = new Map();

  getAgent(agentId) {
    if (!participantAgentIds.includes(agentId)) throw new Error("Agent not found");
    return { id: agentId, name: `Reuse Agent ${agentId.slice(-1)}`, status: "ready" };
  }

  async sendMessage(agentId, prompt) {
    const match = prompt.match(/Return exactly ("(?:[^"\\]|\\.)*") and nothing else/);
    if (!match?.[1]) throw new Error("Proof prompt did not contain an expected output");
    const requiredOutput = JSON.parse(match[1]);
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
const coordinator = new RelayCoordinator(bus, new DeterministicSequenceGateway(), {
  pollIntervalMs: 1,
  retryDelayMs: 0,
});
await coordinator.initialize();

async function drain(sessionId) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const session = await coordinator.getSession(sessionId);
    if (session.status !== "running") return session;
    await coordinator.processNext(500);
  }
  throw new Error("Reuse proof did not complete within its safety bound");
}

try {
  const countdown = await coordinator.createSession({
    name: "Reuse proof countdown",
    taskType: "countdown",
    initialValue: 3,
    participantAgentIds,
  });
  const completedCountdown = await drain(countdown.id);

  const handoff = await coordinator.createSession({
    name: "Reuse proof handoff",
    taskType: "ordered-sequence",
    steps: ["PLAN", "BUILD", "TEST", "SHIP"],
    participantAgentIds,
  });
  const completedHandoff = await drain(handoff.id);

  const countdownOutputs = completedCountdown.acceptedTurns.map((turn) => turn.output);
  const handoffOutputs = completedHandoff.acceptedTurns.map((turn) => turn.output);
  const attributedAgents = new Set(
    completedHandoff.acceptedTurns.map((turn) => turn.agentId),
  ).size;
  if (
    completedCountdown.status !== "completed" ||
    countdownOutputs.join(",") !== "3,2,1" ||
    completedHandoff.status !== "completed" ||
    handoffOutputs.join(",") !== "PLAN,BUILD,TEST,SHIP" ||
    attributedAgents !== 3
  ) {
    throw new Error("Live relay reuse proof did not meet its exact invariants");
  }

  console.log(
    JSON.stringify({
      sameMiddleware: true,
      countdownOutputs,
      handoffOutputs,
      handoffAttributedAgents: attributedAgents,
      countdownTaskType: completedCountdown.taskType,
      handoffTaskType: completedHandoff.taskType,
    }),
  );
} finally {
  await coordinator.close();
}
