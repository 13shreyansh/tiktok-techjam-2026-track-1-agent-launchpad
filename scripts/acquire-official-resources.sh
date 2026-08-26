#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output_root="$repo_root/artifacts/official"
retrieved_utc="$(date -u +%Y%m%dT%H%M%SZ)"

starter_commit="8d0bd4f14ad1e453d984149aebcdd0bcb4f74178"
starter_archive="CodeJam-${starter_commit}.tar.gz"
starter_url="https://github.com/RrankPyramid/CodeJam/archive/${starter_commit}.tar.gz"
starter_sha256="a71aa56bca1a6ba388973079370f44af8bff88bccd8f2fdb5dad30a43bfe7b31"

node_version="v22.23.2"
node_archive="node-${node_version}-darwin-arm64.tar.gz"
node_base_url="https://nodejs.org/dist/${node_version}"

mkdir -p "$output_root/starter" "$output_root/node" "$output_root/devpost"

curl -fsSL -o "$output_root/starter/$starter_archive" "$starter_url"
observed_starter_sha="$(shasum -a 256 "$output_root/starter/$starter_archive" | awk '{print $1}')"
if [[ "$observed_starter_sha" != "$starter_sha256" ]]; then
  printf 'Starter checksum mismatch: expected %s, observed %s\n' \
    "$starter_sha256" "$observed_starter_sha" >&2
  exit 1
fi

tar -xOf "$output_root/starter/$starter_archive" \
  "CodeJam-${starter_commit}/LICENSE" > "$output_root/starter/LICENSE"

curl -fsSL -o "$output_root/node/$node_archive" \
  "$node_base_url/$node_archive"
curl -fsSL -o "$output_root/node/SHASUMS256.txt" \
  "$node_base_url/SHASUMS256.txt"
published_node_sha="$(awk -v name="$node_archive" '$2 == name {print $1}' \
  "$output_root/node/SHASUMS256.txt")"
observed_node_sha="$(shasum -a 256 "$output_root/node/$node_archive" | awk '{print $1}')"
if [[ -z "$published_node_sha" || "$observed_node_sha" != "$published_node_sha" ]]; then
  printf 'Node checksum mismatch: expected %s, observed %s\n' \
    "$published_node_sha" "$observed_node_sha" >&2
  exit 1
fi

curl -fsSL --compressed -o "$output_root/devpost/overview-${retrieved_utc}.html" \
  https://tiktoktechjam2026.devpost.com/
curl -fsSL --compressed -o "$output_root/devpost/resources-${retrieved_utc}.html" \
  https://tiktoktechjam2026.devpost.com/resources
curl -fsSL --compressed -o "$output_root/devpost/rules-${retrieved_utc}.html" \
  https://tiktoktechjam2026.devpost.com/rules

{
  printf 'artifact\turl\tretrieved_utc\n'
  printf '%s\t%s\t%s\n' "$starter_archive" "$starter_url" "$retrieved_utc"
  printf '%s\t%s\t%s\n' "$node_archive" \
    "$node_base_url/$node_archive" "$retrieved_utc"
  printf '%s\t%s\t%s\n' node-SHASUMS256.txt \
    "$node_base_url/SHASUMS256.txt" "$retrieved_utc"
  printf '%s\t%s\t%s\n' devpost-overview \
    https://tiktoktechjam2026.devpost.com/ "$retrieved_utc"
  printf '%s\t%s\t%s\n' devpost-resources \
    https://tiktoktechjam2026.devpost.com/resources "$retrieved_utc"
  printf '%s\t%s\t%s\n' devpost-rules \
    https://tiktoktechjam2026.devpost.com/rules "$retrieved_utc"
  printf '%s\t%s\t%s\n' information-document \
    https://bit.ly/TikTokTechJam2026Info not-exported
} > "$output_root/SOURCE_URLS.tsv"

(
  cd "$output_root"
  find . -type f ! -name SHA256SUMS -print0 \
    | sort -z \
    | xargs -0 shasum -a 256 > SHA256SUMS
)

printf 'Resources acquired under %s\n' "$output_root"
printf 'Starter and Node checksums verified; mutable Devpost snapshots recorded.\n'
