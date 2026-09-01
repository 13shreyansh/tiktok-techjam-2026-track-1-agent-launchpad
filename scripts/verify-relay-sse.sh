#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

nats_binary="$(./scripts/acquire-nats.sh)"
nats_port="${RELAY_SSE_VERIFY_NATS_PORT:-4337}"
app_port="${RELAY_SSE_VERIFY_APP_PORT:-3112}"
proof_root="$(mktemp -d "${TMPDIR:-/tmp}/relay-sse-proof.XXXXXX")"
nats_pid=""
app_pid=""
stream_pid=""

cleanup() {
  if [[ -n "$stream_pid" ]]; then
    kill "$stream_pid" >/dev/null 2>&1 || true
    wait "$stream_pid" 2>/dev/null || true
  fi
  if [[ -n "$app_pid" ]]; then
    kill "$app_pid" >/dev/null 2>&1 || true
    wait "$app_pid" 2>/dev/null || true
  fi
  if [[ -n "$nats_pid" ]]; then
    kill "$nats_pid" >/dev/null 2>&1 || true
    wait "$nats_pid" 2>/dev/null || true
  fi
  case "$proof_root" in
    "${TMPDIR:-/tmp}"/relay-sse-proof.*) rm -rf "$proof_root" ;;
    *) printf 'Refusing to remove unexpected proof path: %s\n' "$proof_root" >&2 ;;
  esac
}
trap cleanup EXIT INT TERM

"$nats_binary" -js -a 127.0.0.1 -sd "$proof_root/nats" -p "$nats_port" \
  >"$proof_root/nats.log" 2>&1 &
nats_pid="$!"

nats_ready=false
for _ in {1..50}; do
  if kill -0 "$nats_pid" 2>/dev/null && node -e "const net=require('node:net');const socket=net.connect($nats_port,'127.0.0.1',()=>{socket.end();process.exit(0)});socket.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),100).unref()"; then
    nats_ready=true
    break
  fi
  sleep 0.1
done
if [[ "$nats_ready" != true ]] || ! kill -0 "$nats_pid" 2>/dev/null; then
  printf 'NATS did not become ready.\n' >&2
  exit 1
fi

env -u ARK_API_KEY -u ARK_MODEL \
  RELAY_ENABLED=true \
  NATS_URL="nats://127.0.0.1:$nats_port" \
  APP_DATA_DIR="$proof_root/data" \
  AGENT_WORKSPACE_ROOT="$proof_root/workspaces" \
  CODEX_HOME="$proof_root/codex-home" \
  RUNTIME_PROVIDER=local-process \
  HOST=127.0.0.1 \
  PORT="$app_port" \
  NODE_ENV=production \
  node apps/server/dist/index.js >"$proof_root/app.log" 2>&1 &
app_pid="$!"

app_ready=false
for _ in {1..80}; do
  if curl -fsS "http://127.0.0.1:$app_port/api/health" >/dev/null 2>&1; then
    app_ready=true
    break
  fi
  sleep 0.1
done
if [[ "$app_ready" != true ]] || ! kill -0 "$app_pid" 2>/dev/null; then
  printf 'Application did not become ready.\n' >&2
  exit 1
fi

curl -NsS --max-time 8 "http://127.0.0.1:$app_port/api/relay/sessions/stream" \
  >"$proof_root/stream.txt" 2>"$proof_root/stream.err" &
stream_pid="$!"

read_id() {
  node -e 'let text="";process.stdin.on("data",chunk=>text+=chunk).on("end",()=>process.stdout.write(JSON.parse(text).agent.id))'
}

agent_one="$(curl -fsS -X POST -H 'Content-Type: application/json' \
  -d '{"name":"Relay Alpha"}' "http://127.0.0.1:$app_port/api/agents" | read_id)"
agent_two="$(curl -fsS -X POST -H 'Content-Type: application/json' \
  -d '{"name":"Relay Beta"}' "http://127.0.0.1:$app_port/api/agents" | read_id)"
payload="$(node -e 'console.log(JSON.stringify({participantAgentIds:[process.argv[1],process.argv[2]],initialValue:2,maxAttempts:2,turnTimeoutMs:1000,faultMode:"fail-first-claim"}))' "$agent_one" "$agent_two")"
session_id="$(curl -fsS -X POST -H 'Content-Type: application/json' \
  -d "$payload" "http://127.0.0.1:$app_port/api/relay/sessions" | \
  node -e 'let text="";process.stdin.on("data",chunk=>text+=chunk).on("end",()=>process.stdout.write(JSON.parse(text).session.id))')"

status="running"
for _ in {1..80}; do
  status="$(curl -fsS "http://127.0.0.1:$app_port/api/relay/sessions/$session_id" | \
    node -e 'let text="";process.stdin.on("data",chunk=>text+=chunk).on("end",()=>process.stdout.write(JSON.parse(text).session.status))')"
  if [[ "$status" != "running" ]]; then break; fi
  sleep 0.1
done
if [[ "$status" == "running" ]]; then
  printf 'Relay session did not reach a bounded terminal state.\n' >&2
  exit 1
fi

agent_one_runs="$(curl -fsS "http://127.0.0.1:$app_port/api/agents/$agent_one/runs" | \
  node -e 'let text="";process.stdin.on("data",chunk=>text+=chunk).on("end",()=>process.stdout.write(String(JSON.parse(text).runs.length)))')"
agent_two_runs="$(curl -fsS "http://127.0.0.1:$app_port/api/agents/$agent_two/runs" | \
  node -e 'let text="";process.stdin.on("data",chunk=>text+=chunk).on("end",()=>process.stdout.write(String(JSON.parse(text).runs.length)))')"
if [[ "$agent_one_runs" != "0" || "$agent_two_runs" != "0" ]]; then
  printf 'Recovery drill crossed the wrong Agent boundary: [%s,%s] Runs.\n' \
    "$agent_one_runs" "$agent_two_runs" >&2
  exit 1
fi

for _ in {1..30}; do
  if rg -q "$session_id" "$proof_root/stream.txt"; then break; fi
  sleep 0.1
done
if ! rg -q "$session_id" "$proof_root/stream.txt"; then
  printf 'SSE stream did not contain the created session.\n' >&2
  exit 1
fi

frames="$(rg -c '^event: sessions$' "$proof_root/stream.txt")"
printf '{"sessionId":"%s","terminalStatus":"%s","streamSnapshots":%s,"credentialMode":"absent","runCounts":[%s,%s]}\n' \
  "$session_id" "$status" "$frames" "$agent_one_runs" "$agent_two_runs"
node -e '
  const fs = require("node:fs");
  const frames = fs.readFileSync(process.argv[1], "utf8")
    .split("\n\n").filter((frame) => frame.startsWith("event: sessions"));
  const payloads = frames.map((frame) => JSON.parse(frame.split("\ndata: ")[1]));
  const counts = payloads.map((payload) => {
    return payload.sessions[0]?.events?.length ?? 0;
  });
  const monotonic = counts.every((value, index) => index === 0 || value >= counts[index - 1]);
  const finalEvents = payloads.at(-1)?.sessions[0]?.events ?? [];
  const faultInjected = finalEvents.some((event) => event.type === "fault.injected");
  if (!monotonic || counts.length < 2 || !faultInjected) process.exit(1);
  console.log(JSON.stringify({ eventCounts: counts, monotonic, faultInjected }));
' "$proof_root/stream.txt"
