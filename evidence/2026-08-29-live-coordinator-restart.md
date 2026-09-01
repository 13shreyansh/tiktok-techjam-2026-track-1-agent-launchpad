# Live coordinator restart evidence — 2026-08-29

## Claim tested

After one stage is durably saved and the next real Codex Run is active, an
application/coordinator restart preserves the saved stage, rejects the
interrupted Run, returns only the unfinished stage to JetStream, and completes
the job without duplicate acceptance.

## Environment

- Time window: 2026-08-29 23:19:50–23:20:42 SGT
- Host: Apple M5 Pro, 18 logical CPUs, 68,719,476,736 bytes memory
- Runtime: `codex-cli 0.150.0-alpha.12.2`, local process, existing ChatGPT login
- Clean source revision:
  `5d6cc6b134b2b2e568926f115098757e323e49e5`
- Live build SHA-256:
  `e93174b15ec2e354f14ad6555eafbe1020af7d9ba935eed0f05648a46605c2b8`
- Session: `8abd45e3-d39a-4779-98c9-4b83be5c3934`
- Server RSS after recovery: 124,496 KiB; NATS RSS: 49,072 KiB

## Read-only job

Three ready Agents received one shared-workspace job to inspect the existing
tic-tac-toe badge and source without modifying files. Run
`ea85165a-339f-45d9-a3ef-7b7692a3992a` completed checkpoint 1, and the
middleware saved it at `15:20:02.686` before Run
`ee23f685-ad3d-4baa-a8e2-d2612c2437a5` began checkpoint 2.

The second Run connected to a real Codex Runtime and reported that it would
inspect `script.js`. At `15:20:09.390`, the application received `SIGINT`.
Graceful shutdown cancelled that tracked Run; it finished `cancelled` with
`output: null`, `usage: null`, and no accepted checkpoint result.

The application and file-backed NATS process were down for approximately 11.4
seconds. The same clean build then restarted against the same state directory.
Startup recorded:

```text
15:20:20.643  coordinator.recovered
               1 completed checkpoint stayed saved;
               checkpoint 2 returned to the durable mailbox
15:20:20.821  replacement Agent claimed checkpoint 2, attempt 2
15:20:20.826  replacement Run started
```

Replacement Run `cfea1f81-372a-4fd5-813c-0c1c57eb4275` completed checkpoint
2. Run `f7686018-fa23-4df6-8769-5ceb9892d7ff` completed checkpoint 3. The final
accepted values were `[1, 2, 3]` with attempts `{1: 1, 2: 2, 3: 1}` and three
distinct accepted Run IDs. Checkpoint 1 remained accepted exactly once.

The exported evidence digests were:

```text
receipt SHA-256: ca4b96d2ca9cb09cac03dded88ec49434c5d228438ab8b5cb6ce5801cd9d3270
content SHA-256: cdd9e3a412d1f6971f764c3a1c3453d6cae24ceb8740dfbbea41551abca75666
```

The workspace remained byte-identical to the hashes recorded before this
read-only proof:

```text
index.html  17c6453925e993f37ed00352b93b6c463e871c66679668f5531849ac84f910d5
styles.css  fad751f9d5172df018e78821a4d194384389b1f3ad6f293885113682dd5b4d41
script.js   74f83335e3465042b4ef9bb47b7517201c95a7dc1b935b52cc48430835b5bb07
```

## Boundary

This was a graceful process restart: the shutdown handler ran, cancelled the
tracked child process, and NATS reopened its file-backed store. It is evidence
for coordinator/application restart recovery, not `SIGKILL`, sudden power
loss, disk loss, or multi-node failover. Recovery restarts the unfinished
checkpoint from the beginning; it does not resume partial model output.
