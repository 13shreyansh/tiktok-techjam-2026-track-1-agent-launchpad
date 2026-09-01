# Kill Switch

Kill Switch is the Runtime termination boundary shared by direct Playground
Runs and Reliable Runs. It stops the actual Codex child process; it does not
merely hide output or mark a browser card as stopped.

For a direct Agent Run, the visible **Kill Switch** control resolves the exact
queued/running Run, persists `Kill Switch requested`, calls the Runner
cancellation path, waits for execution cleanup, then persists either
`Runtime terminated` or a failure state. A cancelled Run keeps `output: null`
and never creates an assistant message. The Agent is explicitly stopped until
the user starts it again.

For a Reliable Run, the coordinator first stores an interruption request and
`run.interrupt-requested` event in JetStream, then cancels the exact Run. It
records the final cancellation state, rejects unfinished output, and retries
only the unfinished checkpoint through an available Agent. Cancelling the
whole job is a separate control and durably commits terminal session state
before attempting Runtime cancellation.

`CodexRunner` sends `SIGTERM` to the active CLI process and uses `SIGKILL` after
three seconds if it does not exit. Glassbox shows both Runtime control traces
and durable coordinator events, counts terminated Run IDs once, and keeps the
evidence visible after completion.

## Boundaries

- Termination does not undo filesystem, tool, or network effects completed
  before the signal.
- A detached grandchild process may outlive the CLI on some platforms. The live
  proof confirmed no matching loop remained, but this is not a general process
  tree or container-isolation guarantee.
- A race can end naturally before cancellation arrives. That is recorded as a
  failed termination rather than claimed as a successful stop.
- Graceful application shutdown also cancels tracked Runs, but an uncatchable
  machine failure cannot execute cleanup.
- Recovery restarts a checkpoint from the beginning; partial model output is
  neither resumed nor accepted.

See [`evidence/2026-08-29-live-kill-switch.md`](../evidence/2026-08-29-live-kill-switch.md).
