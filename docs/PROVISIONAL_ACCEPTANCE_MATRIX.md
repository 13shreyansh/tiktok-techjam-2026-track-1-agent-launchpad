# Provisional challenge acceptance matrix

> **Superseded on 28 August 2026.** The public statement is now released.
> Use [RELEASED_CHALLENGE_MATRIX.md](RELEASED_CHALLENGE_MATRIX.md) for current
> requirements. This file is retained only as a dated record of the earlier
> starter-derived interpretation; in particular, its exactly-one-track model
> is not part of the released challenge.

Last reconciled: **2026-08-26 21:21 SGT**

This is a preparation-only extraction of organizer-controlled material. It
does not select a track or propose a judged solution.

## Authority and change control

1. The event-wide [Devpost rules](https://tiktoktechjam2026.devpost.com/rules)
   and [overview](https://tiktoktechjam2026.devpost.com/) govern eligibility,
   timing, submission, and event-wide judging.
2. The organizer-supplied starter at commit
   `8d0bd4f14ad1e453d984149aebcdd0bcb4f74178` contains
   `docs/HACKATHON_EXTENSION_GUIDE.md` and ten `hackathon-v2` XML statement
   files. They are the most detailed track material currently available.
3. Those files are an unsigned July snapshot, use `v2`/`skeleton` names, and
   predate the scheduled public problem-statement release on 27 August. They
   are therefore recorded as **provisional track requirements**, not assumed
   to override a later organizer release.
4. Any public final statement, workshop clarification, or Devpost update must
   be diffed against this matrix. A later explicit organizer instruction wins.

Section 11.4 of the Official Rules is more specific: if the rules conflict
with a submission form, website, advertisement, or other TechJam material, the
Official Rules prevail. A track statement can add requirements where the rules
delegate to it, but it cannot waive an event-wide rule.

The unchecked boxes in `hackathon-v2-section-9.xml` are an organizer readiness
checklist. Their unchecked markup is not evidence that an item is unavailable;
availability must be verified independently.

## Competition-integrity boundary

- The rules permit a newly created project or a pre-existing project that is
  **significantly updated after** the Submission Period begins. This
  preparation task applies a stricter boundary: preserve and validate the
  organizer baseline now, but do not design or implement the judged delta
  before 29 August at 12:00 SGT.
- Open-source software is permitted when its licence is followed and the
  entrant creates software that enhances and builds on the underlying
  functionality. The organizer's MIT starter and OpenAI's Apache-2.0 Runtime
  therefore require continuing attribution and a distinguishable entrant
  contribution.
- Third-party APIs, SDKs, data, and developer tools require authorization and
  compliance with their licences. This is also a Stage One pass/fail gate: the
  project must reasonably apply the required APIs/SDKs featured in the event.
- The submission must be the entrant's original work product and owned by the
  entrant/team. The rules allow contracted technical assistance only when the
  submitted components remain the entrant's work product and result from the
  entrant's ideas and creativity.

## Universal pass gates

| Gate | Evidence the material requires |
| --- | --- |
| Select one track | Exactly one of Glass Box, Bouncer, or Kill Switch is named in the repository and opening demo material. |
| Preserve the baseline | Create/select an Agent and run a task through the supplied browser journey. |
| Use a real path | The middleware executes in the backend or Runtime; a static screen or browser-only check fails acceptance. |
| Show both sides | One positive case plus one failure, denial, or malicious case works without manual data edits during the demo. |
| Use the supplied runtime/model path | Use the one-line local Runtime and Ark; ECS is optional, and Track C may additionally use veFaaS Cloud Sandbox. |
| Protect secrets | No API key, AK/SK, password, or unredacted secret appears in source, browser state, logs, traces, screenshots, or demo output. |
| Automate core evidence | Tests or other automated evidence cover the central middleware event or policy decision. |
| Be reproducible and candid | Setup/deployment steps and known limitations are documented; another reviewer can follow the README. |

## Exactly-one track gates

| Track | Minimum functional evidence | Explicit non-qualifiers |
| --- | --- | --- |
| Glass Box — Trace and Audit | Stable Agent/Run/Trace/Span IDs; at least three meaningful step types; correlated browser timeline or tree; status, duration, errors, and available usage; pre-storage/UI redaction; a successful Run and a failed Run whose failing step a judge can diagnose within 30 seconds. | Generic logs without correlation. |
| Bouncer — Identity and Authorization | User A and User B; a distinct Agent principal linked to its owner; server-side policy protecting a resource; record human, Agent, action, resource, and allow/deny decision; one revocation/disable/permission update; backend denial of cross-user access that cannot be bypassed by changing a browser user ID. | A login screen without backend resource authorization. |
| Kill Switch — Safety and Sandboxing | One explicit threat and protected asset; a new isolation/policy adapter or veFaaS boundary; at least two bounded controls; visible blocked, terminated, and cleaned-up states; malicious action contained with the asset unchanged; a later safe Run succeeds. | Keyword-only prompt filtering or merely showing the starter's existing CPU, memory, PID, capability, and workspace limits. |

## Three-minute track demo sequence

1. Name the selected track and boundary.
2. Create or select an Agent in the supplied UI.
3. Run a normal coding task and show the expected result.
4. Trigger the selected track's failure, denial, or malicious case.
5. Show the functional trace, policy decision, or containment evidence.
6. State one limitation and one next step.

Mock users or protected data are explicitly permitted, but the Agent
interaction, middleware decision, and evidence must be functional.

## Deliverables and judging layers

The starter statement names three track deliverables: a three-minute live
demo, a one-page architecture diagram, and a runnable repository containing
setup, tests/evidence, the selected track, and limitations. Its track rubric is
40% end-to-end behavior, 25% design/integration, 20% verification/robustness,
and 15% demo/reproducibility.

Devpost separately requires a written project/technology description, a
public repository with a comprehensive README, and a public three-minute
YouTube demo. The current conservative interpretation is cumulative: prepare
the track's diagram and technical evidence while also satisfying every
Devpost submission field. Do not assume that “live demo” removes the video
requirement.

The working project must remain available free of charge and without
restriction for judging/testing until the Judging Period ends. Judges are not
required to run it and may judge from the description, images, and video, so a
working deployment does not compensate for unclear submission evidence. After
the Submission Period ends, entrants cannot substantively alter the
submission unless the organizer permits a narrow corrective change.

### Generic Devpost form mechanics

Devpost's organizer-linked help pages say the normal form includes team,
project name/tagline, gallery thumbnail, project story, technology tags,
optional Try it Out/image links, video, hackathon-specific questions, and a
final Submit step. The thumbnail limit is 5 MB with 3:2 recommended; “Built
with” allows up to 25 tags. These are generic platform instructions, so the
event's explicit public three-minute **YouTube** requirement is controlling
even though generic help also mentions Vimeo.

A saved project remains a draft until the final Submit step succeeds. Devpost
describes a green confirmation and `Submitted` status as the receipt; merely
creating or editing the project proves nothing. Edits are permitted before the
deadline, but after it they affect only the portfolio copy, not the hackathon
submission. No draft or submission was created during preparation.

## Items requiring final-release verification

- Final track name and numbering: the starter says “Track #5 v2”; this local
  directory's `track-1` name is only an isolation label.
- Whether the 40/25/20/15 track rubric remains final alongside the event-wide
  criteria in the Devpost rules.
- Whether organizers provide per-team Ark key/endpoint access, known prompts,
  Bouncer mock resources, veFaaS access, or ECS resources.
- Whether the submission requires an additional architecture upload or only
  inclusion in the repository/video.
- Whether the engineering-led workshops scheduled for 28 August,
  13:00–18:00 SGT clarify or change the local-runtime judging path, exact
  negative cases, or three-minute demonstration format.
- Public-voting dates conflict: the public information page currently says
  1 September 15:00 through 4 September 15:00, while the Official Rules say
  through 7 September 15:00. Treat the Official Rules as controlling unless
  they are amended.
