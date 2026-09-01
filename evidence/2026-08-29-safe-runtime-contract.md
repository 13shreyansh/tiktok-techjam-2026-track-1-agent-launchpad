# Safe local Codex Runtime contract — 2026-08-29

## Purpose and boundary

The starter-pinned `@openai/codex@0.111.0` macOS artifact remains unusable
because macOS blocked it as malware. It was not restored or bypassed. This
check evaluates a distinct, pre-existing Codex CLI bundled inside the installed
ChatGPT application. The binary is not copied, redistributed, or committed.

No provider credential was present. The configured endpoint was the
unreachable loopback address `http://127.0.0.1:1/v1`. Consequently this is a
CLI/configuration/Runner contract check, not a model call or baseline
reproduction.

## Observed local artifact

- Path: `/Applications/ChatGPT.app/Contents/Resources/codex`
- ChatGPT application: `26.825.32147` (`CFBundleVersion` `7303`)
- CLI report: `codex-cli 0.150.0-alpha.12.2`
- File type: Mach-O 64-bit executable arm64
- Size: `229,294,704` bytes
- SHA-256:
  `67ea03c98e7726eeebd161bc3bc92d8937f412f1899790a28e4ee9b80803c4d7`
- Code-signing identifier: `codex`
- Team Identifier: `2DC432GLL2`
- Signing authority: `Developer ID Application: OpenAI OpCo, LLC
  (2DC432GLL2)`
- Signing timestamp: `28 Aug 2026 at 2:06:55 PM`
- Hardened Runtime version reported by `codesign`: `15.5.0`

`codesign --verify --strict` reported that the nested executable was valid on
disk and satisfied its Designated Requirement. Deep verification of
`/Applications/ChatGPT.app` passed, and Gatekeeper assessed the containing app
as `accepted`, source `Notarized Developer ID`. Direct `spctl --type execute`
on the nested raw binary said that the code was valid but was not itself an app;
the resolver therefore verifies the nested signature and assesses the
containing application.

## Repeatable contract check

```bash
npm run verify:runtime-contract
```

The script:

1. resolves an explicit `CODEX_BIN`, or on macOS verifies the installed
   ChatGPT-bundled binary's signature, OpenAI Team Identifier, and containing
   app Gatekeeper status; explicit or `PATH` candidates are rejected without
   execution if their SHA-256 matches the exact blocked `0.111.0` artifact;
2. creates an isolated temporary `CODEX_HOME` and workspace;
3. generates the same provider-neutral Responses configuration as the app;
4. removes Ark, generic-model, and OpenAI credential variables;
5. invokes the compiled starter `CodexRunner` with its 10-second timeout and
   256 KiB output limit; and
6. deletes the temporary directory.

Observed JSON:

```json
{"available":true,"configured":false,"endpoint":"loopback-unreachable","credentialGuarded":true,"unexpectedSuccess":false,"error":"Codex exited with code 1: Missing environment variable: `MODEL_API_KEY`."}
```

The final Codex app shell did not expose standalone `node` or `npm` commands on
its default `PATH`. A direct script invocation therefore stopped first with
`Node.js is required.` (exit 2); adding only the bundled Node path then stopped
with `npm: command not found` (exit 127). The JSON above was reproduced only
after placing temporary symlinks to the installed ChatGPT-bundled Node and npm
executables on `PATH`; the temporary shim directory was deleted on exit. This
is a local shell prerequisite caveat, not an application or model failure, and
the documented `npm run ...` entrypoints still require Node.js/npm to be
installed or otherwise available on `PATH`.

This proves that the safe installed CLI accepts the starter's `exec --json`
invocation and provider configuration up to the credential boundary. It does
not prove endpoint compatibility, model behavior, a resumed thread, tool use,
or a successful Agent Run. The installed application may update; rerun this
check and record the new version/hash before a judged demonstration.

## Subsequent live result

Later the same day, `codex login status` confirmed a pre-existing ChatGPT login
without exposing its credential. An explicit local-only ChatGPT-auth mode then
used this same signed Runtime with `--ignore-user-config`. The starter
Playground returned `PLAYGROUND_OK`; a real three-Agent recovery handoff
completed `PLAN,BUILD,TEST,SHIP`; and a real three-Agent countdown completed
exact `10,9,...,1` across a browser reload. Therefore model output, JSON event
parsing, persisted thread IDs, and Relay integration are now live-proved for
this machine/account combination. See
`evidence/2026-08-29-live-chatgpt-relay.md`.

This does not change the portable contract boundary above: the ChatGPT login
was not copied into the isolated key-based home or a container, and a judge-
reproducible provider credential is still not present.
