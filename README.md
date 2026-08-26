# Agent Launchpad Middleware — Preparation Repository

Private preparation repository for the TikTok TechJam 2026 Agent Launchpad
track.

The local directory name uses `track-1` as its isolated task label. The pinned
upstream statement itself labels the challenge **“CodeJam Track #5 v2”** and
places it in the **Platform Middleware** focus area; this repository does not
reinterpret that organizer numbering.

## Preparation scope

- Preserve and index the official starter kit.
- Validate the documented local runtime prerequisites.
- Reproduce the unmodified Agent CRUD and Playground baseline when credentials
  and container tooling permit.
- Record architecture, extension seams, commands, evidence, and blockers.

No judged middleware capability is implemented in this preparation snapshot.
Substantive competition implementation begins no earlier than
**2026-08-29 12:00 SGT**.

Official starter kit: <https://github.com/RrankPyramid/CodeJam>

## Preparation snapshot

The organizer-provided starter is pinned to commit
`8d0bd4f14ad1e453d984149aebcdd0bcb4f74178`. The unmodified typecheck,
test, and build pipeline passes locally. The live Agent CRUD/Playground path is
not reproduced because this machine currently has neither a supported
container engine nor the required Volcengine Ark credentials.

- [Preparation status](PREPARATION_STATUS.md)
- [Official resource provenance](provenance/OFFICIAL_RESOURCES.md)
- [Upstream architecture](docs/UPSTREAM_ARCHITECTURE.md)
- [Validation evidence](evidence/2026-08-26-validation.md)
- [Reproducible resource acquisition](scripts/acquire-official-resources.sh)

Downloaded archives, dependency trees, caches, logs, generated builds, runtime
state, and credentials remain untracked. No judged middleware solution is
present in this repository.
