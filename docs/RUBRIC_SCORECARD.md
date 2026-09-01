# Evidence-backed Track 1 scorecard

Last reconciled: **2026-08-31 18:43 SGT**

This is an engineering gap ledger, not a predicted judge score. `Proved` means
the cited command or observed UI path succeeded. `Partial` means only part of
the official gate is proved. `Blocked` is never silently converted into a
mocked success.

## Universal acceptance gates

| Gate | Status | Direct evidence |
| --- | --- | --- |
| Preserve starter CRUD, lifecycle, Playground, persistence, and builds | Proved locally | Upstream commit is pinned; builds pass; the signed current CLI completed a real Playground turn with a persisted session. The blocked pinned binary is never used. |
| Solve one Agent-specific infrastructure problem | Proved | Durable Agent Relay owns assignment, ordering, recovery, cancellation, and evidence between the Fastify boundary and existing `AgentService`. |
| Execute outside the UI | Proved | The coordinator, JetStream stream/KV, compare-and-set ledger, acknowledgements, and Run cancellation execute in the backend. |
| Normal behavior plus adversity/recovery | Proved locally | Real checkpoint tasks completed through Codex Runs across both active-worker cancellation and a full coordinator stop/restart. The latter visibly preserved two saves, restarted only checkpoint 3, and completed 5/5. |
| Automate the core behavior | Proved | The current server suite passes 51 tests across 10 files, including adaptive planning boundaries, checkpoint save/retry invariants, transactions, hash chains, status contracts, and Proof Gate handoff; separate live adapter, restart, cancellation, disconnect, reuse, and SSE proofs remain available. |
| Reproducible setup | Proved | Pinned NATS acquisition, one-command gate, one-command real launcher, architecture, demo script, limitations, versions, checksums, and licences are present. |
| Keep secrets absent | Proved | No credentials are stored; server logs redact authorization/cookies; live absent-credential proofs fail closed. |
| Keep the platform controllable | Proved | Authenticated SSE, live disconnect/reconnect, bounded retries/timeouts, terminal failure, graceful shutdown, evidence export, and durable operator stop are implemented. |

## Required three-minute story

| Moment | Status | Evidence or exact remaining gate |
| --- | --- | --- |
| Select runnable Agents and see lifecycle state | Proved | Browser acceptance on desktop and 390x844 mobile. |
| Invoke a real Playground/model task | Proved locally | The signed current CLI used its existing ChatGPT login; Planner returned `PLAYGROUND_OK` and the UI showed Session connected. No credential was copied or printed. |
| Show a real infrastructure action | Proved | Live JetStream publish, pull, ack, KV, restart, and cancellation receipts. |
| Show visible middleware evidence | Proved | Compact Glassbox names the live worker/action while the app remains visible. Full Glassbox exposes all raw Runtime/middleware events plus seven receipts, including hashed trusted-host mobile and desktop screenshots. |
| Show an adverse/recovery case | Proved | In one visible session, checkpoint 1 was saved, checkpoint 2 Run `27bc7b49` was killed, only checkpoint 2 moved to fresh Run `a09b836b`, and checkpoints 2–3 finished once. |
| Remain understandable and controllable afterward | Proved | Browser reload restored the same task and outputs, displayed **Coordinator restarted**, showed `1 coordinator restart`, and reached `5/5 saved`. |

## Rubric-oriented assessment

| Official category | Strongest current evidence | Highest remaining risk |
| --- | --- | --- |
| End-to-end middleware behavior, 40% | Real browser/API/JetStream/Codex integration; adaptive 1-worker and multi-worker decisions; source-bound recovery; transactional checkpoints; stable content digest | Local account auth is not a portable hosted credential |
| Technical design and integration, 25% | Seven trusted-boundary receipts: Glassbox, Coordinator, Recovery, Kill Switch, Bouncer, Flight Recorder, and independent Proof Gate; organizer CRUD/Playground preserved | Single-host rename promotion is not a distributed transaction; shared writes are serialized |
| Verification and robustness, 20% | Live worker/coordinator recovery, genuine policy denial, truthful blocked terminal result, 51 passing tests, and repeated passed trusted-host browser attestations | Single-node storage does not prove cluster, disk, machine-loss recovery, external rollback, or arbitrary UI semantics |
| Demo and reproducibility, 15% | One plain prompt selected three justified workers; the UI shows the non-vacuous recovery chain, 114/114 linked events, passed browser receipts, and a usable preview. A cold transcript-only reviewer scored every UI/demo category at least 9/10. | Final video and remote reproduction remain open gates |

## Next gates in strict priority order

1. Re-run the exact three-minute flow immediately before recording and verify
   Runtime signature/version/login because the installed app can update.
2. Record the primary video plus a backup, using only the conversation-first
   live UI, real Kill Switch/recovery, and Proof Gate receipts.
3. Preserve the exported evidence bundles outside version control and
   verify the displayed digest values.
4. Only at submission time and with explicit user authorization, reconcile
   public repository, video, Devpost fields, and testing access requirements.

The strongest differentiator is transactional accepted-work survival: a killed
Runtime loses only its unfinished transaction, while accepted checkpoints are
not repeated. The causal Glassbox and independent Proof Gate make that claim
inspectable. The highest remaining risks are presentation discipline, the
portability gap between local ChatGPT auth and deployable scoped credentials,
and overclaiming what two viewport loads or single-node durability establish.
