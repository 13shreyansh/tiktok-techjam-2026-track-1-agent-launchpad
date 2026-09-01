#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

command -v node >/dev/null 2>&1 || {
  printf 'Node.js is required.\n' >&2
  exit 2
}

runtime_path="$(./scripts/resolve-codex-runtime.sh)"
probe_root="$(mktemp -d "${TMPDIR:-/tmp}/relay-runtime-contract.XXXXXX")"

cleanup() {
  case "$probe_root" in
    "${TMPDIR:-/tmp}"/relay-runtime-contract.*) find "$probe_root" -depth -delete ;;
    *) printf 'Refusing to remove unexpected probe path: %s\n' "$probe_root" >&2 ;;
  esac
}
trap cleanup EXIT INT TERM

mkdir -p "$probe_root/workspace"
npm run build -w @launchpad/server >/dev/null

env -u ARK_API_KEY -u ARK_MODEL -u MODEL_API_KEY -u OPENAI_API_KEY \
  PROBE_ROOT="$probe_root" \
  PROBE_RUNTIME="$runtime_path" \
  node --input-type=module -e '
    import { loadConfig, writeCodexConfig } from "./apps/server/dist/config.js";
    import { CodexRunner } from "./apps/server/dist/codex-runner.js";

    const root = process.env.PROBE_ROOT;
    const runtime = process.env.PROBE_RUNTIME;
    const config = loadConfig({
      NODE_ENV: "test",
      CODEX_HOME: `${root}/codex-home`,
      CODEX_BIN: runtime,
      CODEX_TIMEOUT_MS: "10000",
      CODEX_MAX_OUTPUT_BYTES: "262144",
      MODEL_ID: "contract-probe-model",
      MODEL_BASE_URL: "http://127.0.0.1:1/v1",
    });
    await writeCodexConfig(config);
    const runner = new CodexRunner(config);
    const available = await runner.isAvailable();
    let unexpectedSuccess = false;
    let error = "";
    try {
      await runner.run({
        agentId: "contract-probe",
        workspacePath: `${root}/workspace`,
        prompt: "Return exactly SAFE and nothing else.",
        threadId: null,
      });
      unexpectedSuccess = true;
    } catch (reason) {
      error = reason instanceof Error ? reason.message : String(reason);
    }
    const credentialGuarded = error.includes("Missing environment variable: `MODEL_API_KEY`");
    console.log(JSON.stringify({
      available,
      configured: false,
      endpoint: "loopback-unreachable",
      credentialGuarded,
      unexpectedSuccess,
      error,
    }));
    if (!available || !credentialGuarded || unexpectedSuccess) process.exit(1);
  '
