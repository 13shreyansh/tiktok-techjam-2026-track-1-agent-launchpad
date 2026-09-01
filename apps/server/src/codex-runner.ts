import { execFile } from "node:child_process";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { AppConfig } from "./config.js";
import { RunCancelledError } from "./errors.js";
import type {
  AgentRunner,
  RunTraceEvent,
  RunTracePhase,
  RunUsage,
  RunnerRequest,
  RunnerResult,
} from "./types.js";

const execFileAsync = promisify(execFile);
export const bouncerHookPath = fileURLToPath(
  new URL("../../../scripts/bouncer-hook.mjs", import.meta.url),
);

interface BouncerDecision {
  id: string;
  at: string;
  decision: "allow" | "deny";
  rule: string;
  reason: string;
  toolName: string;
  action: string;
}

export interface ParsedEvents {
  messages: string[];
  threadId: string | null;
  usage: RunUsage | null;
  errors: string[];
  trace: RunTraceEvent[];
}

const traceNow = () => new Date().toISOString();

function truncate(value: string, limit: number): string {
  const normalized = value.replace(/\u0000/g, "").trim();
  return normalized.length <= limit ? normalized : normalized.slice(0, limit - 1) + "…";
}

export function redactTraceText(value: string, limit = 1_200): string {
  return truncate(
    value
      .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [REDACTED]")
      .replace(
        /\b((?:api|access|auth|secret|password|token|key)[-_a-z0-9]*)(\s*[=:]\s*)(["']?)[^\s"'&;]+\3/gi,
        "$1$2[REDACTED]",
      )
      .replace(/\b(?:sk|pk|rk)-[A-Za-z0-9_-]{12,}\b/g, "[REDACTED_KEY]")
      .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED_TOKEN]")
      .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, "$1[REDACTED]@")
      .replace(/\/(?:Users|home)\/[^/\s]+/g, "~"),
    limit,
  );
}

function traceText(value: unknown, limit: number): string | null {
  return typeof value === "string" && value.trim()
    ? redactTraceText(value, limit)
    : null;
}

function emitTrace(
  parsed: ParsedEvents,
  candidate: Omit<RunTraceEvent, "sequence" | "at" | "updatedAt">,
  onTrace?: (event: RunTraceEvent) => void,
): void {
  const updatedAt = traceNow();
  const event: RunTraceEvent = {
    ...candidate,
    id: `${candidate.id}:${candidate.phase}`,
    sequence: parsed.trace.length + 1,
    at: updatedAt,
    updatedAt,
  };
  parsed.trace.push(event);
  onTrace?.(event);
}

function itemTrace(
  eventType: unknown,
  item: Record<string, unknown>,
): Omit<RunTraceEvent, "sequence" | "at" | "updatedAt"> | null {
  const itemId = typeof item.id === "string" ? item.id : `item-${String(item.type ?? "unknown")}`;
  const started = eventType === "item.started";
  const status = typeof item.status === "string" ? item.status : null;
  const failed = status === "failed" || (typeof item.exit_code === "number" && item.exit_code !== 0);
  const phase: RunTracePhase = started ? "started" : failed ? "failed" : "completed";
  const exitCode = typeof item.exit_code === "number" ? item.exit_code : null;

  if (item.type === "command_execution") {
    return {
      id: itemId,
      kind: "command",
      phase,
      title: started ? "Running command" : failed ? "Command failed" : "Command completed",
      summary: traceText(item.command, 500),
      detail: started ? null : traceText(item.aggregated_output, 1_200),
      exitCode,
    };
  }

  if (item.type === "file_change") {
    const changes = Array.isArray(item.changes)
      ? item.changes
          .map((change) => {
            if (!change || typeof change !== "object") return null;
            const record = change as Record<string, unknown>;
            const path = traceText(record.path, 300);
            const kind = traceText(record.kind, 60);
            return [kind, path].filter(Boolean).join(" · ");
          })
          .filter((change): change is string => Boolean(change))
      : [];
    return {
      id: itemId,
      kind: "file",
      phase,
      title: started ? "Preparing file changes" : failed ? "File change failed" : "Files changed",
      summary: changes.length ? changes.join("\n") : "Workspace files were updated",
      detail: null,
      exitCode,
    };
  }

  if (item.type === "mcp_tool_call") {
    const server = traceText(item.server, 100);
    const tool = traceText(item.tool, 160);
    return {
      id: itemId,
      kind: "tool",
      phase,
      title: started ? "Calling tool" : failed ? "Tool call failed" : "Tool call completed",
      summary: [server, tool].filter(Boolean).join(" · ") || "Runtime tool",
      detail: null,
      exitCode,
    };
  }

  if (item.type === "web_search") {
    return {
      id: itemId,
      kind: "web",
      phase,
      title: started ? "Searching the web" : failed ? "Web search failed" : "Web search completed",
      summary: traceText(item.query, 500),
      detail: null,
      exitCode,
    };
  }

  if (item.type === "agent_message" && !started) {
    return {
      id: itemId,
      kind: "message",
      phase: "completed",
      title: "Agent reported progress",
      summary: traceText(item.text, 700),
      detail: null,
      exitCode: null,
    };
  }

  return null;
}

export function buildCodexArgs(
  request: RunnerRequest,
  sandboxMode: AppConfig["codexSandboxMode"],
  workspacePath = request.workspacePath,
  ignoreUserConfig = false,
): string[] {
  const args = [
    "exec",
    "--json",
    "--sandbox",
    sandboxMode,
    "--skip-git-repo-check",
    "-C",
    workspacePath,
  ];
  if (ignoreUserConfig) args.push("--ignore-user-config");
  const hookCommand = `${JSON.stringify(process.execPath)} ${JSON.stringify(bouncerHookPath)}`;
  args.push(
    "--dangerously-bypass-hook-trust",
    "-c",
    `hooks.PreToolUse=[{matcher="^(Bash|apply_patch)$",hooks=[{type="command",command=${JSON.stringify(hookCommand)},timeout=5,statusMessage="Bouncer checking action"}]}]`,
  );
  if (request.threadId) {
    args.push("resume", request.threadId, request.prompt);
  } else {
    args.push(request.prompt);
  }
  return args;
}

export function parseCodexEventLine(
  line: string,
  parsed: ParsedEvents,
  onTrace?: (event: RunTraceEvent) => void,
): void {
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return;
  }

  if (event.type === "thread.started" && typeof event.thread_id === "string") {
    parsed.threadId = event.thread_id;
    emitTrace(
      parsed,
      {
        id: `thread-${event.thread_id}`,
        kind: "runtime",
        phase: "started",
        title: "Codex Runtime connected",
        summary: `Session ${event.thread_id.slice(0, 12)}…`,
        detail: null,
        exitCode: null,
      },
      onTrace,
    );
  }

  if (
    (event.type === "item.started" || event.type === "item.completed") &&
    event.item &&
    typeof event.item === "object"
  ) {
    const item = event.item as Record<string, unknown>;
    if (event.type === "item.completed" && item.type === "agent_message" && typeof item.text === "string") {
      parsed.messages.push(item.text);
    }
    const trace = itemTrace(event.type, item);
    if (trace) emitTrace(parsed, trace, onTrace);
  }

  if (event.type === "turn.completed" && event.usage && typeof event.usage === "object") {
    const usage = event.usage as Record<string, unknown>;
    parsed.usage = {
      ...(typeof usage.input_tokens === "number"
        ? { inputTokens: usage.input_tokens }
        : {}),
      ...(typeof usage.cached_input_tokens === "number"
        ? { cachedInputTokens: usage.cached_input_tokens }
        : {}),
      ...(typeof usage.output_tokens === "number"
        ? { outputTokens: usage.output_tokens }
        : {}),
    };
    emitTrace(
      parsed,
      {
        id: "turn-completed",
        kind: "runtime",
        phase: "completed",
        title: "Codex turn completed",
        summary:
          typeof usage.output_tokens === "number"
            ? `${usage.output_tokens} output tokens`
            : null,
        detail: null,
        exitCode: 0,
      },
      onTrace,
    );
  }

  if (event.type === "error") {
    const message =
      typeof event.message === "string"
        ? event.message
        : typeof event.error === "string"
          ? event.error
          : "Codex reported an unknown error";
    parsed.errors.push(message);
    emitTrace(
      parsed,
      {
        id: `runtime-error-${parsed.errors.length}`,
        kind: "error",
        phase: "failed",
        title: "Runtime error",
        summary: redactTraceText(message, 700),
        detail: null,
        exitCode: null,
      },
      onTrace,
    );
  }
}

export class CodexRunner implements AgentRunner {
  private readonly active = new Map<
    string,
    {
      child: ChildProcess;
      cancelled: boolean;
      timedOut: boolean;
      outputExceeded: boolean;
      settled: Promise<void>;
      forceKillTimer: NodeJS.Timeout | null;
    }
  >();

  constructor(private readonly config: AppConfig) {}

  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync(this.config.codexBin, ["--version"], {
        timeout: 5_000,
        env: this.childEnvironment(),
      });
      return true;
    } catch {
      return false;
    }
  }

  async cancel(agentId: string): Promise<boolean> {
    const active = this.active.get(agentId);
    if (!active) {
      return false;
    }
    active.cancelled = true;
    this.terminate(active);
    await active.settled;
    return true;
  }

  async run(request: RunnerRequest): Promise<RunnerResult> {
    if (this.active.has(request.agentId)) {
      throw new Error("Agent already has an active Codex process");
    }

    const bouncerDirectory = path.join(this.config.dataDirectory, "bouncer");
    const bouncerLogPath = path.join(bouncerDirectory, `${request.runId}.jsonl`);
    await mkdir(bouncerDirectory, { recursive: true });
    await writeFile(bouncerLogPath, "", { encoding: "utf8", mode: 0o600 });

    const args = buildCodexArgs(
      request,
      this.config.codexSandboxMode,
      request.workspacePath,
      this.config.codexAuthMode === "chatgpt",
    );
    const child = spawn(this.config.codexBin, args, {
      cwd: request.workspacePath,
      env: this.childEnvironment({
        LAUNCHPAD_BOUNCER_LOG: bouncerLogPath,
        // The durable workspace lives inside the Launchpad repository. Prevent
        // tools such as `git status` from walking upward and exposing unrelated
        // implementation changes to a task-specific Runtime.
        GIT_CEILING_DIRECTORIES: path.dirname(request.workspacePath),
      }),
      stdio: ["ignore", "pipe", "pipe"],
    });
    const settled = new Promise<void>((resolve) => {
      child.once("close", () => resolve());
      child.once("error", () => resolve());
    });
    const active = {
      child,
      cancelled: false,
      timedOut: false,
      outputExceeded: false,
      settled,
      forceKillTimer: null as NodeJS.Timeout | null,
    };
    this.active.set(request.agentId, active);

    const parsed: ParsedEvents = {
      messages: [],
      threadId: request.threadId,
      usage: null,
      errors: [],
      trace: [],
    };
    emitTrace(
      parsed,
      {
        id: "bouncer-active",
        kind: "policy",
        phase: "completed",
        title: "Bouncer policy active",
        summary: "Normal workspace actions allowed · destructive deletion blocked before execution",
        detail: "Policy no-file-deletion v1",
        exitCode: null,
      },
      request.onTrace,
    );
    let bouncerLineCount = 0;
    let drainingBouncer = false;
    const drainBouncerLog = async () => {
      if (drainingBouncer) return;
      drainingBouncer = true;
      try {
        const contents = await readFile(bouncerLogPath, "utf8");
        const lines = contents.split(/\r?\n/).filter(Boolean);
        for (const line of lines.slice(bouncerLineCount)) {
          let decision: BouncerDecision;
          try {
            decision = JSON.parse(line) as BouncerDecision;
          } catch {
            continue;
          }
          emitTrace(
            parsed,
            {
              id: `bouncer-${decision.id}`,
              kind: "policy",
              phase: decision.decision === "deny" ? "failed" : "completed",
              title: decision.decision === "deny" ? "Action blocked" : "Action allowed",
              summary: `${decision.rule} · ${decision.toolName}`,
              detail:
                decision.decision === "deny"
                  ? [decision.action, decision.reason].filter(Boolean).join("\n")
                  : decision.action || decision.reason,
              exitCode: null,
            },
            request.onTrace,
          );
        }
        bouncerLineCount = lines.length;
      } finally {
        drainingBouncer = false;
      }
    };
    const bouncerPoll = setInterval(() => void drainBouncerLog(), 100);
    bouncerPoll.unref();
    let stdout = "";
    let stderr = "";
    let totalBytes = 0;

    const consume = (chunk: Buffer, target: "stdout" | "stderr") => {
      totalBytes += chunk.byteLength;
      if (totalBytes > this.config.codexMaxOutputBytes) {
        active.outputExceeded = true;
        this.terminate(active);
        return;
      }
      if (target === "stdout") {
        stdout += chunk.toString("utf8");
        const lines = stdout.split(/\r?\n/);
        stdout = lines.pop() ?? "";
        for (const line of lines) {
          parseCodexEventLine(line, parsed, request.onTrace);
        }
      } else {
        stderr += chunk.toString("utf8");
        if (stderr.length > 16_384) {
          stderr = stderr.slice(-16_384);
        }
      }
    };

    child.stdout.on("data", (chunk: Buffer) => consume(chunk, "stdout"));
    child.stderr.on("data", (chunk: Buffer) => consume(chunk, "stderr"));

    const timeout = setTimeout(() => {
      active.timedOut = true;
      this.terminate(active);
    }, this.config.codexTimeoutMs);
    timeout.unref();

    try {
      const exitCode = await new Promise<number>((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (code) => resolve(code ?? 1));
      });
      if (stdout.trim()) {
        parseCodexEventLine(stdout.trim(), parsed, request.onTrace);
      }
      await drainBouncerLog();
      if (active.cancelled) {
        throw new RunCancelledError();
      }
      if (active.timedOut) {
        throw new Error("Codex timed out after " + this.config.codexTimeoutMs + " ms");
      }
      if (active.outputExceeded) {
        throw new Error("Codex output exceeded CODEX_MAX_OUTPUT_BYTES");
      }
      if (exitCode !== 0) {
        const detail = parsed.errors.at(-1) ?? stderr.trim() ?? "No error detail";
        throw new Error("Codex exited with code " + exitCode + ": " + detail);
      }
      const output = parsed.messages.at(-1)?.trim();
      if (!output) {
        throw new Error("Codex completed without an agent message");
      }
      return {
        output,
        threadId: parsed.threadId,
        usage: parsed.usage,
      };
    } finally {
      clearInterval(bouncerPoll);
      await drainBouncerLog().catch(() => undefined);
      clearTimeout(timeout);
      if (active.forceKillTimer) clearTimeout(active.forceKillTimer);
      this.active.delete(request.agentId);
    }
  }

  private terminate(active: {
    child: ChildProcess;
    forceKillTimer: NodeJS.Timeout | null;
  }): void {
    if (active.child.exitCode !== null || active.child.signalCode !== null) return;
    active.child.kill("SIGTERM");
    if (!active.forceKillTimer) {
      active.forceKillTimer = setTimeout(() => active.child.kill("SIGKILL"), 3_000);
      active.forceKillTimer.unref();
    }
  }

  private childEnvironment(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
    const inheritedNames = [
      "PATH",
      "HOME",
      "TMPDIR",
      "LANG",
      "LC_ALL",
      "SSL_CERT_FILE",
      "SSL_CERT_DIR",
      "HTTP_PROXY",
      "HTTPS_PROXY",
      "NO_PROXY",
      "NODE_EXTRA_CA_CERTS",
      "TERM",
    ] as const;
    const environment: NodeJS.ProcessEnv = {
      CODEX_HOME: this.config.codexHome,
      NO_COLOR: "1",
      ...extra,
    };
    if (this.config.codexAuthMode === "provider-key") {
      environment[this.config.modelApiKeyEnv] = this.config.modelApiKey;
    }
    for (const name of inheritedNames) {
      if (process.env[name] !== undefined) environment[name] = process.env[name];
    }
    return environment;
  }
}
