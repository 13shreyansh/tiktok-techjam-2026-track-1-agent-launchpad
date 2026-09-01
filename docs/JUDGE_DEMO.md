# Three-minute judge walkthrough — Reliable Runs

## The one capability

Agent Launchpad already runs Agents. **Reliable Runs** lets a user split one
long Agent job into visible checkpoints. The middleware saves each completed
checkpoint before the next Agent starts. If a worker disappears, earlier work
stays saved and only the unfinished checkpoint restarts through a backup.

This is deliberately one product promise. Countdown, ordered tokens, automatic
review, and evidence export remain regression or secondary capabilities; they
are not the primary story.

## Live walkthrough

### 0:00–0:35 — Start from nothing

Open **Reliable Runs**. The form and result area must be blank. Explain the
three visible steps: describe the job, let real Agents finish checkpoints, and
restart only unfinished work after a failure.

Enter fresh facts that have never appeared in an earlier run. A compact example:

> Turn these launch notes into a recovery-ready handoff: project ORBIT-742;
> launch Friday at 18:40; owner Mina; backup Theo; projector adapter unresolved.

Enter three checkpoints:

1. List only the confirmed facts.
2. Turn the unresolved adapter into a concrete risk and action.
3. Write a three-line handoff using the saved results.

Select the available workers and start the run. Point out that no result exists
until a real Codex Run completes.

### 0:35–1:20 — Show useful saved work

Wait for checkpoint 1 to turn green. Read one fresh fact and point to its Agent
name and Run ID. Checkpoint 2 begins only after checkpoint 1 is durably saved.

The screen should answer three questions without opening the event log:

- What is the user's job?
- Which work is permanently saved?
- Which Agent is working now?

### 1:20–2:10 — Break the real coordinator

After at least one checkpoint is green and a later checkpoint is running, stop
the launcher with `Ctrl-C`, then rerun the same documented launch command. This
terminates and recreates the actual coordinator process. It is not an animation
or a precomputed fault.

Reload the browser. Show:

- the restoration banner and the same user task;
- every earlier green checkpoint and its exact output still present;
- the green **Coordinator restarted** callout and restart count;
- the precise statement that the interrupted checkpoint restarted from the
  beginning while completed checkpoints stayed saved.

Never say partial work resumed. The implemented contract rejects incomplete
output and restarts that checkpoint.

If terminal switching would make the recording hard to follow, the visible
**Disconnect current worker** button remains the shorter adverse-path proof. Do
not show both failure modes in the same three-minute story.

### 2:10–2:50 — Finish the ordinary task

Wait for the replacement to finish. Read the final three-line handoff. Point to
the completed save count, `1 coordinator restart`, and the distinct real Run
IDs. The value is the usable handoff, not the event stream.

Keep **Technical event log** collapsed unless a judge asks for proof. If asked,
open it to show durable assignment, real Run start, interruption, retry,
checkpoint saves, and completion.

### 2:50–3:00 — Close

Say: “A normal Agent connection owns a run. Reliable Runs moves ownership into
middleware: the user can leave, a worker can die, and completed checkpoints do
not disappear or run again.”

## Verified live receipt

Session `d9f5da51-57bf-41a5-b84a-55b21593f788` completed on 2026-08-29 in
37.489 seconds from clean source `1598ea19791ff878f7717e03a79c2e260f6c47c5`.
Two checkpoints were saved before the coordinator stopped. The active real Run
`98b20bd3-9b2f-40d7-9cc1-dc9a1d09c4bb` was cancelled and never accepted. A
fresh coordinator durably recorded recovery, restarted checkpoint 3 at attempt
2, and completed `5/5 saved`. The browser showed the recovery callout and had
no console warnings or errors.

## Honest boundaries

- The user defines checkpoints; the middleware does not yet infer them.
- Recovery is checkpoint-level, not token-level or partial-output resume.
- Saved text survives browser, coordinator, and local NATS process restart on
  the same disk. This is not multi-node or machine-loss failover.
- The verified coordinator proof used graceful `SIGINT`; an uncatchable
  process or machine crash cannot perform the same active-Run cleanup.
- Rejecting an interrupted answer does not roll back filesystem or tool side
  effects already made inside that Agent workspace.
- Work is sequential. This proof prioritizes clear recovery semantics over
  high-throughput parallel scheduling.
- The successful local route depends on the existing signed Codex CLI login;
  no credential is copied into the repository or a container.
