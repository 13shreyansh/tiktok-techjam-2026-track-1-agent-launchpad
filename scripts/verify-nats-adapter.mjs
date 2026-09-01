import { NatsRelayBus } from "../apps/server/dist/nats-relay-bus.js";

const mode = process.argv[2] ?? "write";
const servers = process.env.NATS_URL ?? "nats://127.0.0.1:4335";
const sessionId = process.env.RELAY_PROOF_SESSION_ID;
if (!sessionId) throw new Error("RELAY_PROOF_SESSION_ID is required");

const bus = new NatsRelayBus({ servers, ackWaitMs: 1_000, maxDeliver: 5 });
await bus.initialize();

try {
  if (mode === "write") {
    const timestamp = new Date().toISOString();
    const session = {
      id: sessionId,
      name: "Live adapter proof",
      taskType: "countdown",
      faultMode: "none",
      status: "running",
      participantAgentIds: ["proof-agent-a", "proof-agent-b"],
      initialValue: 2,
      expectedValue: 2,
      maxAttempts: 3,
      turnTimeoutMs: 1_000,
      attemptsByValue: {},
      nextEventSequence: 1,
      acceptedTurns: [],
      events: [],
      failure: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
    };
    await bus.createSession(session);
    const turn = {
      id: `${sessionId}:turn:2`,
      sessionId,
      value: 2,
      createdAt: timestamp,
    };
    const first = await bus.publishTurn(turn);
    const second = await bus.publishTurn(turn);
    const delivery = await bus.nextTurn(2_000);
    if (!delivery) throw new Error("JetStream did not deliver the proof turn");
    await delivery.acknowledge();
    const stored = await bus.getSession(sessionId);
    console.log(
      JSON.stringify({
        firstDuplicate: first.duplicate,
        secondDuplicate: second.duplicate,
        delivered: delivery.turn.value,
        deliveryCount: delivery.deliveryCount,
        state: stored?.session.status ?? null,
      }),
    );
  } else if (mode === "read") {
    const stored = await bus.getSession(sessionId);
    if (!stored) throw new Error("JetStream did not restore the proof session");
    console.log(
      JSON.stringify({
        restored: true,
        status: stored.session.status,
        expectedValue: stored.session.expectedValue,
      }),
    );
  } else {
    throw new Error(`Unknown verification mode: ${mode}`);
  }
} finally {
  await bus.close();
}
