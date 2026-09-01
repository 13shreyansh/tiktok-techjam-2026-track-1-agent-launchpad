#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[codex-runtime] %s\n' "$*" >&2
}

reject_known_blocked_runtime() {
  local candidate="$1"
  if [[ "$(uname -s)" != "Darwin" || ! -f "$candidate" ]]; then
    return 0
  fi
  local digest
  digest="$(/usr/bin/shasum -a 256 "$candidate" | /usr/bin/awk '{print $1}')"
  if [[ "$digest" == "d5bbadc9099324684c2d2ee4b4b57ee67e967a89f245101f5fc3a9a4bf44b33d" ]]; then
    log "Refusing the exact codex 0.111.0 artifact previously blocked by macOS."
    return 1
  fi
}

resolve_override() {
  local candidate="$1"
  if [[ "$candidate" != */* ]]; then
    candidate="$(command -v "$candidate" 2>/dev/null || true)"
  fi
  if [[ -z "$candidate" || ! -x "$candidate" ]]; then
    log "CODEX_BIN does not resolve to an executable."
    return 1
  fi
  reject_known_blocked_runtime "$candidate" || return 1
  printf '%s\n' "$candidate"
}

if [[ -n "${CODEX_BIN:-}" ]]; then
  resolve_override "$CODEX_BIN"
  exit
fi

if [[ "$(uname -s)" == "Darwin" ]]; then
  bundled_app="/Applications/ChatGPT.app"
  bundled_runtime="$bundled_app/Contents/Resources/codex"
  if [[ -x "$bundled_runtime" ]]; then
    /usr/bin/codesign --verify --strict "$bundled_runtime" >/dev/null 2>&1 || {
      log "The ChatGPT-bundled Codex signature did not verify."
      exit 2
    }
    signature_details="$(/usr/bin/codesign -dv --verbose=4 "$bundled_runtime" 2>&1)"
    /usr/bin/grep -q '^TeamIdentifier=2DC432GLL2$' <<<"$signature_details" || {
        log "The ChatGPT-bundled Codex Team Identifier was not OpenAI's expected value."
        exit 2
      }
    /usr/sbin/spctl --assess --type execute "$bundled_app" >/dev/null 2>&1 || {
      log "Gatekeeper did not accept the containing ChatGPT application."
      exit 2
    }
    printf '%s\n' "$bundled_runtime"
    exit
  fi
fi

path_runtime="$(command -v codex 2>/dev/null || true)"
if [[ -n "$path_runtime" && -x "$path_runtime" ]]; then
  reject_known_blocked_runtime "$path_runtime" || exit 2
  printf '%s\n' "$path_runtime"
  exit
fi

log "No Codex Runtime was found. Set CODEX_BIN to an explicitly trusted executable."
exit 2
