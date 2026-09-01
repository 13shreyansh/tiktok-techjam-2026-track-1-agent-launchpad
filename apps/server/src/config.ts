import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";

const envSchema = z.object({
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.string().default("info"),
  APP_DATA_DIR: z.string().default(path.resolve(".data")),
  AGENT_WORKSPACE_ROOT: z.string().default(path.resolve("workspaces")),
  CODEX_HOME: z.string().default(path.resolve("codex-home")),
  CODEX_BIN: z.string().default("codex"),
  CODEX_SANDBOX_MODE: z
    .enum(["read-only", "workspace-write", "danger-full-access"])
    .default("workspace-write"),
  CODEX_TIMEOUT_MS: z.coerce.number().int().min(1_000).default(600_000),
  CODEX_MAX_OUTPUT_BYTES: z.coerce.number().int().min(65_536).default(2_097_152),
  CODEX_AUTH_MODE: z.enum(["provider-key", "chatgpt"]).default("provider-key"),
  RELAY_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  NATS_URL: z.string().url().default("nats://127.0.0.1:4333"),
  RELAY_ACK_WAIT_MS: z.coerce.number().int().min(1_000).max(600_000).default(5_000),
  RELAY_MAX_DELIVER: z.coerce.number().int().min(1).max(100).default(20),
  RUNTIME_PROVIDER: z.enum(["local-process", "container"]).default("local-process"),
  CONTAINER_ENGINE: z.string().min(1).default("docker"),
  CONTAINER_RUNTIME_IMAGE: z.string().min(1).default("volc-agent-runtime:local"),
  CONTAINER_CPU_LIMIT: z.coerce.number().positive().default(2),
  CONTAINER_MEMORY_LIMIT: z
    .string()
    .regex(/^\d+(?:\.\d+)?[bkmg]$/i)
    .default("2g"),
  CONTAINER_PIDS_LIMIT: z.coerce.number().int().positive().default(256),
  CONTAINER_USER: z.string().optional(),
  RUNTIME_INSTANCE_ID: z
    .string()
    .trim()
    .min(1)
    .max(48)
    .regex(/^[a-zA-Z0-9_.-]+$/)
    .default("default"),
  SOURCE_REVISION: z
    .string()
    .trim()
    .regex(/^(?:[0-9a-f]{7,64}|unknown)$/)
    .default("unknown"),
  SOURCE_DIRTY: z.enum(["true", "false", "unknown"]).default("unknown"),
  BUILD_SHA256: z
    .string()
    .trim()
    .regex(/^(?:[0-9a-f]{64}|unknown)$/)
    .default("unknown"),
  PLAYWRIGHT_MODULE_PATH: z.string().trim().min(1).optional(),
  BROWSER_ATTESTATION_CHANNEL: z.string().trim().min(1).max(40).optional(),
  RUNTIME_VERSION: z.string().trim().min(1).max(160).default("unknown"),
  APP_AUTH_TOKEN: z
    .string()
    .trim()
    .max(128)
    .regex(/^[A-Za-z0-9._~-]*$/, "APP_AUTH_TOKEN must use URL-safe characters")
    .optional(),
  ARK_API_KEY: z.string().optional(),
  ARK_MODEL: z.string().optional(),
  ARK_BASE_URL: z
    .string()
    .url()
    .default("https://ark.cn-beijing.volces.com/api/v3"),
  MODEL_API_KEY: z.string().optional(),
  MODEL_ID: z.string().optional(),
  MODEL_BASE_URL: z.string().url().optional(),
  MODEL_PROVIDER_NAME: z.string().trim().min(1).max(80).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env) {
  const env = envSchema.parse(environment);
  const authToken = env.APP_AUTH_TOKEN?.trim() ?? "";
  const loopbackHosts = new Set(["127.0.0.1", "::1", "localhost"]);
  if (env.NODE_ENV === "production" && !loopbackHosts.has(env.HOST)) {
    if (authToken.length < 24 || authToken.startsWith("replace-")) {
      throw new Error(
        "APP_AUTH_TOKEN must contain at least 24 characters for a non-loopback production server",
      );
    }
  }
  const defaultContainerUser =
    typeof process.getuid === "function" && typeof process.getgid === "function"
      ? process.getuid() + ":" + process.getgid()
      : "1000:1000";
  const arkApiKey = env.ARK_API_KEY?.trim() ?? "";
  const arkModel = env.ARK_MODEL?.trim() ?? "";
  const genericProviderRequested = [
    env.MODEL_API_KEY,
    env.MODEL_ID,
    env.MODEL_BASE_URL,
  ].some((value) => (value?.trim().length ?? 0) > 0);
  const modelApiKey = genericProviderRequested
    ? env.MODEL_API_KEY?.trim() ?? ""
    : arkApiKey;
  const modelId = genericProviderRequested
    ? env.MODEL_ID?.trim() ?? ""
    : arkModel;
  const modelBaseUrl = (
    genericProviderRequested
      ? env.MODEL_BASE_URL ?? "https://api.openai.com/v1"
      : env.ARK_BASE_URL
  ).replace(/\/+$/, "");
  if (env.CODEX_AUTH_MODE === "chatgpt" && env.RUNTIME_PROVIDER !== "local-process") {
    throw new Error(
      "CODEX_AUTH_MODE=chatgpt requires RUNTIME_PROVIDER=local-process; host login is not mounted into containers",
    );
  }
  const codexHome =
    env.CODEX_AUTH_MODE === "chatgpt" && !(environment.CODEX_HOME?.trim())
      ? path.join(os.homedir(), ".codex")
      : path.resolve(env.CODEX_HOME);
  return {
    host: env.HOST,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    dataDirectory: path.resolve(env.APP_DATA_DIR),
    workspaceRoot: path.resolve(env.AGENT_WORKSPACE_ROOT),
    codexHome,
    codexBin: env.CODEX_BIN,
    codexAuthMode: env.CODEX_AUTH_MODE,
    codexSandboxMode: env.CODEX_SANDBOX_MODE,
    codexTimeoutMs: env.CODEX_TIMEOUT_MS,
    codexMaxOutputBytes: env.CODEX_MAX_OUTPUT_BYTES,
    relayEnabled: env.RELAY_ENABLED,
    natsUrl: env.NATS_URL,
    relayAckWaitMs: env.RELAY_ACK_WAIT_MS,
    relayMaxDeliver: env.RELAY_MAX_DELIVER,
    runtimeProvider: env.RUNTIME_PROVIDER,
    containerEngine: env.CONTAINER_ENGINE,
    containerRuntimeImage: env.CONTAINER_RUNTIME_IMAGE,
    containerCpuLimit: env.CONTAINER_CPU_LIMIT,
    containerMemoryLimit: env.CONTAINER_MEMORY_LIMIT,
    containerPidsLimit: env.CONTAINER_PIDS_LIMIT,
    containerUser: env.CONTAINER_USER?.trim() || defaultContainerUser,
    runtimeInstanceId: env.RUNTIME_INSTANCE_ID,
    sourceRevision: env.SOURCE_REVISION,
    sourceDirty:
      env.SOURCE_DIRTY === "unknown" ? null : env.SOURCE_DIRTY === "true",
    buildSha256: env.BUILD_SHA256,
    runtimeVersion: env.RUNTIME_VERSION,
    playwrightModulePath: env.PLAYWRIGHT_MODULE_PATH?.trim() ?? "",
    browserAttestationChannel: env.BROWSER_ATTESTATION_CHANNEL?.trim() ?? "",
    authToken,
    arkApiKey,
    arkModel,
    arkBaseUrl: env.ARK_BASE_URL.replace(/\/+$/, ""),
    modelApiKey,
    modelId,
    modelBaseUrl:
      env.CODEX_AUTH_MODE === "chatgpt"
        ? "https://api.openai.com/v1"
        : modelBaseUrl,
    modelProviderId:
      env.CODEX_AUTH_MODE === "chatgpt"
        ? "openai"
        : genericProviderRequested
          ? "openai_compatible"
          : "volcengine_ark",
    modelProviderName:
      env.CODEX_AUTH_MODE === "chatgpt"
        ? "OpenAI via ChatGPT login"
        : genericProviderRequested
          ? env.MODEL_PROVIDER_NAME ?? "OpenAI-compatible Responses"
          : "Volcengine Ark",
    modelApiKeyEnv: genericProviderRequested ? "MODEL_API_KEY" : "ARK_API_KEY",
    nodeEnv: env.NODE_ENV,
  };
}

export function isModelConfigured(config: AppConfig): boolean {
  if (config.codexAuthMode === "chatgpt") return true;
  return (
    config.modelApiKey.length > 0 &&
    !config.modelApiKey.startsWith("replace-") &&
    config.modelId.length > 0 &&
    !config.modelId.includes("replace-")
  );
}

export function isArkConfigured(config: AppConfig): boolean {
  return (
    config.codexAuthMode === "provider-key" &&
    config.modelProviderId === "volcengine_ark" && isModelConfigured(config)
  );
}

export async function writeCodexConfig(config: AppConfig): Promise<void> {
  if (config.codexAuthMode === "chatgpt") return;
  await mkdir(config.codexHome, { recursive: true });
  const toml = [
    "# Generated by Agent Launchpad. Edit environment variables, not this file.",
    "model = " + JSON.stringify(config.modelId || "model-not-configured"),
    "model_provider = " + JSON.stringify(config.modelProviderId),
    "",
    "[model_providers." + config.modelProviderId + "]",
    "name = " + JSON.stringify(config.modelProviderName),
    "base_url = " + JSON.stringify(config.modelBaseUrl),
    "env_key = " + JSON.stringify(config.modelApiKeyEnv),
    'wire_api = "responses"',
    "requires_openai_auth = false",
    "",
  ].join("\n");
  await writeFile(path.join(config.codexHome, "config.toml"), toml, {
    encoding: "utf8",
    mode: 0o600,
  });
}
