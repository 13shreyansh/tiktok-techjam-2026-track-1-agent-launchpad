# Upstream starter architecture

Source: organizer-provided `RrankPyramid/CodeJam` commit
`8d0bd4f14ad1e453d984149aebcdd0bcb4f74178`. This document describes the
unmodified starter; it does not propose or implement a judged solution.

The upstream `hackathon-v2-skeleton.xml` title identifies this as **CodeJam
Track #5 v2 — Agent Middleware Challenge**. The released public statement now
numbers it **1. Agent Launchpad: Design and Build Lightweight Agent
Middleware**. The mismatch is recorded as versioned provenance: the public
release controls current challenge naming.

## Request and runtime path

```text
React/Vite browser UI
  -> Fastify API and static server
  -> AgentService
       -> JsonStore (metadata)
       -> WorkspaceManager (per-Agent files)
       -> AgentRunner interface
            -> ContainerCodexRunner (local POC)
            -> CodexRunner (ECS/local development)
                 -> Codex CLI -> Volcengine Ark Responses API
```

| Component | Source | Responsibility |
| --- | --- | --- |
| Web UI | `apps/web/src/App.tsx`, `api.ts` | Agent list/forms, lifecycle controls, prompts, asynchronous Run polling |
| API | `apps/server/src/app.ts` | Fastify routes, validation, optional shared bearer token, compiled UI serving |
| Service | `agent-service.ts` | Agent lifecycle, messages, Run state, persistence coordination, one active Run per Agent |
| Metadata store | `store.ts` | Serialized writes and atomic replacement of one JSON database file; single process only |
| Workspaces | `workspace.ts` | Creates Agent instruction/workspace files and archives deleted workspaces |
| Runner selection | `runner-factory.ts` | Selects container or local-process provider from `RUNTIME_PROVIDER` |
| Local POC runner | `container-codex-runner.ts` | One disposable Docker/Colima/Podman container per turn |
| ECS/development runner | `codex-runner.ts` | Codex child process in the application/host environment |
| Configuration | `config.ts`, `.env.example` | Validates paths, Ark settings, limits, auth token, and Runtime selection |

## API surface

- Health/auth/system: `GET /api/health`, `/api/auth`, `/api/system`
- Agent CRUD: `GET/POST /api/agents`, `GET/PATCH/DELETE /api/agents/:id`
- Lifecycle: `POST /api/agents/:id/start`, `POST /api/agents/:id/stop`
- Conversation and Runs: `GET/POST /api/agents/:id/messages`,
  `GET /api/agents/:id/runs`, `GET /api/runs/:id`

Submitting a prompt immediately creates a queued Run. The UI polls the Run;
the service transitions the Agent through `ready -> busy -> ready`, with
`stopped` and `error` alternatives. Interrupted Runs become `cancelled` after
restart. The first model turn uses `codex exec`; later turns resume the stored
Codex thread.

## Persistence

```text
data/launchpad.json       Agent, message, and Run metadata
workspaces/<AgentID>/     Agent-created files and instructions
workspaces/.deleted/      Archived deleted Agent workspaces
codex-home/               Codex configuration and sessions
```

The local macOS POC defaults to `~/.volc-agent-launchpad/`; this preparation
would instead set `LOCAL_POC_DATA_ROOT` inside an ignored track directory to
maintain workspace isolation if credentials and a container engine become
available.

## Runtime profiles and limits

| Profile | Control plane | Agent execution |
| --- | --- | --- |
| Local POC | Host Node.js | Disposable local container |
| ECS | Application container | Codex process in the same container |
| Local development | Host Node.js | Host Codex process |

Local containers default to 2 CPUs, 2 GiB memory, 256 processes, dropped Linux
capabilities, and `no-new-privileges`. `workspace-write` is requested from
Codex; if Landlock is unavailable, the script falls back to
`danger-full-access` only inside the disposable outer container and warns that
this is not tenant isolation. The runtime image pins `@openai/codex@0.111.0`.

## Codex event boundary at the pinned version

OpenAI's source tag for `0.111.0` defines the `codex exec --json` stream with
`thread.started`, `turn.started`, `turn.completed`, `turn.failed`,
`item.started`, `item.updated`, `item.completed`, and fatal `error` events.
Typed items include agent messages, reasoning summaries, command executions,
file changes, MCP calls, web searches, todo lists, and non-fatal errors.
Command items carry status, aggregate output, and exit code; file-change items
carry paths, change kinds, and status; completed turns carry token usage.

The unmodified Launchpad parser consumes only the thread ID, completed agent
message, completed-turn usage, and top-level error. It does not persist or
display the other item lifecycle events or `turn.failed`. This is a factual
baseline limitation: structured runtime activity exists at the Runner boundary
but most of it is discarded before the service and browser. Source schema:
<https://github.com/openai/codex/blob/8c75cd9afcd405d134530e53c78e5e0e4e5312a3/codex-rs/exec/src/exec_events.rs>.

## Documented acceptance path

The upstream local SOP requires Node.js 22+, npm 10+, one supported container
engine, an Ark API key, and a Responses-capable Ark endpoint/model ID. Its
unmodified path is:

```bash
ARK_API_KEY=<organizer-provided-key> \
ARK_MODEL=<responses-capable-endpoint> \
npm run poc
```

Then open `http://localhost:3000`, create an Agent with name, description, and
workspace instructions, submit a task in the Playground, observe the Run, and
verify a later message resumes the same session. This path was not executed
because the two credential variables and container tooling are unavailable.

## Known starter security limits

The upstream `SECURITY.md` explicitly identifies a shared demo token rather
than user identity/authorization, no CSRF protection, no hardened multi-tenant
sandbox, broad outbound network access, prompt-triggered command/file
execution, and exposure of the Ark key to the server and active Runtime. It
also warns that Terraform POC state contains the Ark key. These constraints
are why runtime state, Terraform state, keys, logs, and screenshots remain
ignored here.

The upstream extension guide names trace/audit, identity/authorization, and
safety/sandboxing seams. The released statement broadens these into five
recommended examples plus arbitrary team-designed middleware and explicitly
allows choosing, combining, simplifying, replacing, or inventing
capabilities. The current requirements are reconciled in
[RELEASED_CHALLENGE_MATRIX.md](RELEASED_CHALLENGE_MATRIX.md); selection and
implementation remain deferred until the challenge window.
