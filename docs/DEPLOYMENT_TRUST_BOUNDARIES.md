# Baseline deployment and trust boundaries

Source: unmodified organizer starter commit
`8d0bd4f14ad1e453d984149aebcdd0bcb4f74178`. This preparation record describes
existing behavior only; it neither selects a track nor proposes a judged
security design.

## Local POC

The host runs the React/Fastify control plane. Every Agent turn starts a new
Docker/Colima/Podman container with:

- bridge networking with no destination allowlist;
- all Linux capabilities dropped and `no-new-privileges`;
- default limits of 2 CPUs, 2 GiB memory, and 256 processes;
- the host user's UID:GID, plus `keep-id` under Podman;
- exactly two writable bind mounts: the selected Agent workspace and the
  shared Launchpad `codex-home` directory;
- `ARK_API_KEY` in the container environment and the Ark endpoint/model in a
  mode-0600 generated Codex configuration under the shared mount;
- a 600-second control-plane timeout and combined stdout/stderr ceiling of
  2 MiB; only the final 16 KiB of stderr is retained for failure detail.

The container uses `--rm` and an init process. Cancellation force-removes its
deterministic Agent/instance container name, falling back to SIGTERM then
SIGKILL. Startup and process exit also remove containers bearing the matching
instance label. The source implements these paths, but the baseline tests only
inspect generated arguments; no real cancellation or cleanup was reproduced.

The selected workspace is isolated from other Agent workspaces at the mount
layer, but `codex-home` is shared across Agents and turns. Ordinary bridge
networking permits arbitrary outbound destinations, the active Runtime can
read its Ark key, and the prompt is present in the spawned command arguments.
The upstream security policy therefore explicitly rejects a multi-tenant
isolation claim.

Codex requests `workspace-write` through Landlock. When the engine/kernel
cannot run the Landlock probe, the script switches Codex to
`danger-full-access` **inside the outer disposable container**; the two mounts
and container resource controls remain, but the inner filesystem policy does
not.

## Compose and ECS

The application image runs as the non-root `node` user. Compose mounts shared
`data`, `workspaces`, and `codex-home` directories into one long-lived
application container and applies 2 CPUs, 4 GiB memory, 512 processes,
capability drop, and `no-new-privileges`. The Runner then launches Codex as a
child process in that same container. There is no per-Agent container or
per-workspace mount boundary in this profile; a Landlock fallback to
`danger-full-access` relies on only the application container boundary.

The optional Terraform path creates a VPC, subnet, security group, post-paid
ECS instance, 50 GiB system disk, and 5 Mbps public EIP. It exposes HTTP port
80 to `allowed_web_cidr`, SSH port 22 to `allowed_ssh_cidr`, and all outbound
protocols/destinations. Validation rejects only the exact web CIDR
`0.0.0.0/0`; there is no equivalent SSH validation. The emitted application
URL is plain HTTP, so the starter documentation requires HTTPS before sending
the shared token over an untrusted network.

Cloud-init downloads and runs Docker's convenience installer, shallow-clones
a public repository/ref, writes a mode-0600 environment file, and starts
Compose. `ark_api_key` and `app_auth_token` are marked sensitive for Terraform
display, but the rendered environment is embedded in user data and Terraform
state. The upstream documentation explicitly says these files and state must
not be committed and that the POC needs managed secrets/encrypted remote state
for production.

## Reproducibility boundary

The application dependency lockfile, Terraform provider version/hashes, and
Codex version are pinned. The complete image is not byte-reproducible from the
current files because `node:22-bookworm-slim` is referenced by mutable tag,
APT installs current packages, the Docker convenience script is downloaded at
deployment time, and Terraform defaults to cloning repository ref `main`.
These are reproducibility limits, not evidence that a recorded build failed.

## Claims the evidence supports

| Claim | Status |
| --- | --- |
| Local per-turn container arguments include the documented mounts and limits | Verified by source and unit test. |
| Local container actually starts, calls Ark, cancels, and cleans up | Not reproduced; engine and credentials are absent. |
| ECS/Compose has a per-Agent isolation boundary | Contradicted by source and upstream security documentation. |
| Either baseline blocks arbitrary outbound destinations | Contradicted by bridge/all-egress configuration. |
| Secrets are absent from command arguments | Partially verified only for the synthetic Ark key; prompts are arguments and active execution receives the key through environment. |
| Terraform `sensitive` keeps the Ark key out of state/user-data | Contradicted by upstream documentation and rendered configuration. |
| veFaaS Cloud Sandbox is implemented or required | Not implemented. It appeared only in provisional starter material; the released statement does not require it and says local execution is the default judging path. |
