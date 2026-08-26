# Validation evidence — 2026-08-26

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
