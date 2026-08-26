# Preparation status

Last verified: **2026-08-26 19:54 SGT**

## Outcome

Preparation is complete to the limit of the available public resources and
local environment. The organizer-provided starter source is pinned and
recoverable, its architecture and licence are recorded, and its unmodified
static/test/build validation succeeds. The interactive Agent CRUD/Playground
acceptance path is **blocked and not reproduced**.

## Allowed preparation

- [x] Preserve official starter URLs, commit, archive checksum, and MIT licence
- [x] Cache public starter/submission resources in an ignored workspace
- [x] Record prerequisite and host versions
- [x] Run the unmodified `npm run check` validation
- [ ] Reproduce the live Agent CRUD/Playground acceptance path
- [x] Record exact commands, results, resource use, and blockers
- [x] Keep credentials, caches, downloaded archives, and generated output ignored

## Ready inventory

- Starter commit: `8d0bd4f14ad1e453d984149aebcdd0bcb4f74178`
- Starter Git tree: `a6aa27caf05d15d6d4326a76fa7243df5c10942d`
- Re-acquisition script with immutable archive verification
- Preserved upstream MIT licence
- Architecture, runtime profiles, persistence paths, security limits, and
  organizer acceptance steps documented
- Isolated Node.js `v22.23.2` / npm `10.9.8` toolchain cached under ignored
  `workspaces/`
- `npm ci`: succeeded; upstream checkout remained clean
- `npm run check`: succeeded; 5 test files and 12 tests passed; web and server
  builds succeeded

## Blockers

1. `ARK_API_KEY` and `ARK_MODEL` are absent. The unmodified `npm run poc`
   command exited 2 before startup. No placeholder or unrelated credential was
   supplied. The upstream statement says organizers provide a prepared Ark key
   and endpoint ID and includes that provision in its unchecked organizer
   readiness checklist; no such credential was available in this environment.
2. Docker, Colima, and Podman are not installed, so the disposable local Agent
   Runtime cannot be built or started.
3. The public information document, last updated 25 August, lists the five
   focus areas but says detailed problem statements release publicly on
   27 August at 12:00 SGT. It is public in the browser but anonymous HTTP export
   enters a Lark/Feishu guest-login redirect loop, so no versioned document
   export or checksum was available.
4. `npm ci` reported 6 dependency audit findings (1 moderate, 5 high). No
   `npm audit fix` was run because it would modify the organizer lockfile and
   cease to be an unmodified baseline.

The unit/build result is not evidence of live Playground operation or a
successful Ark model call.

## Deferred until the challenge window

- Team-designed middleware
- Judged architecture changes
- Competition demo and submission implementation
