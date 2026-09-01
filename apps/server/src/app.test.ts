import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import type { AgentService } from "./agent-service.js";
import type { RelayCoordinator } from "./relay-coordinator.js";
import type { RelaySession } from "./relay-types.js";

const service = {
  listAgents: () => [],
  systemInfo: async () => ({}),
} as unknown as AgentService;

describe("HTTP boundary", () => {
  it("awaits Runtime information before attaching source attestation", async () => {
    const runtimeService = {
      systemInfo: async () => ({ modelConfigured: true, codexAvailable: true }),
    } as unknown as AgentService;
    const app = await createApp(
      loadConfig({
        NODE_ENV: "test",
        SOURCE_REVISION: "23e01d4",
        SOURCE_DIRTY: "false",
        BUILD_SHA256: "a".repeat(64),
        RUNTIME_VERSION: "codex-cli test",
      }),
      runtimeService,
    );

    const response = await app.inject({ method: "GET", url: "/api/system" });
    expect(response.json()).toEqual({
      modelConfigured: true,
      codexAvailable: true,
      proofGateEnabled: false,
      source: {
        revision: "23e01d4",
        dirty: false,
        buildSha256: "a".repeat(64),
        runtimeVersion: "codex-cli test",
      },
    });
    await app.close();
  });

  it("protects API routes with the configured shared token", async () => {
    const app = await createApp(
      loadConfig({ NODE_ENV: "test", APP_AUTH_TOKEN: "a-strong-test-token" }),
      service,
    );
    const denied = await app.inject({ method: "GET", url: "/api/agents" });
    expect(denied.statusCode).toBe(401);

    const allowed = await app.inject({
      method: "GET",
      url: "/api/agents",
      headers: { authorization: "Bearer a-strong-test-token" },
    });
    expect(allowed.statusCode).toBe(200);
    await app.close();
  });

  it("preserves Fastify client error status codes", async () => {
    const app = await createApp(loadConfig({ NODE_ENV: "test" }), service);
    const malformed = await app.inject({
      method: "POST",
      url: "/api/agents",
      headers: { "content-type": "application/json" },
      payload: "{not-json",
    });
    expect(malformed.statusCode).toBe(400);

    const oversized = await app.inject({
      method: "POST",
      url: "/api/agents",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ name: "x".repeat(1_100_000) }),
    });
    expect(oversized.statusCode).toBe(413);
    await app.close();
  });

  it("fails closed when relay routes are not enabled", async () => {
    const app = await createApp(loadConfig({ NODE_ENV: "test" }), service);
    const list = await app.inject({ method: "GET", url: "/api/relay/sessions" });
    expect(list.json()).toEqual({ enabled: false, sessions: [] });

    const create = await app.inject({
      method: "POST",
      url: "/api/relay/sessions",
      payload: {
        participantAgentIds: [
          "00000000-0000-4000-8000-000000000001",
          "00000000-0000-4000-8000-000000000002",
        ],
      },
    });
    expect(create.statusCode).toBe(503);
    await app.close();
  });

  it("exposes relay session creation and durable reads", async () => {
    const timestamp = new Date().toISOString();
    const session: RelaySession = {
      id: "00000000-0000-4000-8000-000000000010",
      name: "Countdown 10 to 1",
      taskType: "countdown",
      faultMode: "none",
      status: "running",
      participantAgentIds: [
        "00000000-0000-4000-8000-000000000001",
        "00000000-0000-4000-8000-000000000002",
      ],
      sourceAttestation: {
        revision: "frozen-session-source",
        dirty: false,
        buildSha256: "b".repeat(64),
        runtimeVersion: "codex-cli frozen-session-runtime",
      },
      initialValue: 10,
      expectedValue: 10,
      maxAttempts: 3,
      turnTimeoutMs: 60_000,
      attemptsByValue: {},
      nextEventSequence: 1,
      acceptedTurns: [],
      events: [],
      failure: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
    };
    const relay = {
      listSessions: async () => [session],
      createSession: async () => session,
      getSession: async () => session,
      cancelSession: async () => ({ ...session, status: "cancelled" as const }),
      subscribeChanges: () => () => undefined,
    } as unknown as RelayCoordinator;
    const app = await createApp(
      loadConfig({
        NODE_ENV: "test",
        SOURCE_REVISION: "d".repeat(40),
        SOURCE_DIRTY: "true",
        BUILD_SHA256: "a".repeat(64),
        RUNTIME_VERSION: "codex-cli newer-exporting-runtime",
      }),
      service,
      relay,
    );

    const list = await app.inject({ method: "GET", url: "/api/relay/sessions" });
    expect(list.json()).toMatchObject({ enabled: true, sessions: [{ id: session.id }] });
    const create = await app.inject({
      method: "POST",
      url: "/api/relay/sessions",
      payload: { participantAgentIds: session.participantAgentIds },
    });
    expect(create.statusCode).toBe(201);
    const read = await app.inject({
      method: "GET",
      url: `/api/relay/sessions/${session.id}`,
    });
    expect(read.json()).toMatchObject({ session: { id: session.id } });
    const cancelled = await app.inject({
      method: "POST",
      url: `/api/relay/sessions/${session.id}/cancel`,
    });
    expect(cancelled.json()).toMatchObject({
      session: { id: session.id, status: "cancelled" },
    });
    const exported = await app.inject({
      method: "GET",
      url: `/api/relay/sessions/${session.id}/evidence`,
    });
    const exportBody = exported.json();
    expect(exportBody.evidence).toMatchObject({
      schemaVersion: 10,
      source: {
        revision: "frozen-session-source",
        dirty: false,
        buildSha256: "b".repeat(64),
        runtimeVersion: "codex-cli frozen-session-runtime",
      },
      proof: { exactCountdown: false, uniqueAcceptedTurnIds: true },
      session: { id: session.id },
    });
    expect(exportBody.digest.value).toBe(
      createHash("sha256").update(JSON.stringify(exportBody.evidence)).digest("hex"),
    );
    const { generatedAt, ...contentEvidence } = exportBody.evidence;
    expect(generatedAt).toEqual(expect.any(String));
    expect(exportBody.contentDigest.value).toBe(
      createHash("sha256").update(JSON.stringify(contentEvidence)).digest("hex"),
    );
    await app.close();
  });

  it("streams an immediate durable relay snapshot", async () => {
    const timestamp = new Date().toISOString();
    const session = {
      id: "00000000-0000-4000-8000-000000000010",
      name: "Countdown 1 to 1",
      taskType: "countdown",
      faultMode: "none",
      status: "completed",
      participantAgentIds: [],
      initialValue: 1,
      expectedValue: 0,
      maxAttempts: 1,
      turnTimeoutMs: 250,
      attemptsByValue: { "1": 1 },
      nextEventSequence: 2,
      acceptedTurns: [],
      events: [],
      failure: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: timestamp,
    } as RelaySession;
    const relay = {
      listSessions: async () => [session],
      subscribeChanges: () => () => undefined,
    } as unknown as RelayCoordinator;
    const app = await createApp(
      loadConfig({ NODE_ENV: "test", APP_AUTH_TOKEN: "relay-stream-token" }),
      service,
      relay,
    );
    const address = await app.listen({ host: "127.0.0.1", port: 0 });
    const controller = new AbortController();

    const denied = await fetch(`${address}/api/relay/sessions/stream`);
    expect(denied.status).toBe(401);
    const response = await fetch(`${address}/api/relay/sessions/stream`, {
      headers: { Authorization: "Bearer relay-stream-token" },
      signal: controller.signal,
    });
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    const first = await reader!.read();
    const frame = new TextDecoder().decode(first.value);
    expect(frame).toContain("event: sessions");
    expect(frame).toContain(session.id);

    await reader!.cancel();
    controller.abort();
    await app.close();
  });
});
