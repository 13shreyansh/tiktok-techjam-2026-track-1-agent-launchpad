# Five-minute judge demonstration

## The one-sentence story

**Codex Agents do the work; Agent Launchpad is the control plane that chooses
the smallest justified team, exposes every action, blocks a forbidden action,
stops a real Runtime, and resumes only unfinished work from durable state.**

The recording must show one real workspace. It may remove idle waiting, but it
must not replace real activity with seeded events, animations, or narrated
claims that were not observed.

## Recommended hero task

Use the existing, working `Creator Pulse` workspace. Ask for a visible extension
that is easier to complete during recording than another zero-to-one build:

```text
Extend the existing Trend Reactor with an “A/B Hook Arena”. First define a
narrow change contract from the current files and acceptance criteria. Then
implement two side-by-side launch hooks generated from the same three themes,
let the creator choose a winner, and persist that choice locally. Finally,
independently validate the result and issue a concise PASS or FAIL verdict.
Preserve the current visual language and all existing interactions. These are
three independently accountable outcomes; use the smallest task-specific team
that preserves those responsibilities. Do not open a browser or listening
server from a worker; the control-plane Proof Gate will perform browser
verification.
```

This request should justify three fresh task-specific Agents without inventing
work merely to increase the count. The existing run history already contains a
real four-Agent product run, a two-Agent remediation run, and a one-Agent
Bouncer proof, so the same workspace can demonstrate adaptive team sizing.

## Recording flow

### 0:00-0:25 — Problem and boundary

Show the working Trend Reactor and say:

> A coding Agent can produce this app. The unsolved infrastructure problem is
> deciding who should work, proving what each worker actually did, preserving
> accepted state when a Runtime stops, and enforcing policy before a dangerous
> tool call executes.

Do not imply that Launchpad replaces Codex. It controls Codex Runtimes at the
API, workspace, and execution boundaries.

### 0:25-0:55 — Submit the hero task

Submit the request once. Keep the planning response on screen until it records:

- the exact number of fresh Agents selected;
- each task-specific role and purpose;
- the non-generic checkpoints and dependencies;
- the coordinator's reason for that team size.

Open **Agent map**. Explain that the current implementation uses staged durable
handoffs over one shared workspace; it does not claim parallel writes by four
Agents.

### 0:55-1:35 — Glassbox

Return to **Workroom**. Point to one real Runtime ID, one command, one file
change, one handoff, and the `Bouncer policy active` receipt. Keep the compact
feed moving; do not read model prose. Briefly open **Raw ledger** to establish
that the compact feed is a view over the complete record, not a replacement for
it.

### 1:35-2:20 — Kill Switch and recovery

Wait until checkpoint 1 is visibly saved and checkpoint 2 has a real active
Runtime. Click **Kill Switch current Agent** once. Keep these receipts visible:

1. `Kill Switch requested`;
2. `Runtime terminated` and unfinished answer rejected;
3. `Unaccepted changes discarded`;
4. `Work resumed in a fresh Runtime` with a different Run ID;
5. checkpoint 1 remains saved and does not rerun.

Reload the browser while the replacement is working. The task, accepted
checkpoint, recovery receipt, Run IDs, and Glassbox history must return. Call
this an operator-triggered termination, not a spontaneous crash.

### 2:20-3:05 — Honest time cut and usable result

Make a clearly labelled edit such as `6 minutes later — idle wait removed`.
Do not hide a failure. When the run finishes, open the result full-size and
perform a short real interaction: generate both hooks, select a winner, reload,
open the saved concept, and show that the winner is restored. The app
intentionally reloads into a clean creation state, so do not imply that an
unsaved screen is restored automatically. Return to Launchpad and show the
trusted-host Proof Gate receipt for 375x812 and 1440x900.

### 3:05-3:45 — Adaptive sizing and independent quality

Use the **Run** selector in the same workspace:

- show the four-Agent Trend Reactor build;
- show the two-Agent persistence remediation and its independent PASS;
- return to the current three-Agent extension.

The key line is: team size follows the work. The rehearsal produced four Agents
for design/build/accessibility/release review, two for fix/review separation,
and one for a linear policy proof.

If the new independent reviewer says FAIL, show it. A FAIL is not a demo failure
when the Glassbox identifies an actionable defect; do not call the product ready
until a later independent PASS exists.

### 3:45-4:35 — Bouncer

Choose the one-Agent Bouncer proof from **Run** history, or click **Run fresh
proof** if recording a new receipt. Show:

- exact request `rm launchpad-live-proof.txt`;
- `Action blocked · no-destructive-shell-deletion` before execution;
- allowed command `test -f launchpad-live-proof.txt && printf exists`;
- output exactly `exists`;
- Bouncer blocked count and verified evidence chain.

This policy covers the documented direct-deletion patterns. It is not an OS
sandbox, a universal intent classifier, or a rollback engine.

### 4:35-5:00 — Close on proof, not features

Return to the recovered hero run through the **Run** selector and show its
recovery receipt, then close on the Agent map or Raw ledger:

> The Agents still did the coding. Launchpad made the team adaptive, every
> action inspectable, destructive deletion preventable, accepted work durable,
> and an interrupted checkpoint recoverable without repeating completed work.

## Rehearsal evidence observed on 2026-09-01 SGT

- Initial hero planning failed once because a generated step description
  exceeded the schema limit. Planning prose is now bounded and normalized;
  typecheck, 54 server tests, and production build pass.
- The Trend Reactor rehearsal created four fresh Agents and four distinct
  checkpoints. Run `afa8992d` was terminated during checkpoint 2; fresh Run
  `c080be82` resumed checkpoint 2 while checkpoint 1 remained saved.
- A browser reload during recovery preserved the live session.
- The accepted app passed trusted-host Chrome checks at 375x812 and 1440x900
  with zero browser errors and zero horizontal overflow.
- The first independent reviewer correctly returned FAIL for incomplete
  persisted-record validation. A later two-Agent remediation added the guard
  and regression coverage; its independent verdict was PASS with 7/7 unit
  tests, 2/2 accessibility checks, lint, build, and browser proof passing.
- The one-Agent Bouncer proof denied the exact `rm` command and confirmed the
  protected file still existed. Its ledger contains 52 causally linked events,
  two blocked actions, and a verified evidence root.
- The generated Trend Reactor was manually exercised: three themes combined
  into a concept, a favourite saved, and that favourite remained after reload.
- The exact A/B Hook Arena rehearsal selected three fresh specialists: contract
  analyst, builder, and independent validator. Run `685f3410` was terminated
  during checkpoint 2; replacement Run `15938879` retried checkpoint 2 while
  checkpoint 1 remained saved, and a browser reload preserved the recovery.
- The first A/B independent verdict was honestly FAIL despite 10/10 checks
  passing: winner-storage failure could disable the unrelated Save favourite
  path. A separate two-Agent remediation split the failure states and received
  an independent PASS after a forced-failure regression (3/3), full suite
  (13/13), lint, build, and trusted-browser checks all passed.
- During that remediation, the worker recognized that its first regression was
  source-text inspection rather than behavioral proof and replaced it with a
  deterministic runtime harness. Bouncer also blocked a delete-and-recreate
  `apply_patch` attempt before execution; the worker continued with a safe edit.
- Manual final-result verification generated Hooks A and B from Storytelling,
  Tech, and Comedy, selected Hook B, reloaded the page, opened the saved
  concept, and observed Hook B restored as the winner.

## Non-negotiable recording gates

Do not approve the recording unless it visibly contains:

- a newly submitted task and newly created real Run IDs;
- an evidence-based team-size decision and task-specific Agents;
- one saved checkpoint before the Kill Switch;
- one real Runtime terminated with unfinished output rejected;
- the same checkpoint resumed under a different Run ID exactly once;
- a page reload during the replacement Run;
- a real result interacted with full-size;
- a Proof Gate receipt;
- one exact Bouncer denial and a later file-exists result;
- the final source revision, build hash, and Codex Runtime version;
- truthful labels for edited waiting time and current durability limits.

The local setup is one file-backed NATS JetStream node. It proves browser and
coordinator-process recovery on this machine; it does not prove disk loss,
multi-node failover, or geographic disaster recovery.
