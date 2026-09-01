# Official platform contracts and starter boundary

Observed read-only on **2026-08-26 21:32 SGT**. These are current first-party
platform references named by the organizer starter, not a selected judged
solution or evidence that any cloud capability was exercised.

## Ark Responses API

The official Ark tool-calling guide documents an OpenAI-compatible Responses
endpoint at `https://ark.cn-beijing.volces.com/api/v3/responses`. A first
request supplies a model, input, and `tools`; a returned `function_call`
contains `call_id` and `arguments`; the client executes the tool; and a later
request associates `function_call_output` with the same `call_id` and the
prior response through `previous_response_id`. The page also lists built-in
web search, image processing, private knowledge search, custom functions, and
remote MCP. It was last updated `2026-08-04 11:36:35` when inspected.

Official references:

- <https://www.volcengine.com/docs/82379/1958524?lang=zh>
- <https://www.volcengine.com/docs/6257/64983?lang=en>

The IAM page recommends the dedicated Ark large-model API key instead of a
traditional cloud Access Key for model inference and says that key is
compatible with the OpenAI SDK. It was last updated `2025-06-23 19:21:32`.
No key was created, viewed, copied, or tested during preparation.

### What the starter actually implements

The pinned starter defaults `ARK_BASE_URL` to the same `/api/v3` base, writes
Codex configuration with `wire_api = "responses"`, selects the supplied
`ARK_MODEL`, and passes `ARK_API_KEY` only through the active Runtime
environment. The starter's own parser then retains only the Codex thread ID,
completed assistant text, completed-turn usage, and top-level errors. It does
not expose Ark's raw response ID or function `call_id`, and it discards most
structured Codex item events. Therefore the official API supports a richer
correlation surface than the unmodified Launchpad persists; that surface is
not baseline evidence.

### Workshop-permitted provider adapter

The participant-supplied workshop transcript says ModelArk is an example and
permits another authorized provider. It further narrows the practical Codex
boundary to an OpenAI-compatible Responses endpoint; a chat-completions-only
service would require an additional converter.

Source inspection at the starter-matching OpenAI tag `rust-v0.111.0`, commit
`8c75cd9afcd405d134530e53c78e5e0e4e5312a3`, confirms custom
`model_providers` entries with `base_url`, `env_key`, and Responses wire format.
That version explicitly rejects `wire_api = "chat"`. Launchpad now exposes an
opt-in `MODEL_*` adapter at the same configuration boundary while retaining Ark
as the default. Unit tests prove selection, fail-closed partial configuration,
and secret absence from generated TOML/container arguments. A real provider
call is still not claimed.

Official source references:

- <https://github.com/openai/codex/blob/8c75cd9afcd405d134530e53c78e5e0e4e5312a3/codex-rs/core/src/model_provider_info.rs>
- <https://github.com/openai/codex/blob/8c75cd9afcd405d134530e53c78e5e0e4e5312a3/codex-rs/core/config.schema.json>

## veFaaS Cloud Sandbox

The official veFaaS OpenAPI catalog version is `2024-06-06`. Its Sandbox
surface includes `CreateSandbox`, `KillSandbox`, `ListSandboxes`,
`SetSandboxTimeout`, `DescribeSandbox`, `PauseSandbox`, `ResumeSandbox`, image
precache/list/delete operations, and snapshot operations. The inspected
`CreateSandbox` contract, updated `2026-08-25 17:35:09`, requires a sandbox
application `FunctionId` and returns a `SandboxId`. Optional instance controls
include:

- lifetime: 3--1440 minutes, default 60 (or `second` via `TimeoutUnit`);
- CPU: 250--16000 milli-CPU, default 1000;
- memory: 512--131072 MiB, default 2048;
- request timeout: 1--900 seconds, default 30;
- image/command/port, environment, metadata, concurrency, storage mounts,
  sidecars, IAM roles, snapshots, automatic pause, and automatic snapshot.

Official references:

- <https://api.volcengine.com/api-docs/view/overview?serviceCode=vefaas&version=2024-06-06>
- <https://api.volcengine.com/api-docs/view?action=CreateSandbox&serviceCode=vefaas&version=2024-06-06>
- <https://www.volcengine.com/docs/6662/2278468>

The product guide describes Cloud Sandbox as a temporary cloud execution
environment with security isolation and controllable resources. Those are
platform claims, not reproduced results. No veFaaS account access,
`FunctionId`, Access Key/Secret Key, or live sandbox operation was available.

### What the starter actually implements

The starter contains no veFaaS client, API request, configuration variable,
SDK dependency, or infrastructure definition. It offers only a local
container Runner and an in-process Codex Runner. The starter's provisional
July material named veFaaS as an optional safety integration; the released
public statement does not require or name it and instead makes local execution
the default judging path. Consequently, veFaaS availability must not be
reported as an implemented, integrated, tested, or required boundary.

## Evidence classification

| Claim | Status |
| --- | --- |
| Official Ark Responses endpoint and tool-correlation protocol exist | Documentation-verified |
| Starter is configured for Ark Responses through Codex | Source-verified |
| Starter preserves Ark response/tool correlation | Contradicted by source |
| Official veFaaS sandbox lifecycle and resource controls exist | Documentation-verified |
| Starter implements veFaaS | Contradicted by source |
| Provider-neutral Responses config is generated without storing the key | Application-tested |
| Any model or veFaaS sandbox call succeeded locally | Not tested; credentials/access absent and pinned macOS Runtime blocked |

The raw public pages are client-rendered and mutable. Anonymous `curl`
snapshots are preserved only as retrieval artifacts; their hashes identify
the returned JavaScript shells and do not version the underlying page content.
