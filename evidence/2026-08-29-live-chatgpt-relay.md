# Live Codex + JetStream browser proof — 2026-08-29

## Scope

This is the first successful real-model proof for the judged middleware. It
used the pre-existing ChatGPT login of the current, signed Codex CLI. No token,
API key, auth cache, or credential value was read, copied, printed, mounted
into a container, or written to this repository. The provider-key/Ark route
remains the portable deployment path; ChatGPT login mode is explicitly local
host-process only.

Runtime used:

- `/Applications/ChatGPT.app/Contents/Resources/codex`
- `codex-cli 0.150.0-alpha.12.2`
- SHA-256 `67ea03c98e7726eeebd161bc3bc92d8937f412f1899790a28e4ee9b80803c4d7`
- signed by OpenAI OpCo, LLC, Team Identifier `2DC432GLL2`
- containing ChatGPT app accepted by Gatekeeper as Notarized Developer ID

The blocked `0.111.0` artifact was not restored, executed, or bypassed.

## Authentication and first live call

Read-only status:

```text
$ /Applications/ChatGPT.app/Contents/Resources/codex login status
Logged in using ChatGPT
```

A disposable read-only CLI call succeeded and returned a real thread, message,
and usage event. A second call added `--ignore-user-config`, which the local
demo mode now uses so personal configuration is not loaded while authentication
still comes from the existing Codex home.

```text
thread.started: 01a04c57-9d66-7b43-9af9-9e634d0d3f04
agent_message: LEAN_RUNTIME_OK
turn.completed: input 13,601; cached input 11,008; output 7
```

## Actual application launch

The production web build and server build completed before launch. The live
application used file-backed NATS JetStream `2.14.5` on loopback, a local
host-process Runner, `read-only` Codex sandbox mode, ignored application state,
and `CODEX_AUTH_MODE=chatgpt`. No provider secret variables were present.

The browser then created three ordinary starter Agents: Planner, Builder, and
Reviewer. A real Playground turn completed visibly:

```text
Prompt: Reply with exactly PLAYGROUND_OK and nothing else. Do not inspect or
modify files and do not run commands.
Result: PLAYGROUND_OK
UI state: ready; Session connected
```

## Real middleware results

### Recovery handoff

- Session: `918bd080-fc1c-4b17-9c0b-0132beb1211d`
- Protocol: `PLAN → BUILD → TEST → SHIP`
- Created: `2026-08-29T07:15:31.542Z`
- Completed: `2026-08-29T07:15:50.746Z`
- Wall time: `19.204 s`
- Result: `4/4` exact steps; three attributed Agents
- Adversity: first PLAN claim rejected before any model call
- Recovery: one durable retry, then a real replacement-Agent Run
- Accepted outputs: `PLAN, BUILD, TEST, SHIP`
- Evidence schema: `3`
- Evidence SHA-256:
  `55c1a52fd2a4014a4823cad20badad7d8c9c3607d041b55cdf3e3c90d815c03f`

### Disconnect/reconnect countdown

- Session: `195cc2ed-307b-4f12-8bb5-77c7da202536`
- Protocol: exact `10 → 1`
- Created: `2026-08-29T07:16:12.152Z`
- Completed: `2026-08-29T07:17:09.721Z`
- Wall time: `57.569 s`
- Result: `10/10` exact turns; zero retries; three attributed Agents
- Browser reload occurred while the session was running. The refreshed page
  returned directly to the same Relay session and displayed
  `Restored 2 accepted turns from JetStream after reconnect`; the coordinator
  continued to five accepted turns during the disconnected interval and then
  completed all ten.
- Accepted outputs: `10,9,8,7,6,5,4,3,2,1`
- Evidence schema: `3`
- Evidence facts: `exactSequence=true`, `exactCountdown=true`
- Evidence SHA-256:
  `ede4fd55401677cac59688fc0328f8326326f2c670c269d515f3ea6e12725033`

Across the actual starter Playground, handoff, and countdown there were 15
real Codex Runs, all 15 completed and none failed. Recorded Runner usage was
208,316 input tokens, 185,600 cached input tokens, and 78 output tokens. The
two preliminary CLI probes separately used 32,055 input tokens, 22,016 cached
input tokens, and 14 output tokens.

## Adversarial browser findings

A headed-browser sub-agent reproduced a live race in which JetStream KV key
iteration temporarily returned the same session key more than once. One POST
therefore appeared as three identical session objects in a GET response and as
phantom proof-history rows. The NATS adapter now de-duplicates keys and session
IDs, and the React client independently keeps only the newest snapshot per ID.
The same concurrent window was repeated after the fix: five immediate GETs
each returned exactly one matching session, and the UI showed one row.

Other live fixes verified through the browser:

- Relay view and selected session survive reload;
- a nonzero JetStream restoration banner is visible after reconnect;
- unconfigured Runtime disables Run instead of burning attempts;
- Agent status and team order stay synchronized during Relay events;
- accepted chips show the producing Agent initial;
- evidence schema 3 includes participant Agent IDs and names;
- evidence export independently recomputes SHA-256 in the browser before
  download; a completed-session export displayed
  `SHA-256 verified · d861d905…` and downloaded with no console error;
- local-process Runtime labels are accurate;
- the newest-first timeline is labelled as such;
- desktop and 390×844 mobile views had no horizontal overflow;
- no browser console warnings or errors were observed;
- clean server shutdown produced no Relay error.

## Resource snapshot and limits

Hardware: Apple M5 Pro MacBook Pro, 18 CPU cores, 64 GB memory. After both real
proofs completed, the application server showed 80,752 KiB RSS and NATS showed
31,984 KiB RSS at idle. These are point-in-time RSS readings, not peak-memory
measurements. The live topology was one local file-backed NATS process; it does
not prove multi-node, disk-loss, or machine-loss recovery.

The ChatGPT-auth path is account-dependent and local-only. It is suitable for
the recorded local demonstration, not a claim that judges can reproduce it
without their own authorized login. Scoped provider credentials remain the
recommended deployment route.
