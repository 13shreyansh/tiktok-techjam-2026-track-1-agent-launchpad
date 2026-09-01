# Durable Agent Relay baseline evidence — 2026-08-29

## Environment

- Host: Apple Silicon macOS (`darwin-arm64`).
- Node: `v22.23.2` from the ignored preparation toolchain.
- NATS Server: `v2.14.5`, pinned and checksum verified.
- Organizer starter: commit
  `8d0bd4f14ad1e453d984149aebcdd0bcb4f74178`.
- No authorized model key or model endpoint was available during this pass.

## Verified commands and observed results

### Full application gate

```bash
export PATH="$PWD/workspaces/toolchain/node22/bin:$PATH"
npm run check
```

Observed success after relay integration:

- server and web TypeScript checks passed;
- seven server test files passed;
- 34 tests passed, including thirteen relay protocol tests, relay HTTP
  boundary tests, focused Run-cancellation lifecycle tests, and a graceful
  service-shutdown cancellation test;
- Vite production build passed;
- server production build passed.
- the evidence endpoint's SHA-256 value was independently recomputed in the
  HTTP boundary test and matched the returned evidence object.

### Combined one-command gate

```bash
npm run verify:relay
```

This single command completed the full application gate, live JetStream
adapter proof, combined coordinator-and-NATS restart proof, live durable
operator-cancellation proof, client disconnect/reconnect proof, live
two-protocol reuse proof, and compiled SSE/Recovery Drill proof. The latest
observed run passed all 34 tests and all six live proofs in `39.65` seconds wall
time with a maximum resident set size of `292,175,872` bytes on this host. A subsequent
`npm audit --audit-level=moderate` reported `found 0 vulnerabilities`.

### Focused dependency remediation

```bash
npm audit fix --no-audit --no-fund
npm audit --audit-level=moderate
npm run check
```

The non-forced fix changed seven packages within already declared version
ranges. The audit then reported `found 0 vulnerabilities`, and all 34 tests
plus both production builds passed again. No `--force` upgrade was used.

### Provider-neutral Responses configuration

Four added tests cover the workshop-permitted provider path:

- original Ark variables still generate the original provider identity;
- `MODEL_*` variables generate a custom Responses provider;
- neither provider key is written into `config.toml`;
- partial `MODEL_*` configuration fails closed instead of mixing in Ark
  fields; and
- container arguments contain only the selected environment-variable name,
  never its value.

Both real launch scripts were also syntax-checked. With all provider variables
absent, and separately with valid-looking Ark fields plus only a generic base
URL, `scripts/start-relay-demo.sh` exited `2` before startup and explained that
a partial generic configuration does not fall back to Ark. No model endpoint
was called.

### Live NATS adapter

The repeatable verification command builds the compiled adapter, starts the
pinned broker on an isolated port with a temporary file store, exercises the
adapter, stops NATS, restarts it against the same store, verifies recovery, and
removes only its `mktemp` directory:

```bash
npm run verify:relay-live
```

The compiled `NatsRelayBus` then created a KV session, published the same turn
twice, pulled and acknowledged it, and read state. Observed JSON:

```json
{"firstDuplicate":false,"secondDuplicate":true,"delivered":2,"deliveryCount":1,"state":"running"}
```

After stopping and restarting the NATS process against the same storage path,
the compiled adapter observed:

```json
{"restored":true,"status":"running","expectedValue":2}
```

NATS startup logged restoration of both `AGENT_RELAY` and
`KV_agent_relay_state`, including the durable consumer.

### Combined coordinator and NATS restart

The stronger restart proof runs one accepted turn through the compiled real
coordinator and JetStream adapter, exits that Node process, stops NATS, restarts
NATS against the same storage directory, and launches a new coordinator process:

```bash
npm run verify:relay-restart
```

Observed output:

```json
{"phase":"before-restart","status":"running","acceptedValues":[3],"expectedValue":2}
{"phase":"after-restart","status":"completed","acceptedValues":[3,2,1],"uniqueTurnIds":true}
```

The random session ID is omitted above. This uses a disclosed deterministic
Agent gateway that returns the requested integer, so it proves real process and
JetStream recovery plus coordinator semantics—not model execution quality.

### Live durable operator cancellation

The cancellation proof starts a real compiled coordinator and JetStream
adapter with a disclosed deterministic gateway whose Run remains `running`.
It waits until that exact Run ID is durable, commits an operator stop, confirms
the Run is cancelled with no accepted value, restarts NATS from the same files,
and verifies the terminal session is inert:

```bash
npm run verify:relay-cancel
```

Observed output:

```json
{"phase":"before-restart","status":"cancelled","acceptedValues":[],"agentRunCancelled":true}
{"phase":"after-restart","status":"cancelled","acceptedValues":[],"pendingDelivery":false}
```

The random session ID is omitted above. This proves live JetStream state,
Run-cancellation coordination, and post-restart terminal behavior. It does not
claim a model call or a multi-node broker.

### Live client disconnect and reconnect

The disconnect proof runs the compiled Fastify API, real SSE endpoint, compiled
coordinator, and JetStream adapter. A disclosed delayed deterministic gateway
keeps the protocol observable without claiming model execution:

```bash
npm run verify:relay-disconnect
```

The first SSE client disconnected before any value was accepted. The relay
then completed while no client was attached, and a fresh client received:

```json
{"disconnectedAtAcceptedTurns":0,"completedWhileDisconnected":true,"reconnectedStatus":"completed","acceptedValues":[10,9,8,7,6,5,4,3,2,1]}
```

This proves the browser connection is not the state carrier. It does not prove
real-model output or cross-application-instance event fan-out.

An earlier combined-gate teardown exposed an SSE snapshot racing a closing
JetStream connection and logged `connection closed` after the proof result.
Shutdown was reordered to stop relay intake, drain HTTP/SSE, close active Agent
Runs, wait for the coordinator loop, and only then close the bus. The focused
disconnect proof and the final combined gate subsequently completed without
that error-level teardown log.

### Live task-protocol reuse

The reuse proof runs one compiled coordinator and one live JetStream instance,
then creates two task types through the same public coordinator contract:

```bash
npm run verify:relay-reuse
```

Observed output:

```json
{"sameMiddleware":true,"countdownOutputs":["3","2","1"],"handoffOutputs":["PLAN","BUILD","TEST","SHIP"],"handoffAttributedAgents":3,"countdownTaskType":"countdown","handoffTaskType":"ordered-sequence"}
```

The gateway is deliberately deterministic. This proves that assignment,
durability, exact acceptance, attribution, and completion are reusable across
different ordered task protocols; it does not prove model obedience.

### Live SSE delivery

The repeatable streaming proof builds the compiled app, starts the pinned NATS
broker and application with all model credentials explicitly absent, opens the SSE
response, creates two Agents and one relay session through the real HTTP API,
and verifies monotonic durable snapshots:

```bash
npm run verify:relay-sse
```

Observed output:

```json
{"terminalStatus":"failed","streamSnapshots":5,"credentialMode":"absent","runCounts":[0,0]}
{"eventCounts":[0,3,5,5,8],"monotonic":true,"faultInjected":true}
```

The emitted session ID is intentionally omitted above because it is random on
each run, and snapshot batching may change the intermediate counts. The
terminal failure is the expected honest outcome without a model provider. The first Agent
was skipped by the explicit drill; the replacement Agent then hit the starter's
credential guard before a Run was created, explaining `runCounts:[0,0]`. The
proof establishes live delivery and the injected boundary, not model success.

### Browser acceptance

The local app was started with `RELAY_ENABLED=true`, three disposable Agents
were created through the existing API, and the Durable Relay page was exercised
in the browser at desktop and 390×844 widths.

Observed:

- existing Agent Playground remained reachable;
- relay health showed online;
- all three ready Agents were selectable;
- the absent Ark configuration caused three bounded claims across three
  Agents, two visible retries, and a terminal failure;
- the timeline clearly attributed each claim and failure;
- after the SSE change, a new session and its seven-event failure timeline
  appeared without a page reload and the health indicator read
  `JetStream + live stream online`;
- after enabling Recovery Drill, the control label explicitly said it rejects
  one claim before the model call and never simulates output; the browser then
  displayed the attributed `fault injected` event in a ten-event timeline;
- a 20-Agent absent-credential session was stopped from the compiled UI between
  retries; it became visibly `cancelled` with `0/10` accepted values, retained
  its ordered timeline and evidence export, and removed the stop action after
  reaching terminal state;
- mobile layout had no horizontal overflow (`body.scrollWidth = 390` at a
  390-pixel viewport);
- browser console contained no warnings or errors.

A later compiled-page pass selected **Handoff** with three disposable Agents.
It displayed the exact pending chips `PLAN,BUILD,TEST,SHIP`, attributed three
credential-absent claims and two retries across the selected Agents, and
entered a visible terminal `failed` state with `0/4 exact steps`; no output was
accepted or simulated. At 390×844, `body.scrollWidth` and
`documentElement.scrollWidth` both equalled `390`, both protocol buttons and
all four word chips were visible, and the browser warning/error log was empty.

This headed-browser pass proved the real failure path, not real-model countdown
reproduction. At that point, exact real-Agent `10 → 1` remained blocked by
absent provider credentials and the macOS security block on the starter-pinned
Runtime. A later signed local Runtime/ChatGPT-auth run closed that local gate;
see `evidence/2026-08-29-live-chatgpt-relay.md`.

## Deterministic protocol proofs

`apps/server/src/relay-coordinator.test.ts` proved:

1. exact accepted sequence `10,9,8,7,6,5,4,3,2,1` across three Agents;
2. reuse of one coordinator and bus across two disjoint Agent teams;
3. reassignment after a simulated Agent disappears before starting;
4. cancellation and reassignment when an Agent remains running beyond its
   turn timeout;
5. no second Agent call after simulated commit-before-ack failure;
6. pending work recovery after constructing a new coordinator;
7. terminal failure after two invalid outputs.
8. observer notification after each committed relay state transition.
9. an opt-in recovery drill emits `fault.injected`, makes zero gateway calls for
   the injected attempt, and completes the turn through the next Agent.
10. an operator stop durably enters `cancelled`, cancels the exact active Run,
    and accepts no result afterward.
11. the same stop wins a race where Agent Run creation is still in progress;
    the newly known Run is cancelled and no output is accepted.
12. one coordinator completes the ordered handoff sequence
    `PLAN,BUILD,TEST,SHIP` across three Agents.
13. unsafe, empty, oversized, and ambiguous ordered task definitions are
    rejected at session creation.

`apps/server/src/agent-service.test.ts` separately proves that cancelling the
specific timed-out Run terminates its active execution while returning the
Agent to `ready`, rather than stopping the Agent itself. A separate test proves
graceful service shutdown requests cancellation and waits for the active Run to
reach `cancelled`.

These use a fake Agent gateway and in-memory bus to make fault placement exact.
They verify middleware logic, not NATS persistence or model quality; those are
covered separately above.

## Evidence export boundary

`GET /api/relay/sessions/:id/evidence` returns a versioned object containing the
durable session plus computed exact-sequence, accepted-turn uniqueness, retry,
duplicate-suppression, Recovery Drill, and operator-cancellation facts. The
response also includes a SHA-256 of that evidence object; the UI downloads both
together. The checksum
supports accidental-corruption/self-consistency checks. It is not a signature,
trusted timestamp, or third-party attestation.

## Resource observation

The earlier clean `npm ci` of the pinned starter plus dependencies completed in
2 seconds with a maximum resident set size of `240,173,056` bytes. NATS
advertised a 48 GB configurable memory ceiling, which is a server limit rather
than observed consumption; no measured RSS claim is made for the NATS process
in this checkpoint.

## Blockers and unproved claims at this checkpoint

- Real Ark/Codex countdown: blocked here by absent organizer credentials; a
  later signed local Runtime/ChatGPT-auth run completed it.
- Multi-node failover: not attempted; the local topology is one NATS process.
- Disk or machine loss: not survived by a single-node local deployment.
- Cross-instance SSE notification: not reproduced; current-process commits
  push immediately and each connection resynchronizes durable state every five
  seconds.

## Checkpoint-workflow live browser proof

After the primary product was narrowed to one recovery capability, the compiled
app was launched with:

```bash
PATH=/Users/shreyansh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/shreyansh/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH \
CODEX_AUTH_MODE=chatgpt NATS_PORT=4431 PORT=3401 \
pnpm dlx npm@11.6.2 run relay
```

Observed Runtime: `codex-cli 0.150.0-alpha.12.2`. The browser form was blank.
The user entered unique `ORBIT-742` facts and three checkpoints, then started
session `b2b99bc1-b829-474e-817e-38e806de8ee8` through the visible UI.

- Created: `2026-08-29T08:59:13.856Z`.
- Completed: `2026-08-29T08:59:35.960Z` (22.104 seconds).
- Checkpoint attempts: `1:1`, `2:1`, `3:2`.
- Accepted real Runs: `2e53cf0f-df66-4c30-b147-c7a9df81d460`,
  `025c776d-458a-4f3b-a381-f3584a700d60`, and
  `6234c03b-5022-4630-baee-cbf88fce30dd`.
- Interrupted real Run: `dd343737-9f56-4697-8d03-27001c06cf73`; cancellation
  was durably recorded and that Run was not accepted.
- The browser was reloaded after interruption. It restored the same task, two
  completed checkpoint outputs, the lost-worker callout, and the replacement
  worker from JetStream. The replacement then completed checkpoint 3.

The final visual pass showed `3/3 saved`, `1 worker restart`, all three concise
outputs, their Agent names and Run IDs, and a collapsed 22-event technical log.
The verification command below then passed all seven test files / 40 tests,
both TypeScript gates, and both production builds:

```bash
PATH=/Users/shreyansh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/shreyansh/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH \
pnpm dlx npm@11.6.2 run check
```

This proves checkpoint-level recovery, not partial-output continuation. The
interrupted checkpoint restarts from its beginning, and tool/filesystem side
effects inside its Agent workspace are not automatically rolled back.

## Clean-source coordinator-restart browser proof

After the UI gained a durable `coordinator.recovered` event, the same launcher
started clean source `1598ea19791ff878f7717e03a79c2e260f6c47c5`, compiled
build SHA-256
`791c8ebf1864a2a1e63674d101588aa3714b0432b4196b249b20ce1b2e05b5e1`,
and `codex-cli 0.150.0-alpha.12.2`. The browser entered fresh `SUMMIT-804`
facts and five checkpoints and created session
`d9f5da51-57bf-41a5-b84a-55b21593f788`.

- Created: `2026-08-29T09:21:11.229Z`.
- Completed: `2026-08-29T09:21:48.718Z` (37.489 seconds).
- Before shutdown, checkpoints 1 and 2 were accepted and checkpoint 3 had an
  active real Run.
- The launcher received `SIGINT`, closed the coordinator, and a new invocation
  restored the same file-backed JetStream state.
- Recovery event 15 recorded: `Coordinator restarted. 2 completed checkpoints
  stayed saved; checkpoint 3 returned to the durable mailbox and restarted
  from the beginning.`
- Abandoned Run `98b20bd3-9b2f-40d7-9cc1-dc9a1d09c4bb` was cancelled and was
  not accepted. Checkpoint 3 completed at attempt 2.
- Accepted real Runs were `f98434db-cf9a-48ad-9283-2a7ace983936`,
  `d9d09cf8-2c8f-4251-bfd1-2cd98acb396a`,
  `d119a8cf-423e-4426-8ae1-d1eb9f7b7e70`,
  `2b35cd24-ec8d-4d1d-80ce-5cc504b6345a`, and
  `b1a73fcf-cbd3-4d06-8214-bacbe7524f2a`.
- The completed receipt had snapshot digest
  `f6528d3d77ac5cec7dfe3fe93c75015354d79087fe43a33cc73204c68e557d8c`
  and content digest
  `f97ff72b5ca770ee3524ce16f86cd1137cf048700a0f05d822dbde079b4605c8`.
- The browser visibly showed `Coordinator restarted`, `1 coordinator restart`,
  `5/5 saved`, the five outputs/Agents/Run IDs, and no console errors.

This was a real graceful coordinator-process restart. It does not prove that an
uncatchable crash can cancel its in-flight Runtime process, nor does it prove
machine-loss or multi-node failover. Durable redelivery, idempotent acceptance,
and bounded retry remain the safety net for those harsher boundaries.

The final comprehensive local command was:

```bash
PATH=/Users/shreyansh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/shreyansh/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH \
/usr/bin/time -l pnpm dlx npm@11.6.2 run verify:relay
```

It passed 40 tests, both production builds, and all six compiled/live JetStream
proofs in 18.28 seconds with 405,913,600 bytes maximum resident set size.
