# Baseline build and supply-chain provenance

Inspected read-only on **2026-08-26 21:39 SGT** and rechecked on **2026-08-28
11:19 SGT**. This records what the pinned starter fixes, what remains mutable,
and which current public identities can be verified without downloading image
layers or provisioning infrastructure.

## Application and local Runtime images

Both `Dockerfile` and `Dockerfile.runtime` default to the mutable Docker
Official Image tag `node:22-bookworm-slim`. The application Dockerfile uses it
for both build and Runtime stages; the local POC uses it for the disposable
Codex Runtime image. Docker Compose and `start-local-poc.sh` allow the base tag
to be replaced through `CONTAINER_RUNTIME_BASE_IMAGE`, but do not require a
digest.

At observation time, the anonymous Docker Registry v2 API returned:

| Identity | OCI digest | Additional verified metadata |
| --- | --- | --- |
| Multi-platform index | `sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5` | Returned index bytes matched the digest |
| Linux AMD64 manifest | `sha256:4d676821dff059fd00d277ee4261ef34ea712317fed0737c03941481b5760c96` | Config `sha256:6e6261159fd399ebe5a3d556b7d89da9c85c873f3f270918aad6c8107da8b411`; created `2026-08-25T00:56:00.936273022Z` |
| Linux ARM64/v8 manifest | `sha256:8d342e46d3b2883df69f797cb60fc71d8a0b65de65ddfbf4bf63fdc02049615f` | Config `sha256:97aaa653fb55806b0d7acc6c93dd4f3f06b373a286c988bd68c0527d4310bb05`; created `2026-08-25T00:57:58.149149728Z` |

The mutable tag still resolved to the same multi-platform index on 28 August.
The pinned Terraform-provider tag, commit, release metadata, archive hashes,
and sizes were also rechecked and remained unchanged. No layer or provider
archive was downloaded.

Both platform configurations declare Node `22.23.2`, Yarn `1.22.22`, five
layers, and about 79.9 MB of compressed layer data. The official tag page is
<https://hub.docker.com/_/node/tags?name=22-bookworm>.

These are **current observations, not the organizer's historical image**. The
starter commit is dated 20 July, while the current image configurations were
created 25 August. Because the source records only the moving tag, it cannot
prove which base bytes were used for an earlier organizer build. No upstream
application or Runtime image digest, image ID, SBOM, signature, or attestation
is supplied.

## Build-time mutation

Even if the base image were digest-pinned, the unmodified build is not
byte-reproducible:

- `apt-get update` resolves current Debian repositories, and
  `ca-certificates`, `git`, and `ripgrep` have no version constraints;
- optional mirror variables change package sources;
- the local Runtime package list is an operator-provided build argument;
- the application uses integrity-pinned `npm ci`, but the Runtime separately
  performs a registry install of `@openai/codex@0.111.0` without asserting the
  preserved tarball hash in the Dockerfile;
- the application build copies pruned `node_modules` from the build stage,
  while the globally installed Codex wrapper selects an architecture package;
- neither Dockerfile emits an SBOM or provenance attestation.

The Codex version and npm integrity are independently preserved elsewhere in
this repository. That verifies the published package identity, not that an
unbuilt Runtime image contains those exact bytes.

## ECS bootstrap

The Terraform path adds more mutable inputs: the operator supplies a regional
Ubuntu 22.04/24.04 `image_id`; cloud-init runs distribution updates, retrieves
`https://get.docker.com`, shallow-clones a branch or tag (`main` by default),
and builds locally. Neither the Ubuntu image, Docker installer, APT results,
repository commit, nor resulting application image is content-pinned by the
default configuration. Terraform CLI itself is constrained only to `>=1.6.0`.

This means a successful deployment at two different times can contain
different OS, Docker, Node base, Debian package, and repository bytes while
using the same starter configuration.

## Terraform provider

The cloud provider is the exception: `versions.tf` fixes
`volcengine/volcenginecc` to `0.0.58`, and `.terraform.lock.hcl` preserves its
cross-platform hashes. The official release was published
`2026-07-16T13:18:56Z` at tag commit
`161f3df395e853cf00b733454c1415601b209a2d` and declares MPL-2.0:
<https://github.com/volcengine/terraform-provider-volcenginecc/releases/tag/v0.0.58>.

Verified registry/release metadata for likely platforms:

| Platform | Archive SHA-256 | Size |
| --- | --- | ---: |
| macOS ARM64 | `ff5fbb151d1b517928bc11f7aa679c5fa190ab4bbe4078c8382d480be2d49eb6` | 9,451,704 bytes |
| Linux AMD64 | `8da08948e1be15c88360f32246b3d9d33f597db93d9c72ebb49b1358d0b38c05` | 9,932,282 bytes |
| Linux ARM64 | `cc82455efdc93e4f62e334abd4abcee832a5bcd89290c14ffde7a345457e3ff7` | 9,020,438 bytes |

The Terraform Registry returned protocol `6.0` and signing key ID
`4BED53FB4967B684`. The source licence at the release tag has SHA-256
`773da3407b4b9c664d54b819e1c0cccf5ed0aeff74f1517147400134a9dd71df`:
<https://github.com/volcengine/terraform-provider-volcenginecc/blob/v0.0.58/LICENSE>.
The provider was not installed because Terraform/ECS is optional and no cloud
credentials or provisioning action is authorized.

## Licence boundary

The Node Docker project currently declares MIT at source commit
`3d11f4d6fd2eed47b892d692cc9c78901ab7b5d7`; its licence file SHA-256 is
`782e17d54343aa3f6db60430015692b6540089b3ec5b78274981ada2d3c3c423`:
<https://github.com/nodejs/docker-node/blob/3d11f4d6fd2eed47b892d692cc9c78901ab7b5d7/LICENSE>.
That project licence does not replace the separate licences of Node.js,
Debian, installed APT packages, npm dependencies, or Codex. No blanket licence
for the assembled image was inferred.

## Evidence classification

| Claim | Status |
| --- | --- |
| Current `node:22-bookworm-slim` index/platform identities | Registry-verified |
| Exact base image used by the July starter author | Unknown and unrecoverable from the tag alone |
| Terraform provider version and archive hashes | Lockfile- and registry-verified |
| Provider or container image installed/built locally | Not performed |
| Application/Runtime image is byte-reproducible | Contradicted by source |
| Image starts and passes health/Playground checks | Not reproduced |
