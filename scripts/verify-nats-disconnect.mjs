import { randomUUID } from "node:crypto";
import { createApp } from "../apps/server/dist/app.js";
import { loadConfig } from "../apps/server/dist/config.js";
import { NatsRelayBus } from "../apps/server/dist/nats-relay-bus.js";
import { RelayCoordinator } from "../apps/server/dist/relay-coordinator.js";

const servers = process.env.NATS_URL ?? "nats://127.0.0.1:4344";
const participantAgentIds = [
  "00000000-0000-4000-8000-000000000301",
  "00000000-0000-4000-8000-000000000302",
  "00000000-0000-4000-8000-000000000303",
];

class DelayedAgentGateway {
  runs = new Map();

  getAgent(agentId) {
    if (!participantAgentIds.includes(agentId)) throw new Error("Agent not found");
    return { id: agentId, name: `Disconnect Agent ${agentId.slice(-1)}`, status: "ready" };
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
    setTimeout(() => {
      run.status = "completed";
      run.output = requiredOutput;
      run.completedAt = new Date().toISOString();
    }, 40).unref();
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
    run.completedAt = new Date().toISOString();
    return run;
  }
}

async function readSessionSnapshot(reader, sessionId, desiredStatus) {
  const decoder = new TextDecoder();
  let buffer = "";
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const read = await Promise.race([
      reader.read(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("SSE snapshot timeout")), 5_000).unref(),
      ),
    ]);
    if (read.done) throw new Error("SSE stream ended before the required snapshot");
    buffer += decoder.decode(read.value, { stream: true }).replaceAll("\r\n", "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = frame
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (data) {
        const snapshot = JSON.parse(data);
        const session = snapshot.sessions.find((candidate) => candidate.id === sessionId);
        if (session && (!desiredStatus || session.status === desiredStatus)) return session;
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
  throw new Error(`No ${desiredStatus ?? "matching"} session snapshot received`);
}

const gateway = new DelayedAgentGateway();
const bus = new NatsRelayBus({ servers, ackWaitMs: 1_000, maxDeliver: 10 });
const coordinator = new RelayCoordinator(bus, gateway, {
  pollIntervalMs: 2,
  retryDelayMs: 0,
});
await coordinator.initialize();
coordinator.start();

const service = {
  listAgents: () => participantAgentIds.map((agentId) => gateway.getAgent(agentId)),
  systemInfo: async () => ({ arkConfigured: false, proofGateway: "deterministic" }),
};
const app = await createApp(loadConfig({ NODE_ENV: "test" }), service, coordinator);
const address = await app.listen({ host: "127.0.0.1", port: 0 });
let firstReader;
let secondReader;

try {
  const firstResponse = await fetch(`${address}/api/relay/sessions/stream`);
  if (!firstResponse.ok || !firstResponse.body) throw new Error("First SSE client failed");
  firstReader = firstResponse.body.getReader();

  const createResponse = await fetch(`${address}/api/relay/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Browser disconnect proof",
      participantAgentIds,
      initialValue: 10,
      maxAttempts: 3,
      turnTimeoutMs: 1_000,
    }),
  });
  if (!createResponse.ok) throw new Error(`Relay creation failed: ${createResponse.status}`);
  const sessionId = (await createResponse.json()).session.id;
  const beforeDisconnect = await readSessionSnapshot(firstReader, sessionId, "running");
  await firstReader.cancel();
  firstReader = undefined;

  let completed;
  for (let poll = 0; poll < 1_000; poll += 1) {
    completed = await coordinator.getSession(sessionId);
    if (completed.status === "completed") break;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  if (completed?.status !== "completed") throw new Error("Relay did not finish while disconnected");

  const secondResponse = await fetch(`${address}/api/relay/sessions/stream`);
  if (!secondResponse.ok || !secondResponse.body) throw new Error("Second SSE client failed");
  secondReader = secondResponse.body.getReader();
  const afterReconnect = await readSessionSnapshot(secondReader, sessionId, "completed");
  const acceptedValues = afterReconnect.acceptedTurns.map((turn) => turn.value);
  if (acceptedValues.join(",") !== "10,9,8,7,6,5,4,3,2,1") {
    throw new Error("Reconnected client did not receive the exact durable sequence");
  }
  console.log(
    JSON.stringify({
      disconnectedAtAcceptedTurns: beforeDisconnect.acceptedTurns.length,
      completedWhileDisconnected: true,
      reconnectedStatus: afterReconnect.status,
      acceptedValues,
    }),
  );
} finally {
  await firstReader?.cancel().catch(() => undefined);
  await secondReader?.cancel().catch(() => undefined);
  await app.close();
  await coordinator.close();
}
