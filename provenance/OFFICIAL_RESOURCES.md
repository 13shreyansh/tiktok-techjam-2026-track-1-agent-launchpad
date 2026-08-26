# Official resource provenance

Observed on **2026-08-26 SGT**. The starter repository URL was supplied in the
track assignment as the official starter. The Git commit is unsigned; this
record preserves provenance but does not independently authenticate the
publisher.

## Organizer-provided starter repository

| Field | Recorded value |
| --- | --- |
| Repository | <https://github.com/RrankPyramid/CodeJam> |
| Clone URL | <https://github.com/RrankPyramid/CodeJam.git> |
| Default branch | `main` |
| Commit | `8d0bd4f14ad1e453d984149aebcdd0bcb4f74178` |
| Commit URL | <https://github.com/RrankPyramid/CodeJam/commit/8d0bd4f14ad1e453d984149aebcdd0bcb4f74178> |
| Git tree | `a6aa27caf05d15d6d4326a76fa7243df5c10942d` |
| Commit timestamp | `2026-07-20T19:28:27+08:00` |
| Commit subject | `Initial commit` |
| Signature status | Unsigned (`verified: false`, reason `unsigned`) |
| Branches/tags | One branch (`main`); no tags observed |
| GitHub releases | None observed |
| Archive URL | <https://github.com/RrankPyramid/CodeJam/archive/8d0bd4f14ad1e453d984149aebcdd0bcb4f74178.tar.gz> |
| Archive size | 143,348 bytes |
| Archive SHA-256 | `a71aa56bca1a6ba388973079370f44af8bff88bccd8f2fdb5dad30a43bfe7b31` |
| Licence | MIT; preserved at [CodeJam-MIT.txt](../LICENSES/CodeJam-MIT.txt) |

The commit includes the application source, Docker/runtime files, Terraform
deployment files, two screenshots, architecture/local/deployment/security
documentation, the hackathon extension guide, and ten `hackathon-v2` XML
statement fragments/skeleton files. The immutable commit and archive checksum
cover all of them.

The statement skeleton calls the challenge **“CodeJam Track #5 v2 — Agent
Middleware Challenge”** and the public information document lists **Platform
Middleware** among five focus areas. The `track-1` directory name in this local
workspace is therefore treated only as an isolated preparation-task label.

Critical file checksums:

| File at the pinned commit | SHA-256 |
| --- | --- |
| `LICENSE` | `46544a1dd5f3ba1a36e5b90d70ba92d3f868bafbc3143419474b8c324b4e7669` |
| `README.md` | `abc099a48f79b45e1cf1bdfa97176ef0fc987075bf2ebec741077fc4d094c9d9` |
| `SECURITY.md` | `c06a9c7e882b32e49005479c5442c2cec27a3754a1187ae1bac04312672b269b` |
| `docs/ARCHITECTURE.md` | `a971963c1ba6d759952e358b3ac506c33688f8592f60d94d866c6c2443e652b8` |
| `docs/HACKATHON_EXTENSION_GUIDE.md` | `2e6d8ce48283c0e3b38ffabca0288dc41477b9f201d24b6d739818ed95152dde` |
| `docs/LOCAL_POC.md` | `0160bb20e45f4ef19ed22e07207a6b6ffb9c5832cd11c55f54618f0f2b760037` |
| `package.json` | `a7b820dc16ef113f0f4b7004e48af9cc1194dd5da4f5847610f188349dd3c806` |
| `package-lock.json` | `232da73b03d4ae402e274a4dd3cc0d787c3b91ad5c873c83f7386d7a5bfc621a` |

## Event and submission resources

| Resource | URL | Version/checksum status |
| --- | --- | --- |
| Devpost overview | <https://tiktoktechjam2026.devpost.com/> | Live HTML snapshot retrieved `2026-08-26T11:56:20Z`; SHA-256 `5a53887fb3fe9f096f378ffc02e56a30c9a1e8073c95c0f8e8b7b6619c4c1847` |
| Devpost resources | <https://tiktoktechjam2026.devpost.com/resources> | Live HTML snapshot retrieved `2026-08-26T11:56:20Z`; SHA-256 `77d45b9ba47b2a7e5072f2a437ae1c3982f03dba824d74f53bd543e9a5811aeb` |
| Official rules | <https://tiktoktechjam2026.devpost.com/rules> | Live HTML snapshot retrieved `2026-08-26T11:56:20Z`; SHA-256 `5eab3cfae93e0a40b5f908c7a0d1ec21d12cea43686bdfda9965ede469a9d36a` |
| Information document | <https://bit.ly/TikTokTechJam2026Info> | Resolves to public Lark wiki `GdYFwzWNLiREsSkuIjZcDznInWc`; page showed `Last updated: Aug 25`; no versioned export/checksum available |
| Direct information document | <https://bytedance.larkoffice.com/wiki/GdYFwzWNLiREsSkuIjZcDznInWc> | Read-only browser access succeeded; anonymous HTTP export blocked by guest-login redirect loop |

The Devpost pages are mutable. Their hashes identify only the ignored local
snapshots retrieved on 26 August; they are not stable release identifiers.
Devpost states that a submission requires a written description, public code
repository with README, and public three-minute YouTube demo, with any
track-specific deliverables additionally governed by the problem statement.
No submission action was taken.

## Isolated prerequisite artifact

The starter documents Node.js 22+ and npm 10+. The host PATH had neither, so an
official Node.js archive was cached under ignored `workspaces/toolchain/`:

| Field | Recorded value |
| --- | --- |
| Distribution | Node.js `v22.23.2`, macOS ARM64 |
| URL | <https://nodejs.org/dist/v22.23.2/node-v22.23.2-darwin-arm64.tar.gz> |
| Archive size | 50,068,815 bytes |
| Published and observed SHA-256 | `61130f394c1630d211dd50aecc4353d379480f36d3ac913cd85dbba1aed585c6` |
| `SHASUMS256.txt` SHA-256 | `778ac5b2fcdbd68d9c0ae9f4310674faa3af0910bd0d18e7f6597787c40a3e39` |
| Included npm | `10.9.8` |
| Licence | Included in the downloaded Node.js distribution; archive remains ignored |

## Acquisition policy

Run `scripts/acquire-official-resources.sh`. It downloads into the ignored
`artifacts/official/` directory, verifies the immutable starter archive and the
Node distribution against published checksums, extracts the starter MIT
licence, and writes a retrieval-specific checksum manifest. It uses no login,
cookie, token, or API key.
