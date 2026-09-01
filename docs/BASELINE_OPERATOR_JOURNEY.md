# Baseline operator journey and visible evidence

Source and organizer screenshots inspected on **2026-08-26 21:35 SGT** at
upstream commit `8d0bd4f14ad1e453d984149aebcdd0bcb4f74178`. This describes the
unmodified baseline and does not design a judged extension.

## Control-plane entry

The browser first calls unauthenticated `GET /api/auth`. If the operator has
configured `APP_AUTH_TOKEN`, the page requests the shared token and retains it
only in module memory; every later API request receives the same bearer token.
There is no logout, cookie, user record, role, owner, Agent principal, session
expiry, or per-resource policy. `GET /api/health` and `/api/auth` remain public.

After access, the browser loads Agents and `/api/system` in parallel. The
system response intentionally omits the Ark key but exposes the Ark base URL,
model ID, Runtime provider, container engine, inner sandbox mode, and Runner
availability. A banner distinguishes absent Ark configuration from absent
container/Codex availability.

## CRUD and Playground journey

| Operator action | HTTP/API behavior | Persisted/visible result |
| --- | --- | --- |
| Create Agent | `POST /api/agents`; name 1--80 chars, description <=500, instructions <=10,000 | UUID Agent in `ready`; workspace and instruction files created; browser selects it |
| Inspect Agent | list/get Agent plus messages and Runs | Agents sort by latest update; messages oldest first; Runs newest first |
| Edit Agent | `PATCH /api/agents/:id`; at least one field; blocked with 409 while `busy` | Agent metadata and instruction files rewritten; no revision history |
| Stop Agent | `POST .../stop`; Runner cancellation awaited | Agent becomes `stopped`; active Run may become `cancelled` |
| Start Agent | `POST .../start`; blocked with 409 if still `busy` | Agent becomes `ready`; last error is cleared |
| Delete Agent | browser confirmation, `DELETE /api/agents/:id` | execution cancelled, workspace archived, Agent/messages/Runs removed from JSON |
| Send prompt | `POST .../messages`; trimmed 1--50,000 chars; 202 response | user Message and queued Run persist atomically; Agent becomes `busy` |
| Poll Run | `GET /api/runs/:id` every 900 ms | browser updates only the selected Agent's latest active Run |
| Successful Run | Runner returns output, thread ID, and usage | Run `completed`; assistant Message appended; Agent `ready`; resumable thread stored |
| Failed Run | Runner throws | Run `failed`; error stored; Agent `error`; browser shows a Run-failed card |
| Cancelled Run | stop/delete/restart cancellation | Run `cancelled`; no assistant Message; cancellation is not rendered as a distinct card |

All Agent and Run identifiers accepted in routes must be UUIDs. Missing Agents
or Runs return 404; stopped/busy conflicts return 409; absent Ark configuration
returns 503 before a Run is created. Zod validation returns 400 with issue
details, Fastify's 1 MiB request limit returns 413, invalid bearer credentials
return 401, and unexpected server errors return 500. Authorization and cookie
headers are redacted from Fastify logs, but other request/log data is not
automatically treated as secret.

## What the browser proves

The supplied Playground visually proves only:

- an Agent can be created, selected, edited, stopped, started, and deleted;
- a user prompt is accepted and an assistant text message eventually appears;
- the Agent has a `ready`, `busy`, `stopped`, or `error` state;
- a stored Codex thread exists after a successful first turn;
- a failed Run's final error string can appear.

During a queued/running Run it shows one generic statement: Codex may be
reading, editing, or running commands. It does **not** show which operation is
occurring. Although the server stores Run start/completion timestamps and
usage, the web `AgentRun` type omits those timestamps and the UI renders
neither duration nor token usage. The browser also lacks a Run list/history,
structured trace/tree, command/file/tool events, cancellation card, policy
decision, identity/principal, protected resource, sandbox instance/control,
or downloadable evidence artifact.

This means the unmodified screen cannot, by itself, prove any of the three
track-specific middleware requirements. A judge can see CRUD and final text,
but cannot diagnose a failure, verify a deny decision, or confirm containment
from the baseline UI.

## Screenshot provenance and visual check

The pinned upstream includes two 1280x720 JPEGs:

| File | SHA-256 | Confirmed visible state |
| --- | --- | --- |
| `docs/assets/create-agent.jpg` | `96283cd824ebe44b054d546ebd072335b17758bc4a9b4a3babbc5a6b5a0c89a0` | Create modal with name, description, and instructions |
| `docs/assets/playground.jpg` | `cea867e552770c9d1e66ab863e6b15fa260b0b1092414b4c9bcb00c33cf04f87` | Empty-session Playground, Runtime card, status, starter prompts, and controls |

The screenshots match the inspected source. They do not depict an executed
Run, failure, cancellation, resumed turn, live Ark response, or track-specific
middleware evidence. They are preserved inside the immutable starter archive;
no derivative image was created.

## Evidence limits

| Claim | Evidence status |
| --- | --- |
| Shared-token HTTP guard works | Unit-tested through Fastify injection |
| Malformed JSON and oversized bodies preserve 400/413 | Unit-tested through Fastify injection |
| CRUD and conversation service lifecycle works with a fake Runner | Unit-tested |
| UI performs the documented calls and renders the states above | Source- and screenshot-verified |
| Browser CRUD against the live server works | Not reproduced |
| Container/Codex/Ark execution or cancellation appears correctly in browser | Not reproduced |
| Any track-specific positive/negative proof is visible | Not implemented and not reproduced |
