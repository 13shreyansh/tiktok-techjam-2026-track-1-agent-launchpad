#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
nats_version="2.14.5"
release_base="https://github.com/nats-io/nats-server/releases/download/v${nats_version}"
manifest_name="SHA256SUMS"
manifest_sha256="2e842f2670eb0eed2c65f2a58ac3f0c439256d607e9654ebd6999859c18ed0e0"

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) platform="darwin-arm64" ;;
  *)
    printf 'This verified acquisition script currently supports macOS arm64 only.\n' >&2
    printf 'Do not substitute an unverified binary; add its published checksum first.\n' >&2
    exit 2
    ;;
esac

archive="nats-server-v${nats_version}-${platform}.tar.gz"
install_root="$repo_dir/.local/nats/v${nats_version}"
download_root="$repo_dir/.local/downloads/nats/v${nats_version}"
manifest_path="$download_root/$manifest_name"
archive_path="$download_root/$archive"
binary_path="$install_root/nats-server-v${nats_version}-${platform}/nats-server"

mkdir -p "$download_root" "$install_root"

verify_sha256() {
  local path="$1"
  local expected="$2"
  local observed
  observed="$(shasum -a 256 "$path" | awk '{print $1}')"
  if [[ "$observed" != "$expected" ]]; then
    printf 'Checksum mismatch for %s\nExpected: %s\nObserved: %s\n' \
      "$path" "$expected" "$observed" >&2
    exit 1
  fi
}

curl -fsSL -o "$manifest_path" "$release_base/$manifest_name"
verify_sha256 "$manifest_path" "$manifest_sha256"

published_sha256="$(awk -v name="$archive" '$2 == name {print $1}' "$manifest_path")"
if [[ -z "$published_sha256" ]]; then
  printf 'The pinned archive is absent from the verified release manifest.\n' >&2
  exit 1
fi

if [[ ! -f "$archive_path" ]]; then
  curl -fsSL -o "$archive_path" "$release_base/$archive"
fi
verify_sha256 "$archive_path" "$published_sha256"

if [[ ! -x "$binary_path" ]]; then
  tar -xzf "$archive_path" -C "$install_root"
fi

observed_version="$("$binary_path" --version)"
if [[ "$observed_version" != "nats-server: v${nats_version}" ]]; then
  printf 'Unexpected NATS binary version: %s\n' "$observed_version" >&2
  exit 1
fi

printf '%s\n' "$binary_path"
