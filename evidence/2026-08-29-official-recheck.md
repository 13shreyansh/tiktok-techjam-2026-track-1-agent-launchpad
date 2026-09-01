# Official Track 1 recheck — 2026-08-29

All actions were read-only. No login, credential, organizer contact,
submission, registration change, repository-visibility change, or recording
download occurred.

## Written statement

At `2026-08-29 14:25 SGT`, the official information document at
<https://bytedance.larkoffice.com/wiki/GdYFwzWNLiREsSkuIjZcDznInWc> still
showed `Last updated: Aug 28`. A browser re-audit found no observed change to
the Track 1 acceptance gates, required three-minute scenario, 40/25/20/15
rubric, local-first execution guidance, optional ECS status, or FAQ.

## Workshop recording and transcript boundary

The promised recording was available at
<https://bytedance.my.larkoffice.com/minutes/obmyo2nvz5ht46844444284t> with the
browser-visible title `Track #1: Agent Launchpad: Design and Build Lightweight
Agent Middleware` and duration `40min 6s`. Guest access exposed only an
introductory clip. Following `Redirect to original Minutes` reached a Feishu
login page, so no login was attempted and no complete official export or
content checksum is claimed.

The participant supplied a 21,391-byte meeting transcript outside the
repository. Its SHA-256 is
`996d669bd9af4357e2b0205ac6efad1e8d752cf62486d2c8e9cbe93e2639ff93`.
No licence to redistribute it was supplied, so this repository records only
paraphrased technical clarifications:

- an authorized non-ModelArk provider is allowed;
- the starter expects an OpenAI-compatible Responses endpoint, while a
  chat-completions-only provider needs an adapter;
- a local POC is acceptable and remote ECS is not mandatory;
- the starter/lifecycle may be modified or replaced if reproducible;
- the capability must be platform-level and reusable across Agents rather than
  a behavior available only to one bespoke Agent;
- runtime interception, mock-resource action, recovery, and combined
  authorization/approval/audit behavior are in scope.

These are transcript-derived Q&A notes, not a substitute for written rules.
The written statement and Official Rules control if any conflict or
transcription error is found.

## Strategic implication

The current Durable Agent Relay matches the clarified product boundary: it is
an Agent-independent control-plane capability, runs locally, retains state
outside the browser connection, and exposes normal plus recovery evidence. The
clarification broadens the credential path but does not itself supply or prove
one. A successful real-model Run remains unverified until an authorized
Responses-compatible endpoint, key, and model ID are provided and the command
succeeds.
