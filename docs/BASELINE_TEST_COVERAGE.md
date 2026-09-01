# Baseline test coverage and evidence limits

Source: unmodified organizer starter commit
`8d0bd4f14ad1e453d984149aebcdd0bcb4f74178`. This is a preparation audit of
existing evidence, not a judged test plan or solution design.

## What the 12 tests prove

| Source test | Directly exercised | Evidence boundary |
| --- | --- | --- |
| Agent lifecycle | Service-level create, update, stop, start, and delete | Uses in-process service objects and a fake Runner; does not use HTTP, browser, container, Codex, or Ark. |
| Playground conversation | User/assistant message persistence and Codex thread ID persistence | Fake Runner returns a fixed result; does not prove a model call, resumable real session, or browser polling. |
| Concurrent Runs | Only one message/Run is accepted per Agent under concurrent service calls | In-process pending promise; no process, persistence-restart, or distributed concurrency. |
| Start while busy | `start` and a second message return conflict while a Run is pending | In-process service behavior only. |
| Shared token | Missing bearer token is denied and the configured token is allowed | Fastify injection only; the upstream architecture explicitly says this token is not user identity or authorization. |
| Client errors | Malformed JSON returns 400 and an oversized body returns 413 | Two request-shape cases; not a general input-security or abuse test. |
| Container invocation | Generated argv contains mounts, user, label, image, and `workspace-write`; secret value is absent from argv | Pure argv construction; no container is started and no isolation, network, cleanup, or protected-asset behavior is observed. |
| Container resume | Resume argv includes the stored thread ID | Pure argv construction; no Runtime session is resumed. |
| Codex new session | Generated `codex exec --json` argv is correct | Pure argv construction; Codex is not launched. |
| Codex resume | Generated resume argv includes the thread ID and prompt | Pure argv construction; Codex is not launched. |
| Codex parser | Synthetic thread, final-message, and usage events are extracted | Does not exercise the pinned CLI or cover command/file/tool items, `turn.failed`, malformed streams, redaction, or output truncation. |
| Store failure | A failed disk write does not publish the mutation in memory, and a later write can succeed | One injected missing-directory failure; not crash consistency, concurrent processes, corruption recovery, or durability after power loss. |

## Organizer acceptance evidence not supplied by the baseline tests

| Acceptance claim | Baseline test evidence |
| --- | --- |
| Browser Create Agent and Playground journey works | None; there are no web tests or browser end-to-end tests. |
| Disposable Runtime container builds and starts | None; container tests inspect argv only. |
| Codex `0.111.0` communicates with the configured Ark Responses endpoint | None. |
| A later message resumes the same real Codex session | None; only argv and fake-thread persistence are tested. |
| Cancellation stops a real process/container and cleanup completes | None. |
| Restart converts interrupted Runs to `cancelled` | None. |
| Logs, stored events, browser state, screenshots, and model output contain no secrets | Partial only: one synthetic Ark secret is absent from generated container argv. |
| Released trace/audit example evidence | None: no correlated Trace/Span model, step timeline, failure diagnosis, or redaction test. |
| Released identity/authorization example evidence | None: no human or Agent principal, ownership policy, cross-user denial, tamper test, or revocation. |
| Released threat/safety example evidence | None: no malicious execution, protected asset, new control, termination evidence, cleanup proof, or later safe Run. |

## Correct interpretation of the green check

`npm run check` proves the TypeScript projects compile, the 12 narrow tests
above pass, and both production builds complete. It does **not** reproduce the
organizer's live baseline or satisfy the released universal acceptance gates.
A live claim still requires the documented container, Codex, Ark, browser,
and normal/adverse path to succeed with observed evidence.
