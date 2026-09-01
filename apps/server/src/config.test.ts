import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  isArkConfigured,
  isModelConfigured,
  loadConfig,
  writeCodexConfig,
} from "./config.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function temporaryCodexHome(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "launchpad-config-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

describe("model provider configuration", () => {
  it("preserves the starter Ark provider when MODEL fields are absent", async () => {
    const codexHome = await temporaryCodexHome();
    const config = loadConfig({
      NODE_ENV: "test",
      CODEX_HOME: codexHome,
      ARK_API_KEY: "scoped-ark-secret",
      ARK_MODEL: "ep-test",
      ARK_BASE_URL: "https://ark.example/v3/",
    });

    expect(isModelConfigured(config)).toBe(true);
    expect(isArkConfigured(config)).toBe(true);
    expect(config.modelApiKeyEnv).toBe("ARK_API_KEY");
    await writeCodexConfig(config);

    const toml = await readFile(path.join(codexHome, "config.toml"), "utf8");
    expect(toml).toContain('model_provider = "volcengine_ark"');
    expect(toml).toContain('base_url = "https://ark.example/v3"');
    expect(toml).toContain('env_key = "ARK_API_KEY"');
    expect(toml).toContain('wire_api = "responses"');
    expect(toml).not.toContain("scoped-ark-secret");
  });

  it("selects a provider-neutral Responses endpoint without persisting its key", async () => {
    const codexHome = await temporaryCodexHome();
    const config = loadConfig({
      NODE_ENV: "test",
      CODEX_HOME: codexHome,
      ARK_API_KEY: "unused-ark-secret",
      ARK_MODEL: "unused-ark-model",
      MODEL_API_KEY: "scoped-generic-secret",
      MODEL_ID: "provider-model",
      MODEL_BASE_URL: "https://provider.example/v1/",
      MODEL_PROVIDER_NAME: "Demo Responses Provider",
    });

    expect(isModelConfigured(config)).toBe(true);
    expect(isArkConfigured(config)).toBe(false);
    expect(config.modelApiKeyEnv).toBe("MODEL_API_KEY");
    await writeCodexConfig(config);

    const toml = await readFile(path.join(codexHome, "config.toml"), "utf8");
    expect(toml).toContain('model = "provider-model"');
    expect(toml).toContain('model_provider = "openai_compatible"');
    expect(toml).toContain('[model_providers.openai_compatible]');
    expect(toml).toContain('name = "Demo Responses Provider"');
    expect(toml).toContain('base_url = "https://provider.example/v1"');
    expect(toml).toContain('env_key = "MODEL_API_KEY"');
    expect(toml).toContain('wire_api = "responses"');
    expect(toml).not.toContain("scoped-generic-secret");
    expect(toml).not.toContain("unused-ark-secret");
  });

  it("fails closed for a partial generic provider instead of mixing Ark fields", () => {
    const config = loadConfig({
      NODE_ENV: "test",
      ARK_API_KEY: "valid-ark-secret",
      ARK_MODEL: "valid-ark-model",
      MODEL_BASE_URL: "https://provider.example/v1",
    });

    expect(config.modelProviderId).toBe("openai_compatible");
    expect(config.modelApiKey).toBe("");
    expect(config.modelId).toBe("");
    expect(isModelConfigured(config)).toBe(false);
  });
});
