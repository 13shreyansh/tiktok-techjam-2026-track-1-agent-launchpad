# Live browser coherent-flow proof

Observed on **2026-08-29 23:26–23:30 SGT** against the production server at
`http://127.0.0.1:3401/`. The browser actions below were performed through the
rendered Agent Launchpad UI. No Relay session, Runtime event, result, policy
decision, or preview state was inserted through an API.

## Source and environment

- Served source: `68d3eced271ba7d580158d7e69e1600c38639c2f`
- Served build SHA-256:
  `e93174b15ec2e354f14ad6555eafbe1020af7d9ba935eed0f05648a46605c2b8`
- Runtime: `codex-cli 0.150.0-alpha.12.2`
- Runtime provider/auth: local host process, existing ChatGPT login
- Sandbox: `workspace-write`
- Durability: NATS Server/JetStream `2.14.5`, one file-backed local node
- Host class: macOS arm64, Apple M5 Pro, 64 GiB memory
- Resource sample after the proof: server PID `79820`, RSS `125888` KiB,
  `0.0%` CPU and `0.2%` memory at the sample; NATS PID `79809`

`/api/system` reported the served revision as clean. The repository worktree
had a later unserved CSS edit during this audit, so the source receipt above is
the receipt frozen into the live session rather than a claim about the later
worktree.

## One coherent real-Agent job

The browser selected the existing **Social Media** Agent, left **Reliable
execution** on, entered this request, and clicked the normal send button once:

```text
Update the existing badge beside the Tic Tac Toe title to say 'Recovered live'. Keep every game interaction and the existing footer unchanged, then verify the result.
```

The UI immediately showed automatic assignment, the single shared workspace,
the current worker, the next workers, the three checkpoints, compact Glassbox,
and the embedded app. Session
`26f5e068-3352-45eb-a9d2-74a0d4e3fe33` then produced these accepted results:

| Checkpoint | Agent | Accepted Run | Attempt |
|---|---|---|---:|
| Inspect | Social Media | `5cd9f36c-a234-4e29-b5ce-a464a659f981` | 1 |
| Implement | Bouncer proof | `2ed0dc0b-3ecf-4df7-9fac-5b84e1671fd8` | 1 |
| Verify | Social Media | `43b9ddc7-853a-4346-8f1b-3f6de99395d9` | 2 |

After checkpoints 1 and 2 were visibly saved, the browser clicked **Kill
Switch current Agent** while **Cheif of staff** had the active verification
Run `545cbfbb-63e0-4fe1-a0a9-06ee289057dd`. The Runtime receipt became
`cancelled`, kept `output: null`, and recorded both **Kill Switch requested**
and **Runtime terminated**. The durable job recorded `run.interrupted` and
`turn.retrying`; Social Media claimed attempt 2 after 312 ms from the interrupt
request. Checkpoints 1 and 2 were not repeated.

The session completed in 99.689 seconds with attempts
`{1: 1, 2: 1, 3: 2}`, three unique accepted turn IDs, one retry, one cancelled
Agent Run, and one operator-interrupted Run. Its evidence content digest was
`a43fafeec55aa4adcb05fbe38575417ef165b3480486a71a3d5badc1fc21cb9a`.
The timestamped export digest changes when exported later by design.

## Usable result, checked in the embedded preview

The live preview visibly showed **Recovered live** and retained the footer
**Built with Agent Launchpad**. The browser then clicked cells 1, 4, 2, 5, and
3. It observed **Player X wins!**, three winning X cells, two O cells, and an X
score of 1. **Play again** cleared the board and kept the score at 1; **Reset
score** returned X, O, and Draws to 0. This interaction was performed after the
Agents completed; it corrects the replacement Agent's narrower statement that
browser automation was unavailable inside its isolated Runtime environment.

The browser was then reloaded and Social Media reopened. The same completed
session returned with all three saved checkpoints, 71 combined Glassbox events,
one recovered/stopped Run, and the served preview. This post-completion reload
proves that the visible record is not held only in the browser; earlier evidence
records a reload while replacement work was still active.

Workspace hashes after the run:

```text
index.html  6f7de35ad1dc0647c3dbd57fa4be3eea60c9b70fbc54569ac610db63288c52c7
script.js   74f83335e3465042b4ef9bb47b7517201c95a7dc1b935b52cc48430835b5bb07
styles.css  fad751f9d5172df018e78821a4d194384389b1f3ad6f293885113682dd5b4d41
```

## Bouncer allow/deny in the same UI

The browser switched to **Bouncer proof**, turned Reliable execution off to
use the direct Agent path, and entered two normal messages.

1. Run `919148f1-c5ce-418b-b8c2-f812f22c43e6` created
   `browser-policy-proof.txt` with `SAFE_BROWSER_PROOF`, read it back, and
   completed. Glassbox recorded the `apply_patch` and `od` actions as allowed.
2. Run `786428c0-95af-4b53-846b-8e14bff4e114` was told to execute exactly
   `rm browser-policy-proof.txt`. Bouncer recorded **Action blocked** under
   policy `no-destructive-shell-deletion` before the tool ran. An independent,
   allowed existence check returned `exists`; the Agent reported that the file
   remained.

The preserved 19-byte file hash is
`c52abe8aad2099955b10960cb455850a379f4ea2d04766b1d0ec896436f74330`.
Expanded Glassbox showed all eight events for the denial Run, including the
policy version, exact redacted action, existence-check output, Run ID, source
revision, and Runtime version.

## Read-only receipt commands

```bash
curl -sS http://127.0.0.1:3401/api/system | jq .
curl -sS http://127.0.0.1:3401/api/relay/sessions/26f5e068-3352-45eb-a9d2-74a0d4e3fe33 | jq .
curl -sS http://127.0.0.1:3401/api/relay/sessions/26f5e068-3352-45eb-a9d2-74a0d4e3fe33/evidence | jq .
curl -sS http://127.0.0.1:3401/api/agents/d007c8f1-5a7d-4cbe-a963-ee85afa4f7e5/runs | jq .
shasum -a 256 .local/relay-demo/workspaces/c059e329-71e1-4438-aefa-e61fe283f322/{index.html,script.js,styles.css}
shasum -a 256 .local/relay-demo/workspaces/d007c8f1-5a7d-4cbe-a963-ee85afa4f7e5/browser-policy-proof.txt
```

## Verification after the UI audit

The first attempt to run `npm run check` with ChatGPT's platform-signed Node
passed both TypeScript workspaces, then macOS rejected Rollup's native module
because the mapped process and module had different Team IDs. No dependency was
deleted or reinstalled. The same repository dependencies were then exercised
with the ordinary bundled workspace Node used by the live server:

```bash
NODE=/Users/shreyansh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node

"$NODE" ../../node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
"$NODE" ../../node_modules/typescript/bin/tsc -b --pretty false
"$NODE" ../../node_modules/vitest/vitest.mjs run
"$NODE" ../../node_modules/vite/bin/vite.js build
"$NODE" ../../node_modules/typescript/bin/tsc -p tsconfig.json
git diff --check
```

The first, third, and fifth Node commands were run from `apps/server`; the
second and fourth from `apps/web`; `git diff --check` was run from the repository
root.

Observed results: both type checks exited 0; seven test files and 42 tests
passed; the web production build transformed 30 modules and emitted a 226.35 kB
JavaScript bundle plus 42.39 kB CSS; the server compile exited 0; and
`git diff --check` emitted no errors.

## Honest boundary

This proves a real operator-triggered worker interruption, not a spontaneous
machine crash. This session's reload proves that its visible record survives a
browser reload; the separate coordinator-restart evidence records graceful
coordinator/NATS restart recovery on one local file-backed node. Neither proves
disk loss, machine loss, multi-node failover, or hosted deployment. Bouncer
covers its documented direct-deletion patterns; it is not a complete OS
sandbox, DLP system, rollback engine, or proof that all destructive behavior is
impossible.
