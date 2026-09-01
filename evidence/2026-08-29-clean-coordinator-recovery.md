# Clean coordinator and recovery evidence — 2026-08-29

## Claim tested

A three-Agent job can use one shared workspace, save a completed stage before
starting the next, terminate a real active worker, reject its unfinished
output, reassign only that stage, and finish without saving any stage twice.

## Environment

- Time window: 2026-08-29 23:13:41–23:15:12 SGT
- Host: Apple M5 Pro, 18 logical CPUs, 68,719,476,736 bytes memory
- Runtime: `codex-cli 0.150.0-alpha.12.2`, local process, existing ChatGPT login
- Clean source revision:
  `9cd658fb744ae8b51e7912b36c1aef7c6dce84ca`
- Live build SHA-256:
  `e93174b15ec2e354f14ad6555eafbe1020af7d9ba935eed0f05648a46605c2b8`
- Session: `90bdae04-f923-4d90-a2ce-cf8d6470e983`
- Server RSS after the proof: 117,872 KiB; NATS RSS: 80,560 KiB

## Ordinary job

The same checkpoint-workflow endpoint used by the primary Playground received
this task:

```text
Add a compact visible badge reading 'Durable team verified' beside the title
in the existing tic-tac-toe page. Keep the game working and verify both the
badge and normal game behavior.
```

The middleware selected three ready Agents and the existing tic-tac-toe
workspace. The first Agent inspected the workspace and checkpoint 1 was saved
under Run `e9cbfd78-4d60-40b1-9b1d-4fde70e7f25f` before checkpoint 2 began.

## Real worker termination and reassignment

Run `0e72ad4b-54df-4594-b39f-5b863b93e7ec` started checkpoint 2 for the second
Agent. The interrupt endpoint was invoked 61 ms after the live session first
reported that exact Run as active. Durable events then recorded:

```text
15:13:58.335  run.interrupt-requested
15:13:58.383  run.interrupted
15:13:58.389  turn.retrying
15:13:58.644  next Agent claimed checkpoint 2, attempt 2
```

The interrupted Run ended `cancelled`, with `output: null`, `usage: null`, and
the control traces `Kill Switch requested` followed by `Runtime terminated`.
It was not listed in the accepted checkpoints. The replacement Run
`1c45b289-f704-45b7-9d41-e2c7d1a5d1fd` used `apply_patch` to add the badge and
was the only accepted result for checkpoint 2.

Checkpoint 3 then ran as `8acd843c-c796-4a9b-9a31-bb5af244185b`. The session
completed after 90.8 seconds with accepted values `[1, 2, 3]`, attempts
`{1: 1, 2: 2, 3: 1}`, and three distinct accepted Run IDs. The final event
states: `All 3 checkpoints completed; no saved checkpoint was repeated`.

The evidence receipt digests were:

```text
receipt SHA-256: 39702866f1b65521bb83d8d16efcfc61d95d5a0118e17e8e9165ca50f3973bb8
content SHA-256: 92e03083599f56da9b444945333d08238cc00ab77e47665a3768112586d8d53d
```

## Served result and boundaries

The workspace preview endpoint returned available, served the changed HTML,
and its response contained `Durable team verified`. The JavaScript asset also
returned HTTP 200. Final workspace SHA-256 values were:

```text
index.html  17c6453925e993f37ed00352b93b6c463e871c66679668f5531849ac84f910d5
styles.css  fad751f9d5172df018e78821a4d194384389b1f3ad6f293885113682dd5b4d41
script.js   74f83335e3465042b4ef9bb47b7517201c95a7dc1b935b52cc48430835b5bb07
```

This proves real Runtime work, durable stage saving, rejected unfinished
output, reassignment, and a served changed artifact. It does **not** claim a
fresh browser interaction pass: browser automation was unavailable, so the
game behavior was inspected from source and the live HTTP assets were checked,
but clicks were not automated. The failure was operator-triggered. Work is
sequential by design to prevent concurrent writes to one workspace, and only
two Agents produced accepted outputs because the second Agent was terminated.
