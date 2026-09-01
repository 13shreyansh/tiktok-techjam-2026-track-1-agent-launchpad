# Live arbitrary team-task evidence

Verified: **2026-08-29 16:42 SGT** against clean source
`a95cade5612576bb7119ca8332d1d2984951d019` and compiled build SHA-256
`3c72e8d0815cc461ce896498c45733fda77b934d180ff674a0718bcf264bd18d`.

## Claim and boundary

The primary product path is not a scripted countdown. A user entered an
ordinary task and three success criteria in the production browser UI. The
middleware durably assigned a draft, recorded and cancelled a real active
Codex Run, rejected its unfinished output, reassigned the same stage, restored
the still-empty running task after a browser reload, saved the replacement's
useful output, and required a different Agent to review every criterion before
completion.

This proves the observed local single-node path only. It does not prove
multi-node, disk-loss, machine-loss, portable judge credentials, spontaneous
crash detection, rollback of Runtime side effects, or that model review is a
correctness oracle.

## Live input

Task:

> Create a one-page recovery plan for a student team whose live product demo
> stops five minutes before judging.

Success criteria:

1. Give actions for the first 2 minutes and the next 3 minutes.
2. Assign one named role to every action.
3. Include a fallback that still proves the product when both internet and the
   main laptop fail.

Session: `35260b74-6174-4ce2-bbb4-867737870ba2`

## Observed live sequence

1. `16:41:22.126` SGT — the task and initial-draft assignment were durably
   committed.
2. Planner started real Run `3ff14a08-c25c-4f93-a1f0-58cfc3c14519`.
3. **Disconnect active worker** first committed a structured
   `run.interrupt-requested` record with the exact Run and Agent IDs, then
   cancelled that Runtime process. The receipt ended `cancelled` with
   `Run cancelled` and no usage object.
4. `run.interrupted` and `turn.retrying` linked the rejected Run to the same
   deterministic draft stage. Its unfinished output was never accepted.
5. Builder started replacement Run
   `fe1647ae-56b8-4bef-a750-955fb0eead2d` at attempt 2.
6. The browser was reloaded before any output existed. The production UI
   restored the same running task, Builder's active Run, the structured
   interruption, and prior event history from durable state.
7. Builder completed and the middleware saved artifact version 1 with SHA-256
   `1accf8fa66b487b40d68f7d1050af601040a31166dc7117993b99cb7302aaa00`.
8. Reviewer—not Builder—started Run
   `dc0ad79c-0983-44ab-957b-fd56d816ab40` and independently returned three
   structured PASS checks with criterion-specific evidence.
9. `16:41:52.531` SGT — only after that review did the middleware commit
   `session.completed`.

Observed duration: **30.405 seconds**. The final durable timeline contained 17
events. Browser console inspection after completion and export returned no
warnings or errors. The generated plan rendered as headings, tables, and text
rather than a seeded or raw-Markdown answer.

## Schema-7 receipts

- Final status: `completed`
- Accepted stages: `draft`, `review`
- Structured operator interruption: `requested` then `cancelled`
- Operator-interrupted Runs: `1`
- Cancelled Agent Runs: `1`
- Retries: `1`
- Saved artifact versions: `1`
- Independent verdict: `PASS` (`3/3` checks)
- Artifact producer: Builder
- Reviewer: Reviewer
- Distinct producer/reviewer: `true`
- Completed with independent review: `true`
- Transport semantics: at-least-once delivery with application-level
  idempotent acceptance; physical exactly-once execution is explicitly false
- Evidence schema: `7`
- Source revision:
  `a95cade5612576bb7119ca8332d1d2984951d019`
- Source dirty flag: `false`
- Build SHA-256:
  `3c72e8d0815cc461ce896498c45733fda77b934d180ff674a0718bcf264bd18d`
- Runtime: `codex-cli 0.150.0-alpha.12.2`
- Stable content SHA-256:
  `5fcaa947f1e5a5373ebcddf41e874bf1d4dc8361536fe756306b5ba1aa07fc51`

Two API exports produced different valid
timestamped snapshot digests
(`019fba68067b0bf0661455e6b1103db33e105eb04669ad4d426880871982ca0d`
and
`c2da45094140bd72fc0a6326e24c4eb32f3b7ce32cb78607519f8f8d54c7cac5`)
but the same content digest above. The browser independently recomputed both
hashes before download and displayed `Content + source verified · 5fcaa947…`.
The hashes are self-integrity checks, not signatures or external timestamps.

Schema 7 freezes the source revision, dirty flag, compiled build hash, and
Runtime version into the durable session when it is created. The exported
`source` object exactly matched `session.sourceAttestation`; it was not read
from the exporting server. After the schema-7 server restarted, the earlier
schema-6 session had no stored attestation and correctly exported `unknown`
instead of being rebound to the newer build.

The source-freezing boundary was then exercised live. After this proof was
recorded, documentation commit
`ec7d846bedff87b259d33a9935b99469168bd340` was created and the application
was rebuilt and restarted from that clean revision. `/api/system` reported the
newer `ec7d846...` server, while re-exporting session `35260b74...` still
reported its stored `a95cade...` source and the same stable content digest.
The server revision and exported revision differed, the exported and stored
session revisions matched, and `revisionStayedFrozen` was `true`.

Every started Run is included in the evidence: Builder `completed`, Reviewer
`completed`, and the rejected Planner Run `cancelled`.

## Runtime and observed resources

The normal launcher is `CODEX_AUTH_MODE=chatgpt npm run relay`. The audit
shell did not expose `npm` on its non-interactive PATH, so this proof invoked
the same repository script through a temporary npm package runner:

```bash
PATH=/Users/shreyansh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/shreyansh/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH \
  CODEX_AUTH_MODE=chatgpt PORT=3401 NATS_PORT=4431 \
  RELAY_STATE_ROOT="$PWD/.local/live-chatgpt" \
  pnpm dlx npm@11.6.2 run relay
```

It verified signed `codex-cli 0.150.0-alpha.12.2`, confirmed the existing
ChatGPT login without copying credentials, started pinned NATS JetStream
`2.14.5`, rebuilt both workspaces, recorded the source/build attestation, and
served `http://127.0.0.1:3401/`.

- Builder usage: 20,438 input; 19,200 cached input; 487 output tokens.
- Reviewer usage: 17,362 input; 16,128 cached input; 179 output tokens.
- Aggregate completed-Run usage: 37,800 input; 35,328 cached input; 666 output
  tokens.
- The cancelled Planner receipt has no usage object.
- After the proof, the server used 109,792 KiB RSS and NATS used 45,376 KiB
  RSS.

## Historical superseded proofs

The schema-6 session `290e7fa4-024c-424b-adc1-bd8b877fc9cf`
completed the same recovery story in 25.973 seconds and produced stable content
digest `7d69252d46fbe51a142038df753f8d0535c956a8762f29c776307e1d203871af`.
It recorded the exporting server's source identity rather than freezing it at
session creation. That gap was found during the completion audit, so schema 7
supersedes it as the source-bound proof.

An earlier schema-5 rehearsal used session
`e01852bf-6e02-41ae-8860-0f4674db5069`, cancelled Planner Run
`22082a74-db95-454c-b0b4-89471cae1636`, completed with Builder Run
`a77e9ef6-be30-4e3c-a9c0-9b4937a97498`, and passed review with Reviewer Run
`c1143028-9796-4ee1-8525-f04ab5c63221` in 30.533 seconds. It found and
corrected reviewer rotation and receipt-shape problems, but it did not bind
the exported evidence to a source revision or compiled build.
