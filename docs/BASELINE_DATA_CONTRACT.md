# Baseline data contract and lifecycle

Source: unmodified organizer starter commit
`8d0bd4f14ad1e453d984149aebcdd0bcb4f74178`. This is a preparation-only
description of existing state; it does not define a judged extension.

## Persistent records

The single version-1 JSON database contains three arrays:

| Record | Existing fields |
| --- | --- |
| Agent | Random UUID, name, description, instructions, status, absolute workspace path, Codex thread ID, last error, creation/update timestamps |
| Run | Random UUID, Agent ID, queued/running/completed/failed/cancelled status, prompt, final output, error, input/cached-input/output token counts, start/completion/creation timestamps |
| Message | Random UUID, Agent ID, Run ID, user/assistant role, content, creation timestamp |

The store serializes mutations in one process, clones state before mutation,
writes a mode-0600 temporary file, and atomically renames it over the database.
It validates only database version and that `agents` is an array during load;
there is no full persisted-schema validation or multi-process coordination.

Prompts are stored both as `Run.prompt` and the user `Message.content`; final
answers are stored both as `Run.output` and assistant `Message.content`.
Instructions are also written into plaintext `AGENTS.md` within the Agent
workspace. These are persistence facts, not a claim that the content contains
secrets.

## Lifecycle

```text
Agent: ready --send--> busy --success--> ready
       ready/error --stop--> stopped --start--> ready
       error --start--> ready
       busy --failure--> error
       busy --stop + cancellation--> stopped
       busy --restart recovery--> ready

Run: queued -> running -> completed | failed | cancelled
```

Submitting a prompt atomically inserts the queued Run and user Message, then
marks the Agent busy. The asynchronous execution later stores an assistant
Message and Codex thread ID on success, or Run/Agent error state on failure.
Only one active Run is allowed per Agent, but different Agents can run
concurrently.

On server initialization, persisted queued/running Runs become cancelled with
`Server restarted while this run was active`, and busy Agents become ready.
The behavior exists in source but is not covered by the 12 baseline tests.

Stopping an Agent requests Runner cancellation and sets the Agent to stopped.
Deleting an Agent also requests cancellation, renames its workspace into
`workspaces/.deleted/<AgentID>-<timestamp>`, and removes its Agent, Run, and
Message rows. It is therefore an archival delete, not secure erasure.

## Browser/API projection

The API exposes CRUD, lifecycle, messages, per-Agent Run lists, and direct Run
lookup. UUID path parameters and request bodies are validated, but the shared
token grants the same access to all records and is explicitly not an identity
or ownership mechanism. The system endpoint returns the Ark base URL/model,
Runtime provider, engine, sandbox mode, and readiness—but not the Ark key.

The React client keeps the shared token only in module memory and sends it as a
Bearer header. It polls an active Run every 900 ms and displays conversation
messages, a generic working state, or the final failure text. Although the
server returns start/completion timestamps and usage, the browser `AgentRun`
type omits the two timestamps and the UI renders neither durations nor token
usage. Cancelled Runs receive no dedicated evidence view.

The browser receives and displays the Agent's absolute workspace path. This is
useful baseline context but means the UI contract is coupled to host/container
filesystem details.

## Released-example data absent from the baseline

| Organizer requirement | Baseline representation |
| --- | --- |
| Trace/audit Trace ID, Span ID, step type/status/duration/error/redaction evidence | Absent. Agent and Run IDs plus final usage/error are the only adjacent fields. |
| Identity/authorization initiating human, Agent principal, owner, action, resource, allow/deny, revocation | Absent. `agentId` identifies an Agent record, not an authenticated non-human principal. |
| Threat/safety threat/asset, applied controls, blocked/terminated/cleaned-up evidence, protected-asset result | Absent. Generic failed/cancelled Run statuses and container cleanup are not threat-specific evidence. |
| Multi-Agent shared session/topic, participants, turn ownership, ordering, retries, or shared state | Absent. Each Agent has an independent Codex thread and workspace. |

The schema therefore supports the baseline journey but does not by itself
demonstrate any released example capability or team-designed middleware.
