# Released Agent Launchpad challenge matrix

Last reconciled: **2026-08-29 14:28 SGT**

This began as a preparation-only, section-by-section audit of the released
official statement. The 29 August reconciliation records post-start evidence
without changing the statement's authority or retroactively presenting judged
implementation as pre-start work.

## Source and authority

- Official public information document:
  <https://bytedance.larkoffice.com/wiki/GdYFwzWNLiREsSkuIjZcDznInWc>
- Released title: **1. Agent Launchpad: Design and Build Lightweight Agent
  Middleware**.
- Browser-visible document status: `Last updated: Aug 28`.
- Track workshop: **28 August 2026, 1:00–1:45 PM SGT**.
- Webinar: <https://vc-my.larkoffice.com/j/484622806>.
- Workshop recording:
  <https://bytedance.my.larkoffice.com/minutes/obmyo2nvz5ht46844444284t>.
- Starter: <https://github.com/RrankPyramid/CodeJam>.

The public page is readable in a browser, but anonymous HTTP retrieval still
enters a Lark/Feishu guest-login redirect loop and browser export is not
available. Therefore the page has no preserved versioned export or content
checksum. The URL, visible update date, section anchors, and observed facts
are recorded with that provenance limitation.

The 29 August live recheck found no semantic change to the written statement.
The linked recording page showed the official workshop title and a `40min 6s`
duration, but anonymous access exposed only the introduction and the original
Minutes required login. The Q&A below is therefore transcript-derived from the
participant's supplied meeting transcript, not a claim that a full official
Minutes export was independently retrieved. Written rules and statement text
remain higher-authority if a transcription error or conflict appears.

The event-wide [Official Rules](https://tiktoktechjam2026.devpost.com/rules)
remain controlling where materials conflict. The released track statement is
the specific authority for the Agent Launchpad technical scope, deliverables,
and stated track rubric.

## Corrections to the provisional reading

| Earlier provisional interpretation | Released statement |
| --- | --- |
| Local directory `track-1` was only an isolation label; starter internals called it “Track #5 v2.” | The public statement numbers Agent Launchpad as problem **1**. The starter's internal July title remains provenance, not final public numbering. |
| Glass Box, Bouncer, and Kill Switch were treated as exactly-one tracks. | There are no exactly-one subtracks. Identity/authorization, trace/audit, layered architecture, safety, and multi-Agent coordination are examples. Teams may choose, combine, simplify, replace, or invent capabilities. |
| Each provisional direction had a hard minimum acceptance recipe. | The final universal gates are mandatory; the four direction-specific evidence bullets are explicitly **optional evidence**. |
| veFaaS/ECS could appear strategically important. | Local execution is the default judging path. ECS is optional and explicitly does not affect the score. veFaaS is not required by the final statement. |
| The final rubric needed confirmation. | The released track rubric is 40/25/20/15 with named track-specific categories. |

The preparation audits of traces, identity, safety, lifecycle, failure,
cleanup, data, and instruction integrity remain useful baseline evidence. They
must no longer be presented as three prescribed solution tracks.

## Universal acceptance gates

1. **Baseline first.** A reviewer can clone and start the platform, then
   create or test an Agent from the frontend. The statement says not to begin
   middleware work until the unchanged create/Run/restart persistence flow
   succeeds.
2. **Preserve the platform.** Agent CRUD, lifecycle actions, Playground chat,
   persistence, and real model execution continue to work.
3. **Solve an Agent-specific infrastructure problem.** Explain why it matters
   and which frontend, control-plane, Runtime, data, or infrastructure boundary
   owns the behavior.
4. **Execute outside the UI.** The middleware runs in a backend, Runtime, data,
   or infrastructure path. Static screens and hard-coded success messages do
   not qualify.
5. **Show both behavior and adversity.** Demonstrate a normal case plus an
   appropriate failure, denial, degraded, abuse, or recovery case.
6. **Automate the core proof.** Tests must cover the central middleware
   behavior, not only UI rendering.
7. **Be reproducible.** `npm run check` passes; setup, design, demo steps, and
   limitations are documented without hidden manual setup.
8. **Keep secrets absent.** No key, AK/SK, password, bearer token, or sensitive
   payload appears in source, Git history, logs, traces, screenshots, browser
   storage, or demo output.

Mock users, mock external services, protected fixtures, and controlled
failures are in scope. The frontend-to-Agent path and claimed middleware must
still be functional.

## Organizer examples, not a checklist

| Example direction | Organizer-listed possibilities |
| --- | --- |
| Identity and authorization | Human identity; distinct Agent or Agent-version principal; scoped/time-bound/revocable delegation; trusted-boundary policy checks; optional approvals; action attribution; backend secret handling and revocation. A small mock identity model is acceptable. |
| Trace, audit, and observability | Stable Agent/version/Run/session/trace/span/actor IDs; timings, status, error, retry/cancellation; model/tool/memory/sandbox/policy/approval/cloud categories; redacted inputs/outputs; diagnostic metadata; usage/cost/resource signals; tree/timeline UI and optional machine-readable export. |
| Layered Agent architecture | Clearly separate relevant experience, control, identity/policy, Runtime, execution/data, observability, and cloud responsibilities. No single layering model is mandatory. Contracts should explain data flow and possible provider/runtime evolution. |
| Threat modeling and safety | Protected assets, actors, trust boundaries, abuse cases, controls, and residual risk. Examples cover credential exposure, confused delegation, prompt/tool misuse, sandbox escape, cross-user access/exfiltration, runaway cost, and sensitive traces. Existing starter resource limits alone are not a new capability. |
| Multi-Agent coordination | Several Agents share a session/topic/queue, route turns, persist shared state, expose ordering, and handle a missing Agent. The illustrative demo is an exact 10-to-1 countdown with no duplicate or skipped number. External chat integration is optional. |
| Other team-designed middleware | Lifecycle reconciliation, recovery, memory governance, human approval, budgets, provider abstraction, versioning/rollback, routing, credential exchange, or automated diagnosis/remediation. It must still state the problem, boundary, functional evidence, failure/recovery case, and limitations. |

This breadth is permission, not a request to implement everything. The
statement repeatedly says depth, coherence, relevance, and focused changes
matter more than the number of features.

## Workshop Q&A clarifications

The participant-supplied transcript records the Track 1 engineer clarifying:

- ModelArk is an example rather than an exclusive provider. Teams may use
  another authorized provider; the practical starter boundary is an
  OpenAI-compatible Responses endpoint. A chat-completions-only service would
  need an adapter, which is permitted but not supplied.
- The specific model is not a judging criterion. A local POC is acceptable;
  remote ECS execution is not mandatory.
- Teams may extend the Agent Service/lifecycle, modify the starter, or use
  another codebase. Reproducible instructions and a demo that matches the
  repository remain necessary.
- A capability must be reusable by platform users across Agents. A checkpoint,
  recovery, planner, or other behavior hard-wired to one bespoke Agent is not
  the requested middleware product.
- Runtime interception, mock-resource actions, and a combined middleware such
  as authorization plus approval plus audit are in scope. Error recovery and
  sensitive-information leakage were named as robustness evidence.

These clarifications strengthen the current Durable Agent Relay direction:
it is an Agent-independent control-plane capability, operates locally, exposes
recovery evidence, and does not depend on changing the model to score. They do
not remove the written requirement to show one real Run in the final demo.

## Required live demonstration

The three-minute demonstration must show one complete scenario:

1. Create or select a runnable Agent and show its lifecycle state.
2. Invoke it through the Playground with a real task.
3. Show at least one real model, file, tool, sandbox, data, or infrastructure
   action.
4. Show the real middleware behavior and its evidence.
5. Show an appropriate failure, denial, degraded, abuse, or recovery case.
6. Show that the platform remains understandable and controllable afterward.

## Deliverables

1. **Three-minute live demo:** one real Run, normal middleware behavior, and
   an appropriate adverse/recovery case.
2. **One-page architecture diagram:** middleware, data flow, trust boundary,
   and the enforcement, instrumentation, or recovery point.
3. **Code repository:** setup, problem/rationale, design summary, automated
   tests, demo steps, limitations, and no secrets.

Devpost separately requires a written project/technology description, a
public repository with a comprehensive README, and a public three-minute
YouTube demonstration. These requirements are cumulative. Repository
visibility was not changed during preparation.

## Released track rubric

| Category | Weight | Review focus |
| --- | ---: | --- |
| End-to-end middleware behavior | 40% | Real frontend-to-backend, Runtime, data, or infrastructure behavior with convincing functional evidence. |
| Technical design and integration | 25% | Rationale, coherent architecture, appropriate boundary, focused changes, and extensible contracts. |
| Verification and robustness | 20% | Automated tests, errors, cleanup/recovery, redaction, and resistance to obvious bypasses. |
| Demo and reproducibility | 15% | Concise live demo, useful README, one-command startup, limitations, and no hidden manual setup. |

The event-wide Official Rules also describe generic Stage Two criteria. The
safest submission posture is to satisfy both the track-specific technical
rubric and the event-wide impact, originality, feasibility, and presentation
expectations rather than assuming one displaces the other.

## Explicit scope relief

A strong submission may use one local Runtime path, a small mock resource set,
and one focused middleware story. Teams do **not** have to train a foundation
model, build a workflow editor, implement production OAuth, create a general
sandbox or scheduler, support multiple cloud regions, or deploy to ECS.
Unrelated UI redesign and rebuilding the supplied CRUD, Playground, Codex
integration, or container launcher are out of scope unless essential to the
chosen problem.

## Preparation implications and remaining gates

- The exact starter commit remains unchanged at
  `8d0bd4f14ad1e453d984149aebcdd0bcb4f74178`; no tag or release exists.
- The static baseline was revalidated on 28 August: all 12 upstream tests and
  both builds passed. The current full gate has 40 tests and both builds.
- The original container-plus-Ark recipe remains unreproduced because this host
  has no Docker, Colima, Podman, or organizer/provider key. The workshop-permitted
  local-process path is reproduced: the signed Codex CLI used its existing
  ChatGPT login to complete Playground and source-bound relay Runs without
  copying credentials.
- The six original npm audit findings were removed by a non-forced update
  within the declared semver ranges; the full verification gate still passes.
- Devpost Updates still has no organizer post; Discussions still has no topic.
- The released statement's live frontend-to-Agent prerequisite is satisfied on
  this machine through the permitted local-process path. Portable judge access
  and the organizer's exact container recipe remain separate limitations.
- The workshop recording is now linked. Its metadata was independently
  observed; the full Minutes remained login-gated, so spoken Q&A claims retain
  the participant-transcript provenance described above.
- A source-only probe confirmed that the starter-pinned Codex `0.111.0` accepts
  custom Responses providers but no longer accepts `wire_api = "chat"`.
  Executing the matching registry macOS binary was then blocked by macOS as
  malware and moved to Bin. The warning was not bypassed; the ignored probe
  download was removed. That binary is not treated as a usable local Runtime.

The earlier instruction-drift discovery now aligns with several organizer
example categories—Agent versioning, action attribution, policy boundaries,
trace evidence, and threat modeling—but that alignment is problem evidence,
not a pre-start solution selection.
