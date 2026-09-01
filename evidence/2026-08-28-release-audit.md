# Released-statement and source re-audit — 2026-08-28

All work remained within the assigned track. No middleware was selected or
implemented, no credential value was accessed, and no external submission,
registration, repository-visibility, or organizer action was taken.

## Released public statement

At `2026-08-28 11:15 SGT`, the public Lark information document showed `Last
updated: Aug 28`. Browser navigation inspected the Agent Launchpad table of
contents and each section from 1.1 through 1.12, including all five recommended
examples, custom middleware, demo, deliverables, acceptance, rubric, and FAQ.

Observed workshop data:

```text
28 August 2026, 1:00–1:45 PM SGT
https://vc-my.larkoffice.com/j/484622806
Recording promised by 29 August, 12:00 PM
```

Anonymous command-line retrieval was retried without authentication:

```bash
curl -fsSL --compressed --max-redirs 5 -o /dev/null \
  -w '%{http_code}\t%{url_effective}\t%{size_download}\n' \
  'https://bytedance.larkoffice.com/wiki/GdYFwzWNLiREsSkuIjZcDznInWc'
```

Observed: curl exited 47 after the maximum five redirects and reached a
Feishu account-domain cookie redirect. No statement export or checksum was
available. Browser content export was also unsupported. The audit therefore
records browser-visible facts and the mutable URL/update date, not a falsely
versioned document artifact.

## Starter and environment recheck

Commands:

```bash
git -C workspaces/CodeJam-upstream fetch --prune origin
git -C workspaces/CodeJam-upstream rev-parse HEAD origin/main
git ls-remote --heads --tags https://github.com/RrankPyramid/CodeJam.git
curl -fsSL https://api.github.com/repos/RrankPyramid/CodeJam/releases
```

Observed: local `HEAD`, `origin/main`, and remote `main` all remained
`8d0bd4f14ad1e453d984149aebcdd0bcb4f74178`; no tag or release was returned.
The ignored upstream checkout remained clean.

Prerequisite presence-only checks:

```text
host PATH: node, npm, docker, podman, colima, terraform absent
ARK_API_KEY: absent
ARK_MODEL: absent
macOS 26.6.2 (25G83), arm64, 64 GiB, 18 logical CPUs
```

The isolated Node distribution remains available under ignored `workspaces/`.
The live baseline was not retried because the two mandatory credentials and
all supported container engines remain absent. It is still not reproduced.

## Static baseline revalidation

Using the isolated Node.js `v22.23.2` and npm `10.9.8`:

```bash
/usr/bin/time -l npm run check
npm audit --json
```

Observed: `npm run check` exited 0; typechecking passed, 5 test files and all
12 tests passed, and both production builds succeeded.

```text
real 4.24 s; user 7.22 s; sys 0.74 s
maximum resident set size 289,406,976 bytes
peak memory footprint 25,250,720 bytes
```

`npm audit --json` exited 1 and still reported 1 moderate and 5 high findings,
0 critical. No fix changed the organizer lockfile.

## Package and infrastructure identity refresh

Read-only registry checks observed `@openai/codex` latest as `0.150.1`; the
starter remains intentionally pinned to `0.111.0`. An anonymous Docker Registry
token was used only in memory and not printed; `node:22-bookworm-slim` still
resolved to OCI index
`sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5`.
The `volcenginecc` provider tag `v0.0.58` still resolved to
`161f3df395e853cf00b733454c1415601b209a2d`, with all release hashes and sizes
unchanged. No image layer, provider archive, or newer Codex package was
downloaded or installed.

The five named ModelArk/veFaaS pages were reacquired as anonymous ignored HTML
shells. A fresh interactive body-text sweep exceeded its browser selector
deadline and produced no semantic result; the earlier article-content facts
are therefore not relabeled as reverified on 28 August. This does not affect
the final-scope finding: the released statement requires ModelArk for the
baseline but does not require or name veFaaS.

## Public source acquisition and comparison

```bash
bash -n scripts/acquire-official-resources.sh
/usr/bin/time -l scripts/acquire-official-resources.sh
```

Observed at `2026-08-28T03:14:04Z`: exit 0. The cached starter, Node, and Codex
archives matched their pinned SHA-256 values before reuse. Fresh ignored
Devpost, help, and platform-reference snapshots and a complete retrieval
checksum manifest were written.

```text
real 25.46 s; user 0.39 s; sys 0.17 s
maximum resident set size 8,192,000 bytes
peak memory footprint 1,671,480 bytes
```

Visible-text diffs against the 26 August Devpost snapshots found only the
participant count changing from 2,882 to 2,982. Updates still contained no
organizer post and Discussions still reported no topics. No rule, resource,
date, or submission requirement changed in those snapshots.

## Calendar action

At the user's explicit request, one private event was created on the user's
primary Google Calendar for the official Agent Launchpad workshop, 1:00–1:45
PM SGT, with the official webinar and information-document links and popup
reminders 30 and 10 minutes before the start. A bounded calendar search found
no existing matching event before creation. No guest was invited and no
Google Meet was created. Personal account identifiers and event IDs are not
recorded in this repository.

## Local commit and remote blocker

The reconciled preparation artifacts were committed locally as `b708d36`
(`docs: reconcile released challenge statement`). The subsequent
`git push origin main` attempt failed before transfer with:

```text
fatal: could not read Username for 'https://github.com': Device not configured
```

No credential was created, exposed, or stored, and no repository visibility
setting was changed.
