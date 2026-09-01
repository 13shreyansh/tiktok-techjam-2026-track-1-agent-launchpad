import path from "node:path";
import { AgentService } from "./agent-service.js";
import { createApp } from "./app.js";
import { loadConfig, writeCodexConfig } from "./config.js";
import { createRunner } from "./runner-factory.js";
import { JsonStore } from "./store.js";
import { WorkspaceManager } from "./workspace.js";
import { NatsRelayBus } from "./nats-relay-bus.js";
import { RelayCoordinator } from "./relay-coordinator.js";
import { HostBrowserAttestor } from "./host-browser-attestor.js";

const config = loadConfig();
await writeCodexConfig(config);

const store = new JsonStore(path.join(config.dataDirectory, "launchpad.json"));
const workspaces = new WorkspaceManager(config.workspaceRoot);
const runner = createRunner(config);
const service = new AgentService(config, store, workspaces, runner);
await service.initialize();

const browserAttestor = config.playwrightModulePath
  ? new HostBrowserAttestor({
      artifactRoot: path.join(config.dataDirectory, "attestations"),
      playwrightModule: config.playwrightModulePath,
      ...(config.browserAttestationChannel
        ? { browserChannel: config.browserAttestationChannel }
        : {}),
    })
  : null;

const relay = config.relayEnabled
  ? new RelayCoordinator(
      new NatsRelayBus({
        servers: config.natsUrl,
        ackWaitMs: config.relayAckWaitMs,
        maxDeliver: config.relayMaxDeliver,
      }),
      service,
      {
        pollIntervalMs: 100,
        retryDelayMs: 250,
        sourceAttestation: {
          revision: config.sourceRevision,
          dirty: config.sourceDirty,
          buildSha256: config.buildSha256,
          runtimeVersion: config.runtimeVersion,
        },
        ...(browserAttestor
          ? {
              attestPreview: async (runId: string) =>
                await browserAttestor.attest(service.getRunWorkspacePath(runId)),
            }
          : {}),
        onLoopError: (error) => console.error("Durable Agent Relay loop error", error),
      },
    )
  : null;
if (relay) {
  await relay.initialize();
  relay.start();
}

const app = await createApp(config, service, relay);

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "Shutting down");
  relay?.stop();
  await app.close();
  await service.close();
  await relay?.close();
  process.exit(0);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

await app.listen({ host: config.host, port: config.port });
