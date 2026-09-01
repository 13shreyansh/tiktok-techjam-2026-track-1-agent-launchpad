# Live Glassbox production-browser evidence

Observed on 2026-08-29 from 21:54 to 21:56 SGT against the compiled local app at
`http://127.0.0.1:3401/`. This was a real ChatGPT-authenticated Codex Runtime
run. No fault mode or seeded timeline was used.

## User action

The browser submitted:

> Add a small visible footer to the existing tic-tac-toe app saying “Built
> with Agent Launchpad”, then verify the app still works.

Reliable execution used the two existing Agents `Social Media` and
`Cheif of staff` in their existing shared workspace. The misspelled Agent name
was pre-existing user state and was not altered for this proof.

## Observed result

- Durable session: `a39393a0-2553-4fab-bfeb-b569415ef4c0`
- Started: `2026-08-29T13:54:26.315Z`
- Completed: `2026-08-29T13:56:27.287Z`
- Status: `completed`
- Checkpoints saved: 3 of 3
- Run receipts: 4 total; 3 completed and 1 cancelled
- Glassbox trace totals shown in the UI: 14 commands and 1 file action
- Relay recovery: 1 retry after an operator-triggered real worker stop
- Browser console after compiled-app restart: 0 warnings or errors
- Visible preview result: the tic-tac-toe UI rendered a footer with exact text
  `Built with Agent Launchpad`

The first Agent completed checkpoint 1. `Cheif of staff` claimed checkpoint 2,
ran real shell commands, and changed `index.html` and `styles.css`. The browser's
**Stop current Agent** action then cancelled Run
`405f73b4-50d3-4730-846c-89fdfcecb440`. The durable session recorded the stop
request, final cancellation, and retry. Its unfinished response was not
accepted. `Social Media` claimed the same checkpoint as Run
`9ab8c00f-ea81-483c-95e7-edbdb43057a2`, observed the existing shared-file
change, preserved it, and completed. Run
`e67e4a41-7c9c-4556-b6ba-ede246df62ca` completed the final verification
checkpoint.

After the compiled server restarted, the completed session and all Run traces
remained readable. Evidence schema 8 reported trace lengths 6, 9, 9, and 6 for
the four receipts. Snapshot digest:
`216867b55d20816ea87680dae6aa92e35b3f7d30c7b8402cf3538edbcef0be6b`.
Content digest:
`bcb5b0c5b16a4e137d6cbcb5f692fa2a4bacfb9ad58716f01d89a89239e27d3f`.

## Compact and expanded interface proof

The redesigned interface was checked with a second real, read-only job:

> Inspect the current tic-tac-toe app without changing files. Confirm the
> visible footer text and whether the gameplay controls are present.

- Durable session: `2b9e6dbc-6df6-4224-9a03-51a931743e73`
- Started: `2026-08-29T14:19:11.732Z`
- Completed: `2026-08-29T14:20:04.405Z`
- Duration: 52.673 seconds
- Accepted real Codex Runs: 3
- File actions: 0, matching the read-only instruction
- Combined activity shown: all 17 Relay events plus all 17 Runtime trace events
- Expanded organization: job lifecycle plus checkpoints 1, 2, and 3
- Browser console: 0 warnings or errors

During the live run, the compact Glassbox showed the active Agent and action
and advanced from 5 to 8 events without covering the conversation or preview.
After completion, **View full activity** showed all 34 persisted entries with
source labels, Agent attribution, timestamps, complete Run IDs, and recorded
evidence. **Close details** returned to the compact view.

Evidence digests for this session:

- Snapshot: `dcb7679ac9a7fa07cb442eb579f30aacc423262b14bd43ad0abb2fb01c494083`
- Content: `2029b5d93415160301086a1dec909e20711dfd05a36112af18f1dd6d37b8010e`

## Commands and checks

The focused repository gate used the bundled Node runtime because `node` and
`npm` were not on the non-interactive shell PATH:

```text
/Users/shreyansh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node ../../node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
/Users/shreyansh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node ../../node_modules/vitest/vitest.mjs run
```

Observed: 7 server test files and 41 tests passed. Server and web TypeScript
builds passed. Vite built the production web bundle in 327 ms. A live browser
reload restored the completed session, the new recovery summary, the full
timeline, and the preview.

## Boundaries

- The worker stop was operator-triggered. This proves observable cancellation,
  rejection, and reassignment, not automatic machine-failure detection.
- Glassbox records observable Runtime and middleware events. It does not expose
  hidden reasoning.
- Common credential patterns and the local username are redacted before trace
  storage, but the filter is not a complete data-loss-prevention system.
- Cancelling a Run prevents its final response from being accepted; it does not
  roll back earlier file, tool, or network side effects.
- This proof uses the authenticated local Codex installation and one local
  file-backed JetStream process. It is not a hosted or multi-node failover
  proof.
