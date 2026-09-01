#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

nats_binary="$(./scripts/acquire-nats.sh)"
nats_port="${RELAY_VERIFY_NATS_PORT:-4335}"
proof_root="$(mktemp -d "${TMPDIR:-/tmp}/agent-relay-verify.XXXXXX")"
export NATS_URL="nats://127.0.0.1:$nats_port"
export RELAY_PROOF_SESSION_ID="$(node -e 'console.log(require("node:crypto").randomUUID())')"
nats_pid=""

cleanup() {
  if [[ -n "$nats_pid" ]]; then
    kill "$nats_pid" >/dev/null 2>&1 || true
    wait "$nats_pid" 2>/dev/null || true
  fi
  rm -rf "$proof_root"
}
trap cleanup EXIT INT TERM

start_nats() {
  "$nats_binary" -js -a 127.0.0.1 -sd "$proof_root/state" -p "$nats_port" \
    >"$proof_root/nats.log" 2>&1 &
  nats_pid="$!"
  for _ in {1..50}; do
    if kill -0 "$nats_pid" 2>/dev/null && node -e "const net=require('node:net');const socket=net.connect($nats_port,'127.0.0.1',()=>{socket.end();process.exit(0)});socket.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),100).unref()"; then
      return
    fi
    sleep 0.1
  done
  printf 'NATS did not become ready.\n' >&2
  return 1
}

npm run build -w @launchpad/server
start_nats
node scripts/verify-nats-adapter.mjs write
kill "$nats_pid"
wait "$nats_pid" 2>/dev/null || true
nats_pid=""

start_nats
node scripts/verify-nats-adapter.mjs read
