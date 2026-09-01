# Bouncer deletion protection

Bouncer is a narrow policy boundary behind every local Codex Run. Before the
Runtime executes Bash or `apply_patch`, an application-owned `PreToolUse` hook
classifies the proposed action. Ordinary workspace work continues. Direct file
deletion is denied before execution and the allow/deny decision is persisted on
the Run for Glassbox. Removing an already-empty directory with `rmdir` is
allowed so routine build-artifact cleanup does not suppress later commands.

The protected asset is the Agent workspace. Version 1 denies direct `rm`,
`unlink`, `shred`, `truncate`, `find ... -delete`, `git clean`,
`git reset --hard`, and `apply_patch` file deletion. It records the rule, tool,
redacted action, reason, time, and Runtime tool-use ID in an ignored per-Run
JSONL file. `CodexRunner` imports those records into the durable Run trace. A
Relay session also records that the policy was attached before each Runtime
started.

The launcher supplies one tracked hook script and includes that script in the
build SHA-256. Non-interactive Codex execution uses
`--dangerously-bypass-hook-trust` only to authorize that exact application
hook; it does not bypass the policy decision. The hook fails closed when its
input cannot be parsed. Common credential shapes and the local username are
redacted before audit storage.

This is not a complete sandbox, malware detector, authorization system, or
rollback mechanism. A program can delete through an unrecognized tool or
language, an allowed write can overwrite content, and side effects completed
before a later stop are not reversed. Codex hooks are an additional guardrail
and some tool paths may not invoke them. The live claim is therefore precise:
the listed direct deletion actions are blocked on the verified local Runtime;
ordinary actions still work. A stronger later boundary should combine a
filesystem sandbox, scoped credentials, explicit human approval, and broader
semantic policy without weakening this observable contract.

Official Runtime references:

- <https://learn.chatgpt.com/codex/hooks>
- <https://developers.openai.com/codex/rules>

The exact live allow/deny receipt is in
[`evidence/2026-08-29-live-bouncer.md`](../evidence/2026-08-29-live-bouncer.md).
