# Validation evidence — 2026-08-26

For the released-statement and 28 August revalidation, see
[2026-08-28-release-audit.md](2026-08-28-release-audit.md).

All commands ran inside this track's ignored `workspaces/` area against an
unmodified checkout of commit
`8d0bd4f14ad1e453d984149aebcdd0bcb4f74178`. No credentials were read or
created. Times and memory values are the observed macOS `/usr/bin/time -l`
outputs.

## Host and prerequisite inventory

```text
macOS 26.6.2 (25G83), Darwin 25.6.0, arm64, Mac17,9
18 physical/logical CPUs
68,719,476,736 bytes physical memory (64 GiB)
753 GiB free on the workspace volume
git 2.50.1 (Apple Git-155)
```

The host PATH returned `command not found` for `node`, `npm`, `docker`,
`podman`, `colima`, and `terraform`. Terraform is optional for the local path;
one of Docker/Colima/Podman is required. Presence-only checks reported
`ARK_API_KEY=absent` and `ARK_MODEL=absent`; their values were never printed or
otherwise accessed.

An isolated official Node.js distribution was downloaded and verified inside
ignored `workspaces/toolchain/`:

```text
node --version -> v22.23.2
npm --version  -> 10.9.8
npx --version  -> 10.9.8
```

## Source acquisition

Commands:

```bash
git clone --filter=blob:none --no-tags \
  https://github.com/RrankPyramid/CodeJam.git \
  workspaces/CodeJam-upstream
git -C workspaces/CodeJam-upstream rev-parse HEAD
git ls-remote https://github.com/RrankPyramid/CodeJam.git \
  HEAD 'refs/heads/*' 'refs/tags/*'
curl -fsSL -o workspaces/official-downloads/CodeJam-8d0bd4f.tar.gz \
  https://github.com/RrankPyramid/CodeJam/archive/8d0bd4f14ad1e453d984149aebcdd0bcb4f74178.tar.gz
shasum -a 256 workspaces/official-downloads/CodeJam-8d0bd4f.tar.gz
```

Observed:

```text
HEAD and refs/heads/main -> 8d0bd4f14ad1e453d984149aebcdd0bcb4f74178
tags -> none
releases -> []
tree -> a6aa27caf05d15d6d4326a76fa7243df5c10942d
archive SHA-256 -> a71aa56bca1a6ba388973079370f44af8bff88bccd8f2fdb5dad30a43bfe7b31
archive bytes -> 143348
```

## Dependency installation

Environment used:

```bash
export PATH="$PWD/workspaces/toolchain/node22/bin:$PATH"
export npm_config_cache="$PWD/workspaces/npm-cache"
cd workspaces/CodeJam-upstream
/usr/bin/time -l npm ci
```

Observed result: exit 0; 196 packages added and 199 audited. npm reported 6
findings (1 moderate, 5 high). No automated fix was applied.

```text
real 1.59 s; user 1.39 s; sys 1.98 s
maximum resident set size 231,538,688 bytes
peak memory footprint 195,923,096 bytes
```

`git status --short --branch` remained `## main...origin/main`.

## Unmodified static/test/build baseline

Command:

```bash
/usr/bin/time -l npm run check
```

Observed result: exit 0.

- TypeScript typecheck passed for server and web workspaces.
- Vitest: 5 test files passed; 12 tests passed; duration 330 ms.
- Vite production web build passed: 30 modules transformed.
- Server TypeScript build passed.

```text
real 4.36 s; user 7.31 s; sys 0.70 s
maximum resident set size 290,013,184 bytes
peak memory footprint 25,250,720 bytes
```

The upstream checkout remained clean after the command. Generated
`node_modules/` and `dist/` content stays under ignored `workspaces/`.

## Live POC acceptance attempt

Command, with both credential variables absent:

```bash
/usr/bin/time -l npm run poc
```

Observed result: exit 2.

```text
[local-poc] ARK_API_KEY and ARK_MODEL are required.
[local-poc] Example: ARK_API_KEY=key ARK_MODEL=ep-id ./scripts/start-local-poc.sh
real 0.47 s; user 0.05 s; sys 0.02 s
maximum resident set size 66,813,952 bytes
peak memory footprint 25,283,536 bytes
```

The script stopped before dependency installation, Runtime image build, server
startup, browser CRUD, Playground execution, or any network model call. Because
Ark credentials are absent and no supported container engine is installed,
the interactive baseline is **not reproduced**.

## Upstream recheck

At `2026-08-26 21:12 SGT`, the ignored checkout was refreshed without merging
or modifying it:

```bash
git -C workspaces/CodeJam-upstream fetch --prune origin
git -C workspaces/CodeJam-upstream rev-parse HEAD origin/main
git ls-remote --heads --tags https://github.com/RrankPyramid/CodeJam.git
```

Observed: local `HEAD`, `origin/main`, and remote `refs/heads/main` all remained
`8d0bd4f14ad1e453d984149aebcdd0bcb4f74178`; no tag was returned. The checkout
remained clean.

## Acquisition revalidation

After adding the starter-pinned Codex package to the acquisition manifest:

```bash
bash -n scripts/acquire-official-resources.sh
/usr/bin/time -l scripts/acquire-official-resources.sh
```

Observed at `2026-08-26T13:15:33Z`: exit 0. The script reverified the starter,
official Node distribution, and `@openai/codex@0.111.0`, then captured fresh
ignored Devpost snapshots and rewrote the ignored retrieval manifest.

```text
real 6.73 s; user 0.45 s; sys 0.16 s
maximum resident set size 7,995,392 bytes
peak memory footprint 1,655,096 bytes
```

## Focused test-coverage recheck

Two initial wrapper attempts did not run Vitest: the first constructed the
toolchain path from the upstream repository root and `/usr/bin/time` could not
find `npm`; the second used a relative PATH entry that stopped resolving after
npm changed into the server workspace, so the lifecycle exited 127 with
`env: node: No such file or directory`. Neither is counted as a test result.

```bash
# Attempt 1: failed before npm started.
export PATH="$(git rev-parse --show-toplevel)/workspaces/toolchain/node22/bin:$PATH"
export npm_config_cache="$(git rev-parse --show-toplevel)/workspaces/npm-cache"
/usr/bin/time -l npm test

# Attempt 2: npm started, but the workspace lifecycle could not resolve node.
export PATH="../toolchain/node22/bin:$PATH"
export npm_config_cache="../npm-cache"
/usr/bin/time -l npm test
```

The corrected command used absolute isolated paths:

```bash
export PATH="/Users/shreyansh/Documents/ChatGPT/TikTok Tech Jam/tracks/track-1-agent-launchpad/workspaces/toolchain/node22/bin:$PATH"
export npm_config_cache="/Users/shreyansh/Documents/ChatGPT/TikTok Tech Jam/tracks/track-1-agent-launchpad/workspaces/npm-cache"
/usr/bin/time -l npm test
```

Observed at `2026-08-26 21:18 SGT`: exit 0; 5 test files and all 12 tests
passed in 352 ms. The focused command did not run typechecking or builds.

```text
real 0.67 s; user 0.88 s; sys 0.24 s
maximum resident set size 120,143,872 bytes
peak memory footprint 25,349,024 bytes
```

## Dependency advisory recheck

Commands:

```bash
export PATH="/Users/shreyansh/Documents/ChatGPT/TikTok Tech Jam/tracks/track-1-agent-launchpad/workspaces/toolchain/node22/bin:$PATH"
export npm_config_cache="/Users/shreyansh/Documents/ChatGPT/TikTok Tech Jam/tracks/track-1-agent-launchpad/workspaces/npm-cache"
npm audit --json
for name in @fastify/static find-my-way fast-uri brace-expansion nanoid postcss; do
  npm explain "$name"
done
```

Observed: `npm audit` exited 1 and again reported 6 affected packages (1
moderate, 5 high, 0 critical). `npm explain` confirmed which packages occur in
the production Fastify/static tree and which occur through the Vite build/test
tree. Exact versions, advisory URLs, paths, and bounded reachability notes are
recorded in `docs/DEPENDENCY_AUDIT.md`. No fix or package mutation was run.

## Devpost snapshot comparison

The initial and `2026-08-26T13:15:33Z` ignored HTML snapshots were converted
to visible text and diffed without writing derived files:

```bash
for page in overview resources rules; do
  old="artifacts/official/devpost/${page}-20260826T115620Z.html"
  new="artifacts/official/devpost/${page}-20260826T131533Z.html"
  diff -u <(textutil -convert txt -stdout "$old") \
    <(textutil -convert txt -stdout "$new")
done
```

Observed: each page changed only its displayed participant count from 2,876
to 2,881. No visible rule, requirement, resource, or date changed between those
two captured responses.

## Expanded recurring acquisition

The acquisition script was updated to reuse already checksum-verified
immutable downloads and to snapshot the official Devpost Updates and
Discussions pages. Validation command:

```bash
bash -n scripts/acquire-official-resources.sh
/usr/bin/time -l scripts/acquire-official-resources.sh
```

Observed at `2026-08-26T13:22:53Z`: exit 0. The starter, Node archive, and
Codex wrapper were reused only after their SHA-256 values matched; five mutable
Devpost pages were retrieved. Visible text in Updates said only to stay tuned
for announcements, and Discussions said no topics had been created.

```text
real 6.48 s; user 0.26 s; sys 0.07 s
maximum resident set size 7,897,088 bytes
peak memory footprint 1,638,712 bytes
```

## Deployment trust-boundary inspection

An initial zsh loop that included the unmatched glob
`deploy/volcengine/*.sh` stopped before printing file contents with `no matches
found`; it produced no deployment evidence. The corrected read-only inventory
used `find` and `sed`, followed by direct inspection of Runner/config/security
files:

```bash
find . -maxdepth 3 -type f \
  \( -name 'Dockerfile*' -o -name 'docker-compose.yml' \
  -o -name '.env.example' -o -path './scripts/*' \
  -o -path './deploy/volcengine/*' \) -print | sort |
while IFS= read -r file; do
  echo "$file"
  sed -n '1,420p' "$file"
done

sed -n '1,420p' apps/server/src/container-codex-runner.ts
sed -n '1,360p' apps/server/src/codex-runner.ts
sed -n '1,320p' apps/server/src/config.ts
sed -n '1,280p' SECURITY.md
sed -n '1,300p' docs/DEPLOYMENT.md
sed -n '1,300p' docs/LOCAL_POC.md
```

Observed results are reconciled in `docs/DEPLOYMENT_TRUST_BOUNDARIES.md`. No
image, container, Terraform provider, or cloud resource was created.

## Data-contract inspection

Read-only commands:

```bash
sed -n '1,420p' apps/server/src/types.ts
sed -n '1,520p' apps/server/src/agent-service.ts
sed -n '1,360p' apps/server/src/store.ts
sed -n '1,340p' apps/server/src/workspace.ts
sed -n '1,340p' apps/web/src/types.ts
sed -n '1,380p' apps/web/src/api.ts
sed -n '1,285p' apps/web/src/App.tsx
sed -n '450,610p' apps/web/src/App.tsx
```

Observed schemas, transitions, persistence duplication, archival-delete
behavior, browser polling/projection, and missing track-specific data are
reconciled in `docs/BASELINE_DATA_CONTRACT.md`. No Runtime state or database
record was created or changed.

The script was then extended to preserve the three public Devpost help pages
linked from the organizer information document. The same syntax and timed-run
commands completed at `2026-08-26T13:24:11Z` with exit 0; cached immutable
artifacts again matched before reuse, and eight mutable event/help pages were
retrieved.

```text
real 8.99 s; user 0.26 s; sys 0.06 s
maximum resident set size 7,897,088 bytes
peak memory footprint 1,638,712 bytes
```

## Official platform-contract inspection

First-party Ark and veFaaS pages named by the starter were checked without a
login. The raw retrieval check followed redirects, discarded content, and
reported final URL and byte count; a second request streamed each response to
`shasum -a 256`:

```bash
curl -fsSL --compressed -o /dev/null \
  -w '%{http_code}\t%{url_effective}\t%{size_download}\n' "$url"
curl -fsSL --compressed "$url" | shasum -a 256
```

All five URLs returned HTTP 200. The two Ark pages redirected to
`docs.volcengine.com`; their anonymous HTML responses were only 3,179 and
3,186 bytes. The veFaaS overview/CreateSandbox HTML responses were 23,312 and
23,338 bytes; the Cloud Sandbox guide response was 2,143 bytes. These are
client-rendered shells, so their hashes were not treated as content versions.

The official pages were then inspected in an anonymous browser. Observed:

- Ark documented `/api/v3/responses`, `tools`, `function_call`, `call_id`,
  `function_call_output`, and `previous_response_id`; its tool page showed last
  update `2026-08-04 11:36:35`.
- IAM recommended the dedicated Ark model API key rather than traditional
  cloud AK/SK for model inference; the page showed last update
  `2025-06-23 19:21:32`.
- The veFaaS catalog showed version `2024-06-06` and explicit create, kill,
  list, describe, timeout, pause, resume, image, and snapshot surfaces.
- CreateSandbox showed update `2026-08-25 17:35:09`, requires `FunctionId`,
  returns `SandboxId`, and exposes the bounded instance controls recorded in
  `docs/OFFICIAL_PLATFORM_CONTRACTS.md`.

Source inspection used `rg` plus `apps/server/src/config.ts` and
`apps/server/src/codex-runner.ts`. It confirmed the starter's Ark Responses
configuration and absence of any veFaaS client/configuration. No credential,
model request, API Explorer debug call, or sandbox operation was performed.

After extending the ignored acquisition manifest with those five URLs, the
same syntax and timed-run validation completed at `2026-08-26T13:33:16Z` with
exit 0. The starter, Node, and Codex files matched their pinned SHA-256 values
before reuse, and all event/help/platform snapshots were retrieved.

```text
real 17.31 s; user 0.39 s; sys 0.17 s
maximum resident set size 8,126,464 bytes
peak memory footprint 1,671,480 bytes
```

## Operator-journey and screenshot inspection

Read-only source inventory and inspection:

```bash
find workspaces/CodeJam-upstream/apps -type f \
  -not -path '*/node_modules/*' -not -path '*/dist/*' -print | sort
sed -n '1,460p' apps/server/src/app.ts
sed -n '1,560p' apps/server/src/agent-service.ts
sed -n '1,700p' apps/web/src/App.tsx
sed -n '1,220p' apps/web/src/api.ts
sed -n '1,180p' apps/web/src/types.ts
```

The route constraints, status/conflict behavior, polling flow, browser-visible
states, and absent evidence fields are recorded in
`docs/BASELINE_OPERATOR_JOURNEY.md`. This was source inspection, not a live
browser reproduction claim.

The two organizer screenshots were visually inspected at original resolution,
then checked without modification:

```bash
shasum -a 256 docs/assets/create-agent.jpg docs/assets/playground.jpg
sips -g pixelWidth -g pixelHeight -g format \
  docs/assets/create-agent.jpg docs/assets/playground.jpg
git status --short
```

Both were 1280x720 JPEGs with the hashes recorded in provenance. The ignored
upstream checkout remained clean. They show creation and the empty Playground,
not a completed, failed, cancelled, or resumed live Run.

The exact HTTP-boundary and service-lifecycle test files supporting the table
were re-run with the isolated toolchain:

```bash
/usr/bin/time -l npm run test -w @launchpad/server -- \
  src/app.test.ts src/agent-service.test.ts
```

Observed at `2026-08-26 21:36 SGT`: exit 0; both files and all 6 tests passed in
341 ms. These remain Fastify-injection/fake-Runner tests, not a browser,
container, Codex, or Ark result.

```text
real 0.71 s; user 0.59 s; sys 0.17 s
maximum resident set size 119,193,600 bytes
peak memory footprint 27,397,288 bytes
```

At the same check, the public Devpost Updates page still contained no organizer
post and Discussions still reported no topics. The Resources page continued
to link only the existing information/registration/privacy/Devpost/Telegram
surfaces; no new public statement artifact was listed.

## Supply-chain identity inspection

The starter Dockerfiles, Compose file, cloud-init template, deployment scripts,
Terraform version constraint, variables, and lockfile were inspected with
numbered `sed` output. No image was pulled or built and no provider was
installed.

For the public Docker Official Image, an anonymous pull-scoped token was
requested from `auth.docker.io`, used only in memory, and never printed. `HEAD`
and `GET` requests to Registry v2 resolved the OCI index and its AMD64/ARM64
manifests. Each downloaded manifest JSON was streamed to `shasum -a 256`; the
observed values matched the Registry digests. Only the small index, manifests,
and configuration JSON were retrieved; the five image layers were not.

The index resolved to
`sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5`.
Platform digests, configuration digests, timestamps, Node/Yarn versions, and
compressed layer totals are recorded in `docs/BASELINE_SUPPLY_CHAIN.md`.

An initial zsh loop attempted `set -- $spec`; zsh did not split the scalar and
exited before a manifest result with `zsh:7: 2: parameter not set`. The
corrected read-only loop used `read -r architecture manifest_digest <<<
"$spec"` and completed for both platforms.

Terraform Registry metadata was queried for `volcenginecc` `0.0.58` on macOS
ARM64, Linux AMD64, and Linux ARM64. Each returned archive hash matched an
entry already present in the upstream `.terraform.lock.hcl`; the GitHub release
API independently reported the same hashes and sizes. `git ls-remote` resolved
release tag `v0.0.58` to
`161f3df395e853cf00b733454c1415601b209a2d`. The MPL-2.0 source licence was
read and hashed but not copied or modified.

Local prerequisite recheck:

```text
terraform  absent
docker     absent
podman     absent
colima     absent
```

Therefore no Terraform initialization/plan/apply, container build, image
inspection, provider execution, or cloud call occurred.

## Runtime protocol and failure inspection

The full local-process Runner, Container Runner, factory, server shutdown path,
local POC cleanup trap, and both Runner test files were read with numbered
output. The exact invocation, environment, parser projection, byte/time limits,
error precedence, signals/removal calls, restart mutation, and missing cleanup
verification are recorded in `docs/BASELINE_RUNTIME_FAILURES.md`.

Focused test command:

```bash
/usr/bin/time -l npm run test -w @launchpad/server -- \
  src/codex-runner.test.ts src/container-codex-runner.test.ts
```

Observed at `2026-08-26 21:40 SGT`: exit 0; 2 files and all 5 tests passed in
115 ms.

```text
real 0.41 s; user 0.42 s; sys 0.08 s
maximum resident set size 116,965,376 bytes
peak memory footprint 27,282,552 bytes
```

Those tests did not start a child Runtime. A separate read-only `node
--input-type=module -e` probe imported the existing compiled parser and passed
synthetic JSONL strings. Its exact output is preserved in the Runtime audit;
it confirms projection behavior only.

Pinned Codex source files `exec/src/lib.rs`,
`event_processor_with_jsonl_output.rs`, and `exec_events.rs` were streamed from
commit `8c75cd9afcd405d134530e53c78e5e0e4e5312a3`. They confirmed fatal-error exit
handling and the richer JSONL schema. No source file was altered or executed.
An initial inspection command temporarily wrote four streamed source files
under `/tmp`; they were subsequently unlinked and their absence verified.

The ignored upstream checkout remained clean. No Codex process, container,
model call, cancellation, timeout, overflow, or shutdown branch was executed,
so none is reported as reproduced.

## Agent instruction-boundary inspection

Read-only inspection covered `workspace.ts`, `agent-service.ts`, `store.ts`,
both Runner implementations, configuration generation, and the related
unmodified tests. The matching OpenAI tag was independently resolved:

```bash
git ls-remote https://github.com/openai/codex.git \
  'refs/tags/rust-v0.111.0' 'refs/tags/rust-v0.111.0^{}'
```

Observed: annotated tag object
`36ab739252724325262726dff8fbbcb26c2447ad` peeled to source commit
`8c75cd9afcd405d134530e53c78e5e0e4e5312a3`, matching the already recorded
Runtime provenance.

The pinned source archive was streamed into an ignored temporary directory
inside this track solely for `rg`/`sed` inspection. `project_doc.rs`,
`config/mod.rs`, and `codex.rs` confirmed global/project instruction discovery,
the 32 KiB default project-document budget, instruction loading during every
new Codex process spawn, and current-context injection on the first resumed
turn. The current official OpenAI `AGENTS.md` guide was also read; pinned
source, not the mutable guide, is used for baseline claims. The temporary
source tree was moved under ignored `workspaces/codex-source-audit-8c75cd9/`;
it is not a tracked preparation artefact.

Focused baseline test command:

```bash
/usr/bin/time -l npm run test -w @launchpad/server -- \
  src/agent-service.test.ts src/store.test.ts
```

Observed at `2026-08-26 21:47 SGT`: exit 0; 2 files and all 5 tests passed in
298 ms.

```text
real 0.52 s; user 0.45 s; sys 0.10 s
maximum resident set size 118,423,552 bytes
peak memory footprint 27,413,672 bytes
```

Those tests use a fake Runner and do not read back `AGENTS.md`, start Codex, or
exercise a file/store divergence. The exact representations, update ordering,
writable drift path, and bounded challenge implications are recorded in
`docs/BASELINE_AGENT_INSTRUCTION_BOUNDARY.md`. No instruction file in an Agent
workspace was modified and no live model or resume call was made.
