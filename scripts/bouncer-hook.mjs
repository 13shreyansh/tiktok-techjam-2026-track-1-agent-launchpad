#!/usr/bin/env node

import { appendFileSync } from "node:fs";

const MAX_ACTION_LENGTH = 700;
const BLOCK_REASON =
  "Bouncer blocked a destructive deletion before the tool ran. Keep the file, or ask a human to change the policy.";

function redact(value) {
  return String(value ?? "")
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [REDACTED]")
    .replace(
      /\b((?:api|access|auth|secret|password|token|key)[-_a-z0-9]*)(\s*[=:]\s*)(["']?)[^\s"'&;]+\3/gi,
      "$1$2[REDACTED]",
    )
    .replace(/\b(?:sk|pk|rk)-[A-Za-z0-9_-]{12,}\b/g, "[REDACTED_KEY]")
    .replace(/\/(?:Users|home)\/[^/\s]+/g, "~")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, MAX_ACTION_LENGTH);
}

export function evaluateAction(input) {
  const toolName = typeof input?.tool_name === "string" ? input.tool_name : "unknown";
  const actionText = ["command", "patch", "input", "script"]
    .map((key) => input?.tool_input?.[key])
    .find((value) => typeof value === "string") ?? "";

  if (toolName === "apply_patch" && /^\*\*\* Delete File:/m.test(actionText)) {
    return {
      decision: "deny",
      rule: "no-file-deletion",
      reason: BLOCK_REASON,
      toolName,
      action: redact(actionText),
    };
  }

  if (toolName === "Bash") {
    const destructiveCommand =
      /(?:^|[\n;&|()'"`])\s*(?:sudo\s+)?(?:\S*\/)?(?:rm|unlink|shred|truncate)\b/i.test(actionText) ||
      /(?:^|[\n;&|()'"`])\s*git\s+(?:-\S+\s+)*clean\b/i.test(actionText) ||
      /(?:^|[\n;&|()'"`])\s*git\s+(?:-\S+\s+)*reset\b[^\n;&|]*--hard\b/i.test(actionText) ||
      /(?:^|[\n;&|()'"`])\s*find\b[^\n;&|]*\s-delete(?:\s|$)/i.test(actionText);
    if (destructiveCommand) {
      return {
        decision: "deny",
        rule: "no-destructive-shell-deletion",
        reason: BLOCK_REASON,
        toolName,
        action: redact(actionText),
      };
    }
  }

  return {
    decision: "allow",
    rule: "ordinary-workspace-action",
    reason: "The action does not match the active deletion-protection rules.",
    toolName,
    action: redact(actionText),
  };
}

function recordDecision(input, decision) {
  const logPath = process.env.LAUNCHPAD_BOUNCER_LOG;
  if (!logPath) return;
  const record = {
    id:
      typeof input?.tool_use_id === "string" && input.tool_use_id
        ? input.tool_use_id
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    at: new Date().toISOString(),
    ...decision,
  };
  try {
    appendFileSync(logPath, `${JSON.stringify(record)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
  } catch {
    // Enforcement must not depend on audit-log availability.
  }
}

async function main() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: "Bouncer could not validate this action, so it failed closed.",
        },
      }),
    );
    return;
  }

  const decision = evaluateAction(input);
  recordDecision(input, decision);
  if (decision.decision === "deny") {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: decision.reason,
        },
      }),
    );
  }
}

if (process.argv[1]?.endsWith("bouncer-hook.mjs")) {
  await main();
}
