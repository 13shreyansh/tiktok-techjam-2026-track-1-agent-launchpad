# Baseline Runtime protocol, failure, and cleanup behavior

Inspected on **2026-08-26 21:42 SGT** at upstream commit
`8d0bd4f14ad1e453d984149aebcdd0bcb4f74178`. This is a factual audit of
the unmodified Runners, not a judged Runtime design.

## Invocation boundary

Both Runners construct:

```text
codex exec --json --sandbox <mode> --skip-git-repo-check -C <workspace> <prompt>
codex exec --json --sandbox <mode> --skip-git-repo-check -C <workspace> resume <thread> <prompt>
```

The prompt and resume thread ID are command arguments. In local-process mode
they can be visible through the host process table. In container mode they are
arguments to the host container-engine process and are also represented in
the container command. The Ark key is not placed in the argument array: it is
passed through the child environment, and container mode uses `--env
ARK_API_KEY` to copy it into the container.

Local-process mode inherits only an allowlist of path/home/locale, certificate,
proxy, and terminal variables. Container mode gives the engine process a
smaller host allowlist, then mounts the selected Agent workspace and the shared
Codex home. The same Codex home stores resumable sessions for all Agents in the
Launchpad instance.

## JSONL projection

The pinned Codex CLI emits typed thread, turn, item, error, and usage events.
The Launchpad parser consumes only:

| Codex JSONL event | Launchpad projection |
| --- | --- |
| `thread.started` | replaces the stored thread ID |
| completed `agent_message` item | appends its text to an in-memory list |
| `turn.completed` | retains numeric input/cached/output token fields |
| top-level `error` | retains a string `message` or string `error` |

At process completion, only the last assistant message, last parsed usage, and
current thread ID are returned. Earlier assistant messages and all command,
file-change, reasoning, MCP, web-search, todo, warning, item-error,
`item.started`, `item.updated`, and `turn.failed` content are discarded.

Malformed/non-JSON lines are silently ignored. A top-level error whose `error`
field is an object instead of a string becomes `Codex reported an unknown
error`. A `turn.completed` object with some nonnumeric counters produces a
partial usage object. None of these projection losses produces a warning or
metric of its own.

The pinned Codex source itself records fatal `EventMsg::Error` events and exits
nonzero after the event loop. Its JSONL processor emits a top-level `error` and,
if turn completion follows the stored critical error, a `turn.failed` event.
The Launchpad normally obtains the useful message from the top-level
event/nonzero exit even though it ignores `turn.failed`. Source:
<https://github.com/openai/codex/blob/8c75cd9afcd405d134530e53c78e5e0e4e5312a3/codex-rs/exec/src/lib.rs>.

## Limits and error precedence

Both Runners count combined raw stdout and stderr bytes. The default limit is
2,097,152 bytes. Exceeding it terminates execution; stderr is separately
retained only as its last 16,384 JavaScript characters. The default wall-clock
timeout is 600,000 ms.

After the child closes, conditions are evaluated in this order:

1. explicit cancellation -> `RunCancelledError`;
2. timeout -> `Codex timed out...` locally or `Runtime timed out...` in a
   container;
3. combined-output overflow -> `Codex output exceeded
   CODEX_MAX_OUTPUT_BYTES`;
4. nonzero exit -> last parsed top-level error, otherwise retained stderr,
   otherwise `No error detail`;
5. zero exit without a completed assistant message -> `Codex completed without
   an agent message`.

This precedence means a cancelled execution is recorded as cancellation even
if termination also causes a nonzero exit. Timeout and output overflow are
stored as generic failed Runs. Partial messages/events parsed before a failure
are not persisted.

## Process and container cleanup

### Local-process Runner

- One child is tracked per Agent in one server process.
- Cancel, timeout, or output overflow sends `SIGTERM`, then `SIGKILL` after
  three seconds if the direct child remains.
- Signals target the spawned Codex process, not an explicitly created process
  group; the source does not enumerate or verify termination of descendants.
- Availability checks only `codex --version` with a five-second timeout. They
  do not test Ark authentication, the selected model, workspace access,
  sandbox enforcement, or a model turn.

### Container Runner

- Availability checks engine `version` and image `inspect`; it does not run a
  smoke container or Codex/Ark request.
- Normal execution relies on `--rm`; cancellation, timeout, and overflow call
  `engine rm --force <deterministic-name>` with an eight-second timeout.
- Any remove error is swallowed, after which only the engine client child is
  signalled. There is no subsequent `inspect` or label query proving that the
  container no longer exists.
- The local POC wrapper separately removes containers matching the Launchpad
  and instance labels both before start and through an exit/signal trap, but
  suppresses individual cleanup failures.

ECS/Compose selects the local-process Runner inside the one application
container, not the per-turn Container Runner. Stopping that outer application
container supplies a container boundary, but no per-Agent Runtime container.

## Server restart boundary

On startup, persisted queued/running Runs are changed to `cancelled`, with
`Server restarted while this run was active`, and busy Agents are reset to
ready. This repairs metadata only. The initialization path has no process ID or
container handle with which to find an execution from the prior server.

The SIGINT/SIGTERM handler closes Fastify and immediately exits; it does not
call a service/Runner shutdown method or await the active execution map. The
local POC shell's label cleanup is an additional outer safeguard for its
containers, but host-development child trees and every cleanup postcondition
remain untested.

## Test and reproduction boundary

The five upstream Runner tests cover only new/resumed argument arrays,
happy-path extraction of thread/message/usage, container arguments/name
sanitization, and absence of the synthetic Ark secret from argv. They do not
spawn Codex, start a container, or exercise cancellation, timeout, overflow,
signals, nonzero exit, malformed stream, cleanup, shutdown, or Ark.

A read-only parser probe against the compiled unmodified source supplied a
malformed line, ignored `turn.failed`/command events, two assistant messages,
partially invalid usage, and an object-shaped top-level error. The observed
projection was:

```json
{"messages":["first","final"],"threadId":null,"usage":{"outputTokens":4},"errors":["Codex reported an unknown error"]}
```

No live execution/cleanup branch was exercised because Codex/Ark/container
prerequisites are unavailable. Accordingly, all cleanup claims above are
source-described behavior, not reproduced postconditions.

## Challenge consequence

The baseline has bounded timeout/output controls and cleanup attempts, but it
does not persist the evidence needed to demonstrate why a command failed,
which side effect preceded termination, whether every descendant/container was
removed, or whether a protected asset survived. A final error string or
`cancelled` database state is not proof of trace completeness, authorization,
or containment.
