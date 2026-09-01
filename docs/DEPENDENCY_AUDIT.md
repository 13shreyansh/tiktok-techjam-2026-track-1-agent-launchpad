# Unmodified starter dependency audit

Observed: **2026-08-26 21:19 SGT** against the lockfile at organizer commit
`8d0bd4f14ad1e453d984149aebcdd0bcb4f74178` after `npm ci`.

No dependency was upgraded and no `npm audit fix` command was run. This record
separates registry advisories from demonstrated exploitability; an advisory is
not itself proof that the Launchpad configuration is exploitable.

| Installed package | Advisory exposure reported by npm | Dependency path and bounded interpretation |
| --- | --- | --- |
| `@fastify/static` 10.1.0 | Moderate non-canonical-path authorization bypass ([GHSA-8pvw-jcv7-9cmj](https://github.com/advisories/GHSA-8pvw-jcv7-9cmj)); high route-guard bypass via path traversal ([GHSA-83w8-p2f5-377r](https://github.com/advisories/GHSA-83w8-p2f5-377r)) | Direct production dependency registered to serve the compiled web UI. The relevant code path exists; this audit did not attempt an exploit and does not establish reachability through the starter's exact routing configuration. |
| `brace-expansion` 5.0.7 | Two high memory-exhaustion advisories ([GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg), [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895)) | Transitive production path: `@fastify/static -> glob -> minimatch`. No evidence currently shows attacker-controlled brace patterns reaching it. |
| `fast-uri` 3.1.3 and nested 4.1.1 | High host-confusion advisories ([GHSA-v2hh-gcrm-f6hx](https://github.com/advisories/GHSA-v2hh-gcrm-f6hx), [GHSA-7p8r-x3mc-p8w7](https://github.com/advisories/GHSA-7p8r-x3mc-p8w7)) | Transitive production paths through Fastify's AJV and serialization stack. Presence is confirmed; an applicable attacker-controlled URI validation path is not. |
| `find-my-way` 9.6.0 | High HTTP/2 denial of service ([GHSA-c96f-x56v-gq3h](https://github.com/advisories/GHSA-c96f-x56v-gq3h)) | Fastify's production router. The advisory is HTTP/2-specific, while the starter constructs default Fastify without enabling HTTP/2; that vulnerable transport condition is not present in the documented default configuration. |
| `nanoid` 3.3.16 | High indefinite loop for a custom generator with size zero ([GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8)) | Transitive through PostCSS/Vite. No starter source calls the affected custom-generator API; this is primarily in the build/test toolchain here. |
| `postcss` 8.5.19 | Moderate attacker-controlled source-map file read ([GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp)) | Transitive through Vite in the build/test toolchain. The production server does not process CSS; exploitability would require untrusted build input under the advisory's conditions. |

`npm audit --json` reported 6 affected packages: 1 moderate, 5 high, 0
critical; 137 production, 54 development, 52 optional, 6 peer, and 247 total
dependencies. It reported a fix as available for each affected package and
exited 1. Applying a fix before the competition window would alter the
organizer lockfile and invalidate the unmodified-baseline comparison, so the
findings remain recorded rather than remediated.
