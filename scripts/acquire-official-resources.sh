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

codex_version="0.111.0"
codex_archive="codex-${codex_version}.tgz"
codex_url="https://registry.npmjs.org/@openai/codex/-/${codex_archive}"
codex_sha256="6ab44ce79c2fd73cca0b181c726310074aaf37c7813d6c6bc6b6ff1e2d8099af"

mkdir -p "$output_root/starter" "$output_root/node" "$output_root/codex" \
  "$output_root/devpost" "$output_root/devpost-help" \
  "$output_root/platform-references"

fetch_verified_sha256() {
  local label="$1"
  local url="$2"
  local destination="$3"
  local expected="$4"
  local observed=""

  if [[ -f "$destination" ]]; then
    observed="$(shasum -a 256 "$destination" | awk '{print $1}')"
  fi
  if [[ "$observed" == "$expected" ]]; then
    printf '%s already cached and verified.\n' "$label"
    return
  fi

  curl -fsSL -o "$destination" "$url"
  observed="$(shasum -a 256 "$destination" | awk '{print $1}')"
  if [[ "$observed" != "$expected" ]]; then
    printf '%s checksum mismatch: expected %s, observed %s\n' \
      "$label" "$expected" "$observed" >&2
    return 1
  fi
}

fetch_verified_sha256 Starter "$starter_url" \
  "$output_root/starter/$starter_archive" "$starter_sha256"

tar -xOf "$output_root/starter/$starter_archive" \
  "CodeJam-${starter_commit}/LICENSE" > "$output_root/starter/LICENSE"

curl -fsSL -o "$output_root/node/SHASUMS256.txt" \
  "$node_base_url/SHASUMS256.txt"
published_node_sha="$(awk -v name="$node_archive" '$2 == name {print $1}' \
  "$output_root/node/SHASUMS256.txt")"
if [[ -z "$published_node_sha" ]]; then
  printf 'Node checksum is absent from the published manifest.\n' >&2
  exit 1
fi
fetch_verified_sha256 Node "$node_base_url/$node_archive" \
  "$output_root/node/$node_archive" "$published_node_sha"

fetch_verified_sha256 Codex "$codex_url" \
  "$output_root/codex/$codex_archive" "$codex_sha256"

curl -fsSL --compressed -o "$output_root/devpost/overview-${retrieved_utc}.html" \
  https://tiktoktechjam2026.devpost.com/
curl -fsSL --compressed -o "$output_root/devpost/resources-${retrieved_utc}.html" \
  https://tiktoktechjam2026.devpost.com/resources
curl -fsSL --compressed -o "$output_root/devpost/rules-${retrieved_utc}.html" \
  https://tiktoktechjam2026.devpost.com/rules
curl -fsSL --compressed -o "$output_root/devpost/updates-${retrieved_utc}.html" \
  https://tiktoktechjam2026.devpost.com/updates
curl -fsSL --compressed -o "$output_root/devpost/discussions-${retrieved_utc}.html" \
  https://tiktoktechjam2026.devpost.com/forum_topics
curl -fsSL --compressed -o "$output_root/devpost-help/enter-${retrieved_utc}.html" \
  https://help.devpost.com/article/122-how-to-enter-a-submission
curl -fsSL --compressed -o "$output_root/devpost-help/steps-${retrieved_utc}.html" \
  https://help.devpost.com/article/126-know-your-submission-steps
curl -fsSL --compressed -o "$output_root/devpost-help/edit-${retrieved_utc}.html" \
  https://help.devpost.com/article/123-how-to-edit-a-submission
curl -fsSL --compressed -o "$output_root/platform-references/ark-tools-${retrieved_utc}.html" \
  'https://www.volcengine.com/docs/82379/1958524?lang=zh'
curl -fsSL --compressed -o "$output_root/platform-references/ark-key-guidance-${retrieved_utc}.html" \
  'https://www.volcengine.com/docs/6257/64983?lang=en'
curl -fsSL --compressed -o "$output_root/platform-references/vefaas-api-overview-${retrieved_utc}.html" \
  'https://api.volcengine.com/api-docs/view/overview?serviceCode=vefaas&version=2024-06-06'
curl -fsSL --compressed -o "$output_root/platform-references/vefaas-create-sandbox-${retrieved_utc}.html" \
  'https://api.volcengine.com/api-docs/view?action=CreateSandbox&serviceCode=vefaas&version=2024-06-06'
curl -fsSL --compressed -o "$output_root/platform-references/vefaas-cloud-sandbox-${retrieved_utc}.html" \
  https://www.volcengine.com/docs/6662/2278468

{
  printf 'artifact\turl\tretrieved_utc\n'
  printf '%s\t%s\t%s\n' "$starter_archive" "$starter_url" "$retrieved_utc"
  printf '%s\t%s\t%s\n' "$node_archive" \
    "$node_base_url/$node_archive" "$retrieved_utc"
  printf '%s\t%s\t%s\n' node-SHASUMS256.txt \
    "$node_base_url/SHASUMS256.txt" "$retrieved_utc"
  printf '%s\t%s\t%s\n' "$codex_archive" "$codex_url" "$retrieved_utc"
  printf '%s\t%s\t%s\n' devpost-overview \
    https://tiktoktechjam2026.devpost.com/ "$retrieved_utc"
  printf '%s\t%s\t%s\n' devpost-resources \
    https://tiktoktechjam2026.devpost.com/resources "$retrieved_utc"
  printf '%s\t%s\t%s\n' devpost-rules \
    https://tiktoktechjam2026.devpost.com/rules "$retrieved_utc"
  printf '%s\t%s\t%s\n' devpost-updates \
    https://tiktoktechjam2026.devpost.com/updates "$retrieved_utc"
  printf '%s\t%s\t%s\n' devpost-discussions \
    https://tiktoktechjam2026.devpost.com/forum_topics "$retrieved_utc"
  printf '%s\t%s\t%s\n' devpost-help-enter \
    https://help.devpost.com/article/122-how-to-enter-a-submission "$retrieved_utc"
  printf '%s\t%s\t%s\n' devpost-help-steps \
    https://help.devpost.com/article/126-know-your-submission-steps "$retrieved_utc"
  printf '%s\t%s\t%s\n' devpost-help-edit \
    https://help.devpost.com/article/123-how-to-edit-a-submission "$retrieved_utc"
  printf '%s\t%s\t%s\n' information-document \
    https://bit.ly/TikTokTechJam2026Info not-exported
  printf '%s\t%s\t%s\n' ark-responses-tool-calling \
    'https://www.volcengine.com/docs/82379/1958524?lang=zh' "$retrieved_utc"
  printf '%s\t%s\t%s\n' ark-key-guidance \
    'https://www.volcengine.com/docs/6257/64983?lang=en' "$retrieved_utc"
  printf '%s\t%s\t%s\n' vefaas-api-overview \
    'https://api.volcengine.com/api-docs/view/overview?serviceCode=vefaas&version=2024-06-06' "$retrieved_utc"
  printf '%s\t%s\t%s\n' vefaas-create-sandbox \
    'https://api.volcengine.com/api-docs/view?action=CreateSandbox&serviceCode=vefaas&version=2024-06-06' "$retrieved_utc"
  printf '%s\t%s\t%s\n' vefaas-cloud-sandbox \
    https://www.volcengine.com/docs/6662/2278468 "$retrieved_utc"
} > "$output_root/SOURCE_URLS.tsv"

(
  cd "$output_root"
  find . -type f ! -name SHA256SUMS -print0 \
    | sort -z \
    | xargs -0 shasum -a 256 > SHA256SUMS
)

printf 'Resources acquired under %s\n' "$output_root"
printf 'Starter, Node, and Codex checksums verified; mutable public snapshots recorded.\n'
