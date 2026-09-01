#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

log() {
  printf '[durable-relay] %s\n' "$*" >&2
}

generic_model_ready=false
ark_model_ready=false
generic_model_requested=false
auth_mode="${CODEX_AUTH_MODE:-provider-key}"
if [[ "$auth_mode" != "provider-key" && "$auth_mode" != "chatgpt" ]]; then
  log "CODEX_AUTH_MODE must be provider-key or chatgpt."
  exit 2
fi
if [[ -n "${MODEL_API_KEY:-}" \
  || -n "${MODEL_ID:-}" \
  || -n "${MODEL_BASE_URL:-}" ]]; then
  generic_model_requested=true
fi
if [[ -n "${MODEL_API_KEY:-}" \
  && "${MODEL_API_KEY:-}" != replace-* \
  && -n "${MODEL_ID:-}" \
  && "${MODEL_ID:-}" != *replace-* ]]; then
  generic_model_ready=true
fi
if [[ -n "${ARK_API_KEY:-}" \
  && "${ARK_API_KEY:-}" != replace-* \
  && -n "${ARK_MODEL:-}" \
  && "${ARK_MODEL:-}" != *replace-* ]]; then
  ark_model_ready=true
fi
if [[ "$auth_mode" == "provider-key" \
  && (( "$generic_model_requested" == true && "$generic_model_ready" != true ) \
  || ( "$generic_model_requested" != true && "$ark_model_ready" != true )) ]]; then
  log "MODEL_API_KEY and MODEL_ID, or ARK_API_KEY and ARK_MODEL, are required for real Agent runs."
  log "A partial MODEL_* configuration does not fall back to Ark."
  log "No credential bypass or simulated model output is used by this command."
  exit 2
fi

command -v node >/dev/null 2>&1 || {
  log "Node.js 22+ is required."
  exit 2
}
node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
if (( node_major < 22 )); then
  log "Node.js 22+ is required; found $(node --version)."
  exit 2
fi

if [[ ! -d node_modules ]]; then
  log "Installing pinned application dependencies."
  npm ci
fi

export CODEX_BIN="$(./scripts/resolve-codex-runtime.sh)"
runtime_version="$("$CODEX_BIN" --version)"
log "Using trusted Runtime: $runtime_version"
export RUNTIME_VERSION="${RUNTIME_VERSION:-$runtime_version}"
export SOURCE_REVISION="${SOURCE_REVISION:-$(git rev-parse HEAD 2>/dev/null || printf unknown)}"
if [[ -z "${SOURCE_DIRTY:-}" ]]; then
  if [[ -n "$(git status --porcelain --untracked-files=normal 2>/dev/null || true)" ]]; then
    export SOURCE_DIRTY=true
  else
    export SOURCE_DIRTY=false
  fi
fi

if [[ "$auth_mode" == "chatgpt" ]]; then
  if [[ "${RUNTIME_PROVIDER:-local-process}" != "local-process" ]]; then
    log "ChatGPT login mode is local-process only; credentials are never mounted into a container."
    exit 2
  fi
  user_codex_home="$(node -p 'require("node:os").homedir() + "/.codex"')"
  export CODEX_HOME="${CODEX_HOME:-$user_codex_home}"
  if ! CODEX_HOME="$CODEX_HOME" "$CODEX_BIN" login status >/dev/null; then
    log "The selected Codex home is not signed in. Run Codex login through the official CLI first."
    exit 2
  fi
  log "Using an existing ChatGPT login; no credential is copied or printed."
fi

nats_binary="$(./scripts/acquire-nats.sh)"
state_root="${RELAY_STATE_ROOT:-$repo_dir/.local/relay-demo}"
nats_port="${NATS_PORT:-4333}"
app_port="${PORT:-3000}"
mkdir -p "$state_root/nats" "$state_root/data" "$state_root/workspaces" "$state_root/codex-home"

cleanup() {
  if [[ -n "${nats_pid:-}" ]]; then
    kill "$nats_pid" >/dev/null 2>&1 || true
    wait "$nats_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

log "Starting pinned NATS JetStream v2.14.5 on port $nats_port."
"$nats_binary" -js -a 127.0.0.1 -sd "$state_root/nats" -p "$nats_port" \
  >"$state_root/nats-server.log" 2>&1 &
nats_pid="$!"

ready=false
for _ in {1..50}; do
  if node -e "const net=require('node:net');const socket=net.connect($nats_port,'127.0.0.1',()=>{socket.end();process.exit(0)});socket.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),100).unref()"; then
    ready=true
    break
  fi
  sleep 0.1
done
if [[ "$ready" != true ]] || ! kill -0 "$nats_pid" 2>/dev/null; then
  log "JetStream failed to start; see $state_root/nats-server.log"
  exit 1
fi

export RELAY_ENABLED=true
export NATS_URL="nats://127.0.0.1:$nats_port"
export APP_DATA_DIR="${APP_DATA_DIR:-$state_root/data}"
export AGENT_WORKSPACE_ROOT="${AGENT_WORKSPACE_ROOT:-$state_root/workspaces}"
if [[ "$auth_mode" == "provider-key" ]]; then
  export CODEX_HOME="${CODEX_HOME:-$state_root/codex-home}"
fi
export CODEX_AUTH_MODE="$auth_mode"
export RUNTIME_PROVIDER="${RUNTIME_PROVIDER:-local-process}"
export HOST="${HOST:-127.0.0.1}"
export PORT="$app_port"
export NODE_ENV="${NODE_ENV:-production}"

# The browser attestor is optional and provider-neutral. The desktop demo can
# reuse ChatGPT's bundled Playwright without downloading another browser; other
# deployments can point PLAYWRIGHT_MODULE_PATH at their own Playwright module.
bundled_playwright="/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright/index.js"
if [[ -z "${PLAYWRIGHT_MODULE_PATH:-}" && -f "$bundled_playwright" ]]; then
  export PLAYWRIGHT_MODULE_PATH="$bundled_playwright"
  export BROWSER_ATTESTATION_CHANNEL="${BROWSER_ATTESTATION_CHANNEL:-chrome}"
fi

log "JetStream data: $state_root/nats"
if [[ -n "${PLAYWRIGHT_MODULE_PATH:-}" ]]; then
  log "Proof Gate: trusted-host browser attestation enabled (${BROWSER_ATTESTATION_CHANNEL:-chromium})"
else
  log "Proof Gate: unavailable until PLAYWRIGHT_MODULE_PATH is configured"
fi
log "Open http://localhost:$app_port after the build completes."
npm run build
if [[ -z "${BUILD_SHA256:-}" ]]; then
  export BUILD_SHA256="$({
    find apps/web/dist apps/server/dist scripts/bouncer-hook.mjs -type f | LC_ALL=C sort | while IFS= read -r file; do
      printf '%s\n' "$file"
      shasum -a 256 "$file" | awk '{print $1}'
    done
  } | shasum -a 256 | awk '{print $1}')"
fi
log "Source: ${SOURCE_REVISION} (dirty=${SOURCE_DIRTY}); build SHA-256: ${BUILD_SHA256}"
npm start
