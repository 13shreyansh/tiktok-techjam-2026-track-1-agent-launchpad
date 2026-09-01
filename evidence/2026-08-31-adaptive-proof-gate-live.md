# Adaptive coordination and trusted-host Proof Gate — live evidence

- Date: 2026-08-31 SGT
- Scope: local browser, local JetStream, real bundled Codex CLI, ignored workspaces
- Repository source at session creation: `a38e687ccc535a15acdede8c10babe5f062af860` (`dirty=true`)
- Compiled build SHA-256: `43def71335b4a4b4a98b5984488502eb371df3a8e315682ba55eb0eb2ad56530`
- Runtime: `codex-cli 0.151.0-alpha.7.2`, existing ChatGPT login

## Live one-worker decision

The user entered this prompt through the production UI:

> Recheck the existing Pomodoro app without editing it: run its
> repository-defined test and production build commands, then report only the
> observed pass or failure.

Planning Run `db43c979-207d-46b3-8617-6441fd2da56f` created session
`ca8f3d5b-2efb-42d5-9d40-dfdf1003264c`. It selected exactly one fresh worker,
`Pomodoro Validation Runner`, because the read-only commands formed one tightly
related auditable sequence. No saved Agent was reused. The four task-specific
checkpoints ran once each:

| Checkpoint | Run ID | Observed result |
| --- | --- | --- |
| Resolve repository commands | `0837c49b-5bc4-44cf-b18d-677a53c6c123` | `package.json` and README identified `npm test` and `npm run build` |
| Run tests | `3c5b7a91-139a-4b1d-a385-78142dbe4565` | exit 0; 21 tests, 21 passed, 0 failed |
| Build | `aa44ccbb-580d-4725-a2f9-57c0a57ade20` | exit 0; `Built static app in dist/` |
| Report | `082c77fc-6d62-4986-b071-29c57f32a049` | Test PASS; production build PASS |

The session completed in approximately 84 seconds with attempts
`{1:1,2:1,3:1,4:1}`. Final middleware event 43 has SHA-256
`a96a5c6d610495418d88db8cd6c6007306f0c999a3e65231b7de17a230ad1404`.

## Independent browser evidence

After every accepted checkpoint, the trusted host served `dist/index.html`
over an ephemeral `127.0.0.1` HTTP port and opened it in Chrome outside the
worker sandbox. All four attestations passed. Every receipt observed:

- 375x812: 731 visible characters, four headings, three controls, 0px
  horizontal overflow, zero console errors, zero page errors; screenshot
  SHA-256 `9a1c6100a725309e2fdd0a6875bd5fd552b305ed92f6146500c53d004ddeaf81`.
- 1440x900: the same content measures, 0px horizontal overflow, zero console
  errors, zero page errors; screenshot SHA-256
  `cb15ace5feb8fb42241983c34c97c8ca2f5fe592884827c805696bd07950d4b4`.

The live in-app browser also clicked **Start** in the actual served preview,
observed `25:00` change to `24:59` and the control change to **Pause**, then
clicked **Reset** and observed `25:00` and **Start** again. The Launchpad UI was
visually inspected at 1440x900 and 1280x720 in compact and expanded Glassbox
states; primary controls remained visible and the evidence record remained
manually scrollable.

The first Proof Gate implementation truthfully failed because a `file://` load
triggered module CORS errors. A direct follow-up run through a temporary HTTP
server initially exposed a missing optional favicon as a 404; the server now
returns 204 for that optional request while still failing missing application
assets. Only the later HTTP receipts above are claimed as passed.

## Real failure, recovery, and policy evidence

The final operator-facing rehearsal used one plain prompt to request two
independent evidence streams and a reconciled release decision. Planning Run
`4cc450c1-b97c-40a6-9e53-777b377bbf68` created session
`7150d2a7-35fd-4eb4-ac39-8a98fe96697a` and exactly three fresh, task-specific
workers: `Pomodoro Code and Accessibility Auditor`, `Pomodoro Test and Build
Verifier`, and `Pomodoro Release Decision Lead`. No saved Agent was reused.

While checkpoint 1 attempt 1 was active, the visible **Kill Switch current
Agent** control cancelled real Run
`d607621c-d1f6-4d75-8534-66dfa8b7ff25`. The cancellation completed without an
error; its unaccepted transactional workspace was discarded. The coordinator
then assigned only checkpoint 1 to fresh Run
`e883a666-f980-4077-a31c-da20e30878bf` as attempt 2. Checkpoints 2 and 3 ran
once each in Runs `b3051194-db8e-4e5e-af16-69fd8d704909` and
`d328c3ec-f42d-46cf-b78d-5b04cb5107ff`. The session completed with attempts
`{1:2,2:1,3:1}`, three durable saves, one recorded stop, no failure, and final
event-chain hash
`0c0c5b9a28f1374f34db3615565579c804f324f76bfb5df5393caedeedd52a57`.

Proof Gate passed twice for that session, including after the final accepted
checkpoint. The stored mobile and desktop screenshot hashes remained
`9a1c6100a725309e2fdd0a6875bd5fd552b305ed92f6146500c53d004ddeaf81`
and `cb15ace5feb8fb42241983c34c97c8ca2f5fe592884827c805696bd07950d4b4`;
both receipts recorded 0px horizontal overflow and no browser or page errors.
The session froze compiled build SHA-256
`78191fa4a25e5710d4b8bf9e75a877dfd32cba26cc211dd611f062a3ed2c728b`.
After the final compact-layout, deliverable-card, reusable-profile, and
fresh-proof controls were added, the live launcher built SHA-256
`94eab33624309a2b8bdc11e7d3595d0adc8e36f5e8403f69764ec0b8d7c4214b`.
The in-app browser inspected both collapsed and expanded Glassbox at 1440x900
and 1280x720. The first 1280x720 view exposed the user request, three-Agent
decision, three durable saves, recovery count, stopped count, and a manually
scrollable conversation; expanded Glassbox exposed all seven receipts and had
0px document overflow.

Session `43bff556-4cc4-4f17-b71f-641a96217df5` was interrupted with checkpoint
3 active. Restart discarded transaction
`ccbb7d2e-3399-4531-97e3-b3fa2861c3b2`, preserved checkpoints 1 and 2, emitted
`coordinator.recovered`, and completed checkpoint 3 only on attempt 2 with Run
`3e38e30a-f1ea-40ce-b170-e7341994cdc0`. Attempts were
`{1:1,2:1,3:2,4:1}`.

Multi-worker session `bae08e6a-b1ef-4dda-b144-2d94b94d4f6a` accepted its first
two checkpoints but failed its browser-review stage after four bounded attempts
because the worker could not launch the required browser. The middleware did
not convert `STATUS: BLOCKED` into success. During Run
`2a2440ad-be5e-4e61-861a-002066c0b3eb`, Bouncer denied an `apply_patch` request
that deleted and recreated `docs/browser-validation.md`; the tool returned the
recorded reason before execution.

## Limits

Proof Gate proves that the accepted static page loaded at two widths, had basic
visible structure, emitted no browser/page errors, did not horizontally
overflow, and matched the stored screenshot hashes. It does not by itself
prove arbitrary interactions, visual quality, accessibility, semantic
correctness, security, external side-effect rollback, or production hosting.
The UI interaction above is a separate live observation. The tested durability
topology is one local file-backed NATS process, not a multi-node cluster.

## Non-vacuous accepted-work recovery proof

The final judge-facing run used session
`65f9f9c4-38c9-4c09-80e9-df1eb0fe1c04`, created by planning Run
`ca4598cf-8bd3-419d-b9cd-7a136c55f124`. One ordinary prompt selected three
fresh task-specific workers for source inspection, independent test/build
verification, and evidence reconciliation. The session ran from 18:39:35 to
18:43:36 SGT (4m 1s).

Checkpoint 1 completed first in Run
`ebc5227a-1ba8-467c-a316-f2760bd5d6d5` and was durably accepted. With
checkpoint 1 already saved, the visible Kill Switch stopped checkpoint 2 Run
`27bc7b49-b2da-43bb-9c27-89fd256ab09f`. Its unfinished output remained
ineligible and its transaction was discarded. The coordinator reassigned only
checkpoint 2 to fresh Run `a09b836b-2a10-45fe-9ae6-859ad79d8098`; checkpoint
1 was not run again. Checkpoint 3 then completed once in Run
`dee66693-ea98-4f46-8c7c-03484d3a7ff5`. The final accepted sequence is
therefore `1 -> 2 -> 3`, while attempts are `1 -> 2 (stopped) -> 2 (accepted)
-> 3`.

The completed session contains 43 middleware events and 71 observable Runtime
events. Glassbox verified all 114/114 causal links locally and displayed final
evidence-root SHA-256
`ffedac19aa4f8248a01ce5bf7758c27c0ec8b580f041f5b075fe24a8b2648086`,
sealed at 18:43 SGT. Three trusted-host Proof Gate attestations passed at
375x812 and 1440x900 with 0px horizontal overflow and zero browser/page errors.

The final UI was visually inspected at 1280x720 and 1440x900. Both had 0px
document overflow, opened completed Runs at the first message, exposed the
recovery Run IDs and result/evidence actions above the fold, and kept all raw
events available behind an initially collapsed record. Settings showed the
server-enforced `Launchpad Guarded v1` profile attached to all five workspaces.
The exact final launcher build SHA-256 is
`3e1b08059eb3094f29b1cdeb3b451241e37d78a298505142d9a8353727f7a297`.

A final context-isolated reviewer, given only the official matrix, meeting
transcript, and live UI, scored: immediate clarity 9/10, usefulness 10/10,
middleware visibility 10/10, authenticity 9/10, visual quality 9/10, failure
handling 10/10, reusability 10/10, and differentiation 10/10. This is a cold
UI/demo assessment, not a guarantee of judging outcome, remote reproduction,
deployment, or submission.

## Snake failure diagnosis and transactional Proof Gate repair

The exact Playground prompt `build a snake game` originally failed in session
`657ae9c1-a2dd-46d5-a26b-8b0f6fcceb72`. The planner selected one task-specific
worker and the worker produced a complete game on each bounded attempt. Its
logic tests passed, but the worker reported `STATUS: BLOCKED` because its
sandbox could neither bind a localhost port (`listen EPERM`) nor launch the
trusted browser wrapper. The coordinator rejected the status before the
trusted-host Proof Gate could run, then discarded all three isolated workspace
transactions. This was a control-plane contract defect: the sandbox was being
asked to provide evidence available only to the trusted host. The UI reduced
this distinction to a generic failed Run, so the discarded working result was
not understandable from the primary view.

The repair moves the Proof Gate before promotion and makes it attest the exact
isolated transaction. A changed transaction that is blocked only by a
documented sandbox browser or port restriction can now be accepted only if the
trusted-host Proof Gate passes; ordinary worker blockers and failed
attestations still fail and are never promoted. The planner and worker
contracts now assign localhost/browser evidence to the control plane rather
than treating it as a worker prerequisite. The planning schema also accepts a
longer evidence description after a live retry exposed the former 300-character
limit as a separate 502 source.

After the repair, the same empty workspace and exact prompt succeeded in live
session `5b4e34dc-cc34-4f52-b301-b931243043e2`, created by planning Run
`136266a6-61be-48c3-9f0e-f995fe138328`. The planner selected one fresh worker
and four task-specific checkpoints; attempts were `{1:1,2:1,3:1,4:1}`. The
result contains a playable Snake page plus extracted deterministic logic. The
worker's final `npm test` passed 5/5, including movement, growth, collision,
vacated-tail, reversal-prevention, and deterministic-food checks. Trusted-host
Proof Gate receipts `205687df-fb27-4d27-85ce-6a89586c2085`,
`60c72e69-355d-4529-b926-b3bfeca788e8`, and
`84bac44c-44c5-4e70-95de-05280794b822` passed at 375x812 and 1440x900 with zero
horizontal overflow and zero browser/page errors. A separate live browser
interaction changed the generated game from `Ready` through `Start Game` to a
real `Game over` state, showing that the result was not a static screenshot.

This repair establishes successful creation and safe promotion for this exact
case. Proof Gate still checks loadability, errors, overflow, and basic visible
structure rather than arbitrary game semantics; the interaction observation is
separate evidence. Glassbox information design and concise explanation of the
worker/control-plane boundary remain open product work and are not claimed as
fixed here.
