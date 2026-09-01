# Agent Launchpad win gate

This gate is deliberately stricter than “the app works.” It defines the point at
which the middleware is ready to represent the team in a judge-facing demo. It
does not guarantee a competition result.

## One-sentence product claim

Agent Launchpad makes accepted Agent work survive failure: it turns one
plain-language job into a right-sized team of real coding Agents, saves each
accepted checkpoint transactionally, and moves only unfinished work to a fresh
Runtime while every decision, action, policy result, and recovery remains
visible and tamper-evident.

## Non-negotiable pass conditions

All conditions must pass in a fresh browser session. A scripted UI state, seeded
failure, or unit-test-only result does not count as proof.

1. **Starter continuity:** Create Agent, select Agent, conversation, workspace,
   and a real Codex Run still work through the primary UI.
2. **Twenty-second clarity:** a cold reviewer can identify the user's task, the
   active Agent, the current action, and why this is middleware within 20 seconds
   of opening the running job.
3. **Adaptive coordination:** three live prompts demonstrate a one-worker plan,
   a multi-role plan, and a plan that asks a clarifying question only when a
   material decision is genuinely missing. Every worker is task-specific and
   created fresh; the UI states why the selected count is sufficient.
4. **Glassbox:** 100% of persisted middleware and Runtime events are available in
   one ordered record with raw payloads, attribution, timestamps, and Run IDs.
5. **Bouncer:** one real destructive tool request is denied before execution, the
   protected file remains byte-identical, and a later safe action succeeds.
6. **Kill Switch:** one real active Runtime is terminated from the UI. Its output
   is ineligible, its transaction is discarded, and the exact stopped Run ID is
   visible.
7. **Coordinator and recovery:** accepted checkpoints survive browser reload and
   coordinator restart; pending work returns to a fresh Runtime with the same
   task-specific role; saved work is not repeated.
8. **Transactional state:** during a live edit, changed files exist only inside
   the Run transaction. On acceptance they are atomically promoted; on failure,
   timeout, or Kill Switch they are discarded with the canonical workspace hash
   unchanged.
9. **Flight Recorder USP:** every middleware event and Runtime trace belongs to a
   verified SHA-256 chain. The browser reports `linked events / total events` as
   equal, and exported evidence independently verifies both chains.
10. **Proof Gate USP:** after every accepted web-app checkpoint, a trusted-host
    browser—not the worker—loads the result over HTTP at 375x812 and 1440x900.
    Browser/page errors, headings, controls, horizontal overflow, and screenshot
    hashes become durable evidence and are handed to the next worker.
11. **Visual QA:** the complete conversation-first flow is usable at 1440x900 and
    1280x720 without clipped controls, covered content, forced scrolling, or an
    unexplained secondary workflow.
12. **Truth gate:** source revision, build hash, Runtime version, commands,
    observed results, resource caveats, and known limits are recorded. No local
    success is described as deployment, submission, or a guaranteed win.
13. **Cold score:** a reviewer given only the official statement and meeting
    transcript scores challenge fit, real-world value, middleware depth,
    technical proof, usability, and demo clarity at least 9/10 each, with no
    unresolved severity-one issue.

Implementation continues until every condition has current live evidence or is
truthfully marked blocked. Passing automated checks is necessary maintenance,
not a substitute for the browser and Runtime proofs above.

## Current gate result — 2026-08-31 18:43 SGT

All thirteen gates have current local evidence. The decisive session
`65f9f9c4-38c9-4c09-80e9-df1eb0fe1c04` saved checkpoint 1, stopped checkpoint
2 Run `27bc7b49`, reassigned only checkpoint 2 to fresh Run `a09b836b`, and
finished checkpoints 2 and 3 once. Glassbox verified 114/114 causal links
against evidence root `ffedac19...8086`. Browser QA passed at 1280x720 and
1440x900. A fresh isolated reviewer scored all eight UI/demo categories at
least 9/10. Exact evidence and limitations are recorded in
`evidence/2026-08-31-adaptive-proof-gate-live.md`.

This gate is local readiness evidence. It does not claim deployment, remote
reproduction, organizer acceptance, submission, or a guaranteed win.
