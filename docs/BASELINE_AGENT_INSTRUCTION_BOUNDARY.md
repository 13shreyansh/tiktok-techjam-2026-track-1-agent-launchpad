# Baseline Agent instruction and identity boundary

This is a source audit of the unmodified starter at commit
`8d0bd4f14ad1e453d984149aebcdd0bcb4f74178` and its pinned Codex release
`0.111.0`. It does not reproduce a live Codex/Ark turn and does not propose a
judged middleware design.

## Three different representations

The word **Agent** spans three separate representations in the baseline:

1. The JSON store holds an `Agent` record: ID, display metadata, instruction
   text, status, workspace path, and the last Codex thread ID. The web UI reads
   this record and displays its `name`, `description`, and `instructions`.
2. `WorkspaceManager` renders that metadata into a plaintext `AGENTS.md`
   inside the Agent's workspace. This is the representation Codex actually
   reads. It is ordinary UTF-8 text, not a signed or platform-only object.
3. Each Playground message launches a new Codex CLI process. A first message
   uses `codex exec`; a later message uses `codex exec ... resume <thread>`.
   The stored thread ID provides conversation continuity, but it is not an
   authenticated Agent identity.

There is no authenticated principal, credential, role binding, policy object,
instruction revision, digest, or signature connecting these representations.
The baseline's Agent ID is an application UUID and database lookup key.

## What the pinned Runtime reads

The matching OpenAI source release is tag `rust-v0.111.0`, peeled commit
`8c75cd9afcd405d134530e53c78e5e0e4e5312a3`. Its session-spawn path calls
`get_user_instructions` before constructing the session configuration:

- <https://github.com/openai/codex/blob/8c75cd9afcd405d134530e53c78e5e0e4e5312a3/codex-rs/core/src/codex.rs#L351-L405>
- <https://github.com/openai/codex/blob/8c75cd9afcd405d134530e53c78e5e0e4e5312a3/codex-rs/core/src/project_doc.rs#L83-L135>

The pinned source loads a global `AGENTS.override.md` or `AGENTS.md` from
`CODEX_HOME`, then discovers project instructions from the project root down
to the current directory. If it finds no project-root marker, it checks only
the current directory. `AGENTS.override.md` takes precedence over `AGENTS.md`
within a directory, symlinks are accepted, and the combined project-document
budget defaults to 32 KiB:

- <https://github.com/openai/codex/blob/8c75cd9afcd405d134530e53c78e5e0e4e5312a3/codex-rs/core/src/config/mod.rs#L109-L123>
- <https://github.com/openai/codex/blob/8c75cd9afcd405d134530e53c78e5e0e4e5312a3/codex-rs/core/src/config/mod.rs#L2308-L2323>
- <https://github.com/openai/codex/blob/8c75cd9afcd405d134530e53c78e5e0e4e5312a3/codex-rs/core/src/project_doc.rs#L207-L310>

The starter does not initialize Agent workspaces as Git repositories, and it
passes `--skip-git-repo-check -C <workspace>`, so the generated workspace file
is the project instruction source in the normal baseline layout. Current
[official OpenAI documentation](https://developers.openai.com/codex/guides/agents-md)
describes the same once-per-run discovery behavior. The pinned source, rather
than the mutable current guide, is the evidence for this baseline.

On resume, Codex reconstructs the old transcript and injects the newly loaded
initial context at the first new turn. The pinned tests explicitly exercise
that resume seeding behavior:

- <https://github.com/openai/codex/blob/8c75cd9afcd405d134530e53c78e5e0e4e5312a3/codex-rs/core/src/codex.rs#L1800-L1881>
- <https://github.com/openai/codex/blob/8c75cd9afcd405d134530e53c78e5e0e4e5312a3/codex-rs/core/src/codex.rs#L7396-L7425>

Therefore a later Launchpad message reloads the then-current instruction
files even though it resumes the same thread. This is source-confirmed Runtime
behavior; no real resumed turn was executed locally.

## Integrity and consistency limits

The generated `AGENTS.md` is within the workspace that the starter bind-mounts
read-write and gives to Codex under `workspace-write`. The application does
not set a restrictive file mode, make the file read-only, or check it before
or after a Run. Source permissions therefore allow a Run to modify, replace,
symlink, truncate, or delete the file. Whether a model elects to do so was not
tested.

Such a change is not synchronized back into the JSON store. The UI can keep
showing the original `agent.instructions` while the next CLI process reads
different text. No Run record captures the instruction bytes, path, digest,
revision, or the actor/source responsible for a change. The baseline cannot
establish that from its Agent/Run records. Codex's own ignored rollout data
may retain contextual instruction messages, but Launchpad neither indexes nor
exposes that evidence and its persistence was not reproduced locally.

Settings updates create a second consistency edge. `updateAgent` commits the
new JSON record first, then directly overwrites `AGENTS.md`. A filesystem write
failure can therefore leave the control-plane record updated while the Runtime
file remains old or partial. The instruction write does not use the store's
temporary-file-plus-rename pattern. A later successful settings update
regenerates the file from stored metadata and can silently erase workspace
edits; deletion archives the whole workspace rather than erasing it.

The generator concatenates name, description, and instruction strings into
Markdown without a structured envelope or escaping. That is appropriate for
author-supplied natural-language guidance, but it means the visible fields are
not separate enforcement domains. The fixed workspace rules—including the
credential warning—are model context, not independently enforced policy.

The starter also bind-mounts a shared `CODEX_HOME` read-write into Runtime
containers. The generated `config.toml` is mode `0600`, but the outer mount is
not read-only. Whether Codex's inner sandbox permits a particular Run to write
there depends on the effective sandbox path and fallback behavior; no live
container was available, so cross-Agent global-instruction modification is a
conditional exposure, not a reproduced result.

## Test evidence and challenge implications

The focused unmodified tests passed: `agent-service.test.ts` and
`store.test.ts`, 5/5 tests. They verify CRUD metadata, a fake-Runner thread ID,
single-run admission, and store rollback when persistence fails. They do not
read back `AGENTS.md`, compare it with the store, simulate instruction-write
failure, start Codex, or prove instruction integrity.

The released statement makes trace/audit, identity/authorization, threat
modeling/safety, and versioning/rollback example directions rather than fixed
tracks. This boundary is relevant to each: a trace cannot attribute behavior
to a reproducible Agent configuration without effective-version evidence; a
display Agent ID is not an authenticated principal; and mutable
natural-language instructions are not an isolation or enforcement boundary.
These remain baseline problem observations, not pre-start solution decisions.
