import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { bouncerHookPath, buildCodexArgs, parseCodexEventLine } from "./codex-runner.js";

describe("Codex runner protocol", () => {
  it("builds a new-session invocation", () => {
    const args = buildCodexArgs(
      {
        runId: "run-new",
        agentId: "agent",
        workspacePath: "/tmp/workspace",
        prompt: "build a calculator",
        threadId: null,
      },
      "workspace-write",
    );
    expect(args.slice(0, 7)).toEqual([
      "exec",
      "--json",
      "--sandbox",
      "workspace-write",
      "--skip-git-repo-check",
      "-C",
      "/tmp/workspace",
    ]);
    expect(args).toContain("--dangerously-bypass-hook-trust");
    expect(args.find((arg) => arg.includes("hooks.PreToolUse"))).toContain("bouncer-hook.mjs");
    expect(args.at(-1)).toBe("build a calculator");
  });

  it("resumes a stored Codex thread", () => {
    const args = buildCodexArgs(
      {
        runId: "run-resume",
        agentId: "agent",
        workspacePath: "/tmp/workspace",
        prompt: "add tests",
        threadId: "thread-123",
      },
      "workspace-write",
    );
    expect(args.slice(-3)).toEqual(["resume", "thread-123", "add tests"]);
  });

  it("denies a destructive deletion and allows an ordinary command", () => {
    const denied = execFileSync(process.execPath, [bouncerHookPath], {
      encoding: "utf8",
      input: JSON.stringify({
        tool_name: "Bash",
        tool_use_id: "delete-attempt",
        tool_input: { command: "rm protected.txt" },
      }),
    });
    expect(JSON.parse(denied)).toMatchObject({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
      },
    });

    const allowed = execFileSync(process.execPath, [bouncerHookPath], {
      encoding: "utf8",
      input: JSON.stringify({
        tool_name: "Bash",
        tool_use_id: "read-attempt",
        tool_input: { command: "sed -n '1,20p' README.md" },
      }),
    });
    expect(allowed).toBe("");

    const patchDenied = execFileSync(process.execPath, [bouncerHookPath], {
      encoding: "utf8",
      input: JSON.stringify({
        tool_name: "apply_patch",
        tool_use_id: "patch-delete-attempt",
        tool_input: { patch: "*** Begin Patch\n*** Delete File: protected.txt\n*** End Patch" },
      }),
    });
    expect(JSON.parse(patchDenied)).toMatchObject({
      hookSpecificOutput: { permissionDecision: "deny" },
    });

    const emptyDirectoryCleanup = execFileSync(process.execPath, [bouncerHookPath], {
      encoding: "utf8",
      input: JSON.stringify({
        tool_name: "Bash",
        tool_use_id: "empty-directory-cleanup",
        tool_input: { command: "rmdir output/browser-wide output 2>/dev/null || true; node --test" },
      }),
    });
    expect(emptyDirectoryCleanup).toBe("");
  });

  it("extracts the session, final message and usage", () => {
    const parsed = {
      messages: [] as string[],
      threadId: null as string | null,
      usage: null as {
        inputTokens?: number;
        cachedInputTokens?: number;
        outputTokens?: number;
      } | null,
      errors: [] as string[],
      trace: [],
    };
    parseCodexEventLine(
      JSON.stringify({ type: "thread.started", thread_id: "thread-123" }),
      parsed,
    );
    parseCodexEventLine(
      JSON.stringify({
        type: "item.completed",
        item: { type: "agent_message", text: "Done." },
      }),
      parsed,
    );
    parseCodexEventLine(
      JSON.stringify({
        type: "turn.completed",
        usage: { input_tokens: 10, output_tokens: 4 },
      }),
      parsed,
    );
    expect(parsed.threadId).toBe("thread-123");
    expect(parsed.messages).toEqual(["Done."]);
    expect(parsed.usage).toEqual({ inputTokens: 10, outputTokens: 4 });
    expect(parsed.trace.map((event) => event.title)).toEqual([
      "Codex Runtime connected",
      "Agent reported progress",
      "Codex turn completed",
    ]);
  });

  it("captures and redacts real command evidence", () => {
    const parsed = {
      messages: [] as string[],
      threadId: null as string | null,
      usage: null,
      errors: [] as string[],
      trace: [],
    };
    parseCodexEventLine(
      JSON.stringify({
        type: "item.completed",
        item: {
          id: "item-command",
          type: "command_execution",
          command: "API_KEY=super-secret npm run check",
          aggregated_output: "all checks passed",
          exit_code: 0,
          status: "completed",
        },
      }),
      parsed,
    );
    expect(parsed.trace[0]).toMatchObject({
      kind: "command",
      phase: "completed",
      title: "Command completed",
      summary: "API_KEY=[REDACTED] npm run check",
      detail: "all checks passed",
      exitCode: 0,
    });
  });

  it("keeps command start and completion as separate immutable records", () => {
    const parsed = {
      messages: [] as string[],
      threadId: null as string | null,
      usage: null,
      errors: [] as string[],
      trace: [],
    };
    const item = { id: "item-command", type: "command_execution", command: "node test.js" };
    parseCodexEventLine(JSON.stringify({ type: "item.started", item }), parsed);
    parseCodexEventLine(
      JSON.stringify({
        type: "item.completed",
        item: { ...item, status: "completed", exit_code: 0, aggregated_output: "ok" },
      }),
      parsed,
    );
    expect(parsed.trace.map((event) => [event.id, event.phase])).toEqual([
      ["item-command:started", "started"],
      ["item-command:completed", "completed"],
    ]);
  });
});
