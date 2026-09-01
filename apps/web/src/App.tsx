import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, setAuthToken } from "./api";
import type { Agent, AgentRun, Message, RelaySession, SystemInfo, TaskPlan } from "./types";

const starterPrompts = [
  "Inspect this workspace and explain what you would improve first.",
  "Build the feature I describe, verify it, and show me the usable result.",
];

const emptyForm = {
  name: "",
  description: "",
  instructions:
    "Help me build and test software in this workspace. Keep changes small and explain the result.",
};

const CHECKPOINT_SESSION_KEY = "launchpad.checkpoint.session";

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(start: string, end: string): string {
  const elapsedSeconds = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1_000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function statusLabel(status: Agent["status"]): string {
  if (status === "ready") return "workspace available";
  if (status === "busy") return "Agent working";
  if (status === "stopped") return "Agent stopped";
  return "Agent error";
}

function StatusPill({ status }: { status: Agent["status"] }) {
  return (
    <span className={"status status-" + status} title={`Workspace state: ${statusLabel(status)}`}>
      <span className="status-dot" />
      {statusLabel(status)}
    </span>
  );
}

function Spinner() {
  return <span className="spinner" aria-label="Loading" />;
}

type GlassboxEntry = {
  id: string;
  at: string;
  kind: "runtime" | "policy" | "control" | "message" | "command" | "file" | "tool" | "web" | "handoff" | "recovery" | "error";
  phase: "started" | "completed" | "failed";
  source: "Runtime" | "Middleware";
  title: string;
  summary: string | null;
  detail: string | null;
  agentName: string;
  runId: string | null;
  checkpoint: number | null;
  raw: string;
};

type WorkspaceView = "workroom" | "ledger" | "map";

const relayEventLabels: Record<string, string> = {
  "session.started": "Reliable job started",
  "plan.created": "Team decision recorded",
  "worker.created": "Task-specific worker created",
  "coordinator.recovered": "Coordinator recovered pending work",
  "policy.enforced": "Bouncer attached",
  "run.started": "Agent Runtime started",
  "run.interrupt-requested": "Kill Switch requested",
  "run.interrupted": "Runtime terminated",
  "run.interrupt-failed": "Kill Switch failed",
  "run.cancelled": "Runtime terminated after job stop",
  "run.cancel-failed": "Agent cancellation failed",
  "workspace.opened": "Isolated workspace opened",
  "workspace.committed": "Accepted checkpoint promoted",
  "workspace.discarded": "Unaccepted changes discarded",
  "preview.attested": "Proof Gate verified the real app",
  "preview.attestation-failed": "Proof Gate found a browser blocker",
  "fault.injected": "Recovery drill triggered",
  "turn.retrying": "Work resumed in a fresh Runtime",
  "turn.duplicate-suppressed": "Duplicate result rejected",
  "turn.failed": "Checkpoint failed",
  "turn.assigned": "Checkpoint queued",
  "turn.claimed": "Agent accepted checkpoint",
  "checkpoint.saved": "Checkpoint saved",
  "handoff.sent": "Evidence handed to next Agent",
  "artifact.saved": "Artifact saved",
  "review.passed": "Independent review passed",
  "review.revision-requested": "Revision requested",
  "turn.completed": "Checkpoint completed",
  "session.completed": "Job completed",
  "session.failed": "Job failed",
  "session.cancelled": "Job cancelled",
};

function shortId(value: string): string {
  return value.slice(0, 8);
}

function runHistoryLabel(session: RelaySession): string {
  const summary = (session.coordinationPlan?.summary ?? session.taskBrief ?? "Untitled task")
    .replace(/\s+/g, " ")
    .trim();
  const compactSummary = summary.length > 46 ? `${summary.slice(0, 45).trimEnd()}…` : summary;
  const workers = session.participantAgentIds.length;
  return `${formatTime(session.createdAt)} · ${workers} ${workers === 1 ? "Agent" : "Agents"} · ${compactSummary}`;
}

function checkpointFromTurnId(turnId: string | null): number | null {
  if (!turnId) return null;
  const match = turnId.match(/:turn:(\d+)$/);
  return match ? Number(match[1]) : null;
}

function GlassboxPanel({
  runs,
  relay,
  agents,
  source,
  view,
  onReplayProof,
  replayDisabled,
}: {
  runs: AgentRun[];
  relay?: RelaySession | null;
  agents: Agent[];
  source: SystemInfo["source"] | null;
  view: WorkspaceView;
  onReplayProof: () => void;
  replayDisabled: boolean;
}) {
  const agentName = (agentId: string | null) =>
    agents.find((agent) => agent.id === agentId)?.name ?? "Agent";
  const checkpointByRunId = new Map<string, number>();
  for (const turn of relay?.acceptedTurns ?? []) {
    checkpointByRunId.set(turn.runId, turn.value);
  }
  for (const event of relay?.events ?? []) {
    const checkpoint = checkpointFromTurnId(event.turnId);
    if (event.runId && checkpoint !== null) checkpointByRunId.set(event.runId, checkpoint);
  }
  const entries: GlassboxEntry[] = runs.flatMap((run) =>
    (run.trace ?? []).map((event) => ({
      id: `${run.id}:${event.id}`,
      at: event.at,
      kind: event.kind,
      phase: event.phase,
      source: "Runtime" as const,
      title: event.title,
      summary: event.summary,
      detail: event.detail,
      agentName: agentName(run.agentId),
      runId: run.id,
      checkpoint: checkpointByRunId.get(run.id) ?? null,
      raw: JSON.stringify({ runId: run.id, agentId: run.agentId, ...event }, null, 2),
    })),
  );

  for (const event of relay?.events ?? []) {
    const isPolicy = event.type.startsWith("policy.");
    const isBrowserProof = event.type.startsWith("preview.");
    const isControl = [
      "run.interrupt-requested",
      "run.interrupted",
      "run.interrupt-failed",
      "run.cancelled",
      "run.cancel-failed",
    ].includes(event.type);
    const isRecovery = [
      "coordinator.recovered",
      "run.interrupt-requested",
      "run.interrupted",
      "run.interrupt-failed",
      "run.cancelled",
      "run.cancel-failed",
      "fault.injected",
      "turn.retrying",
      "turn.duplicate-suppressed",
      "turn.failed",
    ].includes(event.type);
    const isFailure = event.type.includes("failed") || event.type.includes("cancelled");
    entries.push({
      id: event.id,
      at: event.at,
      kind: isPolicy ? "policy" : isControl ? "control" : isFailure ? "error" : isBrowserProof ? "web" : isRecovery ? "recovery" : "handoff",
      phase:
        isFailure
          ? "failed"
          : event.type.includes("started") || event.type === "run.interrupt-requested" || event.type === "turn.claimed" || event.type === "turn.assigned"
            ? "started"
            : "completed",
      source: "Middleware",
      title: relayEventLabels[event.type] ?? event.type.replaceAll(".", " "),
      summary: event.detail,
      detail: event.attempt ? `Attempt ${event.attempt}` : null,
      agentName: event.agentId ? agentName(event.agentId) : "Coordinator",
      runId: event.runId ?? null,
      checkpoint: checkpointFromTurnId(event.turnId),
      raw: JSON.stringify(event, null, 2),
    });
  }

  const orderedEntries = entries.sort((left, right) => left.at.localeCompare(right.at));
  const recentEntries = orderedEntries.slice(-12);
  const activeRun = runs.find((run) => run.status === "running");
  const activeTrace = activeRun?.trace?.at(-1);
  const recoveryCount = (relay?.events ?? []).filter(
    (event) => event.type === "turn.retrying" || event.type === "coordinator.recovered",
  ).length;
  const policyCount = runs.reduce(
    (total, run) => total + (run.trace ?? []).filter((event) => event.kind === "policy").length,
    0,
  );
  const runtimeHashedEvents = runs.reduce(
    (total, run) => total + (run.trace ?? []).filter((event) => Boolean(event.eventHash)).length,
    0,
  );
  const runtimeEventCount = runs.reduce((total, run) => total + (run.trace?.length ?? 0), 0);
  const runtimeChainsVerified =
    runs.length > 0 &&
    runs.every((run) => {
      const trace = run.trace ?? [];
      return trace.length > 0 && trace.every((event, index) =>
        index === 0
          ? event.previousHash === "GENESIS"
          : event.previousHash === trace[index - 1]?.eventHash,
      );
    });
  const blockedCount = runs.reduce(
    (total, run) =>
      total + (run.trace ?? []).filter((event) => event.kind === "policy" && event.phase === "failed").length,
    0,
  );
  const stoppedRunIds = new Set(
    relay
      ? relay.events
          .filter((event) => event.type === "run.interrupted")
          .map((event) => event.runId)
          .filter((runId): runId is string => Boolean(runId))
      : runs.filter((run) => run.status === "cancelled").map((run) => run.id),
  );
  const stoppedCount = stoppedRunIds.size;
  const hashedEvents = (relay?.events ?? []).filter((event) => Boolean(event.eventHash)).length;
  const linkedEventCount = hashedEvents + runtimeHashedEvents;
  const totalEventCount = (relay?.events.length ?? 0) + runtimeEventCount;
  const workerCount = relay?.coordinationPlan?.workers.length ?? 0;
  const savedCheckpointCount = relay?.acceptedTurns.length ?? 0;
  const latestPreviewAttestation = relay?.previewAttestations?.at(-1) ?? null;
  const chainVerified = Boolean(
    relay &&
      relay.events.length > 0 &&
      hashedEvents === relay.events.length &&
      relay.events.every((event, index) =>
        index === 0
          ? event.previousHash === "GENESIS"
          : event.previousHash === relay.events[index - 1]?.eventHash,
      ),
  );
  const currentStatement = activeTrace
    ? `${agentName(activeRun?.agentId ?? null)} · ${activeTrace.title}`
    : relay?.status === "completed"
      ? recoveryCount
        ? `Complete · ${recoveryCount} interruption${recoveryCount === 1 ? "" : "s"} recovered without repeating saved work.`
        : "Complete · every accepted handoff and Runtime action is recorded below."
      : orderedEntries.length
        ? orderedEntries.at(-1)?.title ?? "Activity recorded"
        : "Waiting for the first real Runtime event.";
  const currentAgentName = activeRun
    ? agentName(activeRun.agentId)
    : orderedEntries.at(-1)?.agentName ?? "Agent";
  const currentAction = activeTrace?.title ?? orderedEntries.at(-1)?.title ?? "Ready for activity";
  const currentSummary = activeTrace?.summary ?? orderedEntries.at(-1)?.summary;
  const evidenceRoot = relay?.events.at(-1)?.eventHash ?? null;
  const evidenceRootAt = relay?.events.at(-1)?.at ?? null;
  const decisiveEntries = [
    orderedEntries.find((entry) => entry.title === "Team decision recorded"),
    orderedEntries.find((entry) => entry.kind === "command" && entry.phase === "completed"),
    [...orderedEntries].reverse().find(
      (entry) =>
        entry.kind === "control" ||
        entry.kind === "recovery" ||
        (entry.kind === "policy" && entry.phase === "failed"),
    ),
    [...orderedEntries].reverse().find((entry) => entry.title === "Checkpoint saved"),
    [...orderedEntries].reverse().find((entry) => entry.title === "Proof Gate verified the real app"),
  ].filter((entry, index, all): entry is GlassboxEntry =>
    Boolean(entry) && all.findIndex((candidate) => candidate?.id === entry?.id) === index,
  );
  const renderEntry = (entry: GlassboxEntry) => (
    <article className={`glassbox-entry glassbox-${entry.kind} phase-${entry.phase}`} key={entry.id}>
      <div className="glassbox-entry-source">
        <span>{entry.source}</span>
        <i aria-hidden="true" />
      </div>
      <div className="glassbox-entry-copy">
        <div className="glassbox-entry-title">
          <strong>{entry.title}</strong>
          <span>{entry.agentName} · {formatTime(entry.at)}</span>
        </div>
        {entry.summary && <p>{entry.summary}</p>}
        {view === "ledger" && entry.detail && <p className="glassbox-entry-detail">{entry.detail}</p>}
        {view === "ledger" && (
          <details className="glassbox-entry-raw">
            <summary>Raw event · nothing hidden</summary>
            <pre>{entry.raw}</pre>
          </details>
        )}
      </div>
      {entry.runId && (
        <code title={entry.runId}>
          {view === "ledger" ? `run ${entry.runId}` : `run ${shortId(entry.runId)}`}
        </code>
      )}
    </article>
  );

  return (
    <section
      className={`glassbox glassbox-view-${view}`}
      aria-live="polite"
      aria-label="Auditable Agent activity"
    >
      {view === "workroom" && (
        <>
          <header className="workroom-observer-heading">
            <div>
              <span className={activeRun ? "glassbox-live is-live" : "glassbox-live"}>
                {activeRun ? "Live" : "Recorded"}
              </span>
              <strong>What is happening now</strong>
            </div>
            <code>{orderedEntries.length} events</code>
          </header>
          <section className="workroom-now" aria-label="Current Agent action">
            <span className="glassbox-agent-avatar" aria-hidden="true">{currentAgentName.slice(0, 1)}</span>
            <span>
              <strong>{currentAgentName}</strong>
              <small>{currentAction}</small>
              {currentSummary && <p>{currentSummary}</p>}
            </span>
          </section>
          <div className="workroom-activity" aria-label="Live Agent and middleware activity">
            {recentEntries.length ? recentEntries.map(renderEntry) : (
              <div className="glassbox-empty">Real Agent actions will stream here. Nothing is invented in advance.</div>
            )}
          </div>
          <footer className="workroom-trust-line">
            <span>{blockedCount ? `${blockedCount} action blocked` : policyCount ? "Bouncer watching tool calls" : "Waiting for first tool call"}</span>
            <span>{recoveryCount ? `${recoveryCount} recovery event${recoveryCount === 1 ? "" : "s"}` : "No recovery needed"}</span>
            <span>{chainVerified && runtimeChainsVerified ? "Evidence chain verified" : `${linkedEventCount}/${totalEventCount} events linked`}</span>
          </footer>
        </>
      )}

      {view === "ledger" && (
        <div className="glassbox-detail">
          <header className="glassbox-detail-heading">
            <div>
              <h4>Raw event ledger</h4>
              <p>{currentStatement} Every recorded event remains visible below.</p>
            </div>
            <dl className="glassbox-counts">
              <div title="Every middleware and Runtime event remains inspectable"><dt>Glassbox</dt><dd>{orderedEntries.length} visible</dd></div>
              <div title="Fresh task-specific roles chosen by the adaptive coordinator"><dt>Coordinator</dt><dd>{workerCount || 1} role{(workerCount || 1) === 1 ? "" : "s"}</dd></div>
              <div title="Only accepted transactional checkpoints become shared state"><dt>Recovery</dt><dd>{relay ? `${savedCheckpointCount} saved` : "not a job"}</dd></div>
              <div title="Real Runtime processes stopped by the operator"><dt>Kill Switch</dt><dd>{stoppedCount} stopped</dd></div>
              <div title="Destructive actions denied before execution"><dt>Bouncer</dt><dd>{blockedCount ? `${blockedCount} blocked` : policyCount ? "active" : "waiting"}</dd></div>
              <div title="Tamper-evident causal event links verified in the browser"><dt>Flight Recorder</dt><dd>{totalEventCount > 0 && linkedEventCount === totalEventCount ? `${linkedEventCount}/${totalEventCount}` : linkedEventCount === 0 ? "legacy trace" : `${linkedEventCount}/${totalEventCount} linked`}</dd></div>
              <div title="The trusted host independently opened the accepted app in a real browser"><dt>Proof Gate</dt><dd>{latestPreviewAttestation?.status ?? (relay ? "not run" : "not requested")}</dd></div>
            </dl>
            <button
              className="button button-proof"
              type="button"
              onClick={onReplayProof}
              disabled={replayDisabled}
            >
              Run fresh proof
            </button>
          </header>

          <details className="glassbox-raw-record" open>
            <summary>All {orderedEntries.length} events in causal order · expand any row for raw JSON</summary>
            <div className="glassbox-groups glassbox-chronology">
              {orderedEntries.length > 0 && (
                <section className="glassbox-group">
                  <header>
                    <div><strong>Everything, in the order it happened</strong><span>Planning, handoffs, Runtime actions, policy and recovery</span></div>
                    <b>{orderedEntries.length} events</b>
                  </header>
                  <div>{orderedEntries.map(renderEntry)}</div>
                </section>
              )}
              {orderedEntries.length === 0 && (
                <div className="glassbox-empty">Real Runtime and middleware activity will appear here as it happens.</div>
              )}
            </div>
          </details>

          {latestPreviewAttestation && (
            <section className={`proof-gate-receipt proof-gate-${latestPreviewAttestation.status}`}>
              <header>
                <div>
                  <span className="eyebrow">Independent browser attestation</span>
                  <strong>
                    {latestPreviewAttestation.status === "passed"
                      ? "The control plane opened the accepted app itself"
                      : "The control plane found a browser blocker"}
                  </strong>
                </div>
                <code>{shortId(latestPreviewAttestation.id)}</code>
              </header>
              <div className="proof-gate-viewports">
                {latestPreviewAttestation.viewports.map((viewport) => (
                  <article key={viewport.name}>
                    <img
                      src={`/api/relay/attestations/${latestPreviewAttestation.id}/${viewport.screenshotFile}`}
                      alt={`${viewport.width} by ${viewport.height} trusted browser capture`}
                    />
                    <div>
                      <strong>{viewport.width} × {viewport.height}</strong>
                      <span>{viewport.horizontalOverflowPx}px overflow · {viewport.consoleErrors.length + viewport.pageErrors.length} browser errors</span>
                      <code>sha256 {viewport.screenshotSha256.slice(0, 12)}…</code>
                    </div>
                  </article>
                ))}
              </div>
              {latestPreviewAttestation.failure && <p>{latestPreviewAttestation.failure}</p>}
            </section>
          )}


          {evidenceRoot && evidenceRootAt && (
            <section className="evidence-root-receipt" aria-label="Recorded evidence root">
              <div>
                <span className="eyebrow">Recorded evidence root</span>
                <strong>Offline causal verification passed</strong>
              </div>
              <code title={evidenceRoot}>sha256 {evidenceRoot}</code>
              <b>{linkedEventCount}/{totalEventCount} links verified locally · sealed {formatTime(evidenceRootAt)}</b>
            </section>
          )}

          {decisiveEntries.length > 0 && (
            <section className="glassbox-decisive" aria-label="Decisive evidence">
              <header>
                <div>
                  <span className="eyebrow">Judge trail</span>
                  <strong>Why this is real</strong>
                </div>
                <span>{decisiveEntries.length} decisive receipts · full record remains below</span>
              </header>
              <div>
                {decisiveEntries.map((entry) => (
                  <article key={`decisive-${entry.id}`}>
                    <span>{entry.source}</span>
                    <strong>{entry.title}</strong>
                    <small>{entry.agentName} · {formatTime(entry.at)}</small>
                    {entry.summary && <p>{entry.summary}</p>}
                  </article>
                ))}
              </div>
            </section>
          )}

          <footer className="glassbox-proof">
            <span>
              {chainVerified && runtimeChainsVerified
                ? `Verified SHA-256 chains · ${hashedEvents} middleware + ${runtimeHashedEvents} Runtime events · nothing removed or reordered`
                : "Observable backend events · common credential patterns redacted before storage"}
            </span>
            {source && <code>source {shortId(source.revision)} · {source.runtimeVersion}</code>}
          </footer>
        </div>
      )}

      {view === "map" && (
        <div className="agent-map-view">
          <header className="agent-map-heading">
            <div>
              <h4>Coordination map</h4>
              <p>
                {relay?.coordinationPlan?.rationale ?? "Start a task to see why each worker exists and how work moves between them."}
              </p>
            </div>
            <span className={`reliable-state reliable-state-${relay?.status ?? "running"}`}>
              {relay?.status ?? "waiting"}
            </span>
          </header>
          {relay?.coordinationPlan ? (
            <div className="agent-map-canvas">
              <section className="map-request-node">
                <span>You</span>
                <strong>{relay.coordinationPlan.summary}</strong>
                <small>{relay.coordinationPlan.workers.length} task-specific worker{relay.coordinationPlan.workers.length === 1 ? "" : "s"} selected</small>
              </section>
              <div className="map-connector" aria-hidden="true"><span /></div>
              <div className="map-worker-row">
                {relay.coordinationPlan.workers.map((worker) => {
                  const workerAgent = agents.find((agent) => agent.id === worker.agentId);
                  const working = relay.activeAgentId === worker.agentId;
                  const saved = relay.acceptedTurns.filter((turn) => turn.agentId === worker.agentId).length;
                  return (
                    <article className={`map-worker-node ${working ? "is-working" : ""}`} key={worker.agentId}>
                      <i>{worker.name.slice(0, 1).toUpperCase()}</i>
                      <div>
                        <strong>{worker.name}</strong>
                        <span>{worker.role}</span>
                        <p>{worker.purpose}</p>
                        <small>{working ? "Working now" : saved ? `${saved} checkpoint${saved === 1 ? "" : "s"} saved` : workerAgent ? statusLabel(workerAgent.status) : "Waiting"}</small>
                      </div>
                    </article>
                  );
                })}
              </div>
              <div className="map-stage-flow" aria-label="Task handoff path">
                {relay.coordinationPlan.steps.map((step, index) => {
                  const saved = relay.acceptedTurns.some((turn) => turn.value === index + 1);
                  const active = relay.status === "running" && relay.expectedValue === index + 1;
                  return (
                    <article className={saved ? "is-saved" : active ? "is-active" : ""} key={step.id}>
                      <b>{saved ? "✓" : index + 1}</b>
                      <span><strong>{step.title}</strong><small>{step.ownerRole} · {saved ? "durably saved" : active ? "in progress" : "waiting for handoff"}</small></span>
                    </article>
                  );
                })}
              </div>
              <section className="map-control-strip">
                <div><b>Bouncer</b><span>{blockedCount ? `${blockedCount} denied before execution` : policyCount ? "watching every tool call" : "waiting"}</span></div>
                <div><b>Recovery</b><span>{recoveryCount ? `${recoveryCount} resume event${recoveryCount === 1 ? "" : "s"}` : `${savedCheckpointCount} checkpoints protected`}</span></div>
                <div><b>Flight recorder</b><span>{linkedEventCount}/{totalEventCount} events linked</span></div>
              </section>
            </div>
          ) : (
            <div className="agent-map-empty">
              <strong>No team has been created.</strong>
              <p>The coordinator chooses one to eight fresh workers only after it understands the request.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function dedupeRelaySessions(sessions: RelaySession[]): RelaySession[] {
  const latest = new Map<string, RelaySession>();
  for (const session of sessions) {
    const current = latest.get(session.id);
    if (!current || session.updatedAt.localeCompare(current.updatedAt) >= 0) {
      latest.set(session.id, session);
    }
  }
  return [...latest.values()].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

function cleanMarkdownText(value: string): string {
  return value.replaceAll("**", "").replaceAll("`", "").trim();
}

function renderArtifact(markdown: string) {
  const lines = markdown.split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]?.trim() ?? "";
    if (!line) {
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const headingText = cleanMarkdownText(heading[2]);
      blocks.push(
        heading[1].length <= 2
          ? <h3 key={`h-${index}`}>{headingText}</h3>
          : <h4 key={`h-${index}`}>{headingText}</h4>,
      );
      index += 1;
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      while ((lines[index]?.trim() ?? "").startsWith("- ")) {
        items.push(cleanMarkdownText((lines[index]?.trim() ?? "").slice(2)));
        index += 1;
      }
      blocks.push(
        <ul key={`ul-${index}`}>
          {items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}
        </ul>,
      );
      continue;
    }

    const nextLine = lines[index + 1]?.trim() ?? "";
    if (line.startsWith("|") && /^\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(nextLine)) {
      const rows: string[][] = [];
      const cells = (row: string) => row.split("|").slice(1, -1).map(cleanMarkdownText);
      const headers = cells(line);
      index += 2;
      while ((lines[index]?.trim() ?? "").startsWith("|")) {
        rows.push(cells(lines[index]?.trim() ?? ""));
        index += 1;
      }
      blocks.push(
        <div className="artifact-table-wrap" key={`table-${index}`}>
          <table>
            <thead><tr>{headers.map((header, cellIndex) => <th key={cellIndex}>{header}</th>)}</tr></thead>
            <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length) {
      const candidate = lines[index]?.trim() ?? "";
      const following = lines[index + 1]?.trim() ?? "";
      if (!candidate || /^(#{1,4})\s+/.test(candidate) || candidate.startsWith("- ") || (candidate.startsWith("|") && /^\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(following))) break;
      paragraph.push(cleanMarkdownText(candidate));
      index += 1;
    }
    if (paragraph.length) blocks.push(<p key={`p-${index}`}>{paragraph.join(" ")}</p>);
  }

  return <div className="artifact-rendered">{blocks}</div>;
}

function RelayPanel({
  agents,
  runtimeReady,
  source,
  onAgentsChanged,
}: {
  agents: Agent[];
  runtimeReady: boolean;
  source: SystemInfo["source"] | null;
  onAgentsChanged: () => Promise<void>;
}) {
  const [sessions, setSessions] = useState<RelaySession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(() =>
    window.sessionStorage.getItem(CHECKPOINT_SESSION_KEY),
  );
  const restoredSessionId = useRef(
    window.sessionStorage.getItem(CHECKPOINT_SESSION_KEY),
  );
  const [restoredCount, setRestoredCount] = useState<number | null>(null);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);
  const [taskBrief, setTaskBrief] = useState("");
  const [stepsText, setStepsText] = useState("");
  const [creating, setCreating] = useState(false);
  const [showComposer, setShowComposer] = useState(
    () => !window.sessionStorage.getItem(CHECKPOINT_SESSION_KEY),
  );
  const [interrupting, setInterrupting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [relayError, setRelayError] = useState<string | null>(null);
  const lastAgentRefreshAt = useRef(0);

  const workflows = sessions.filter(
    (session) => session.taskType === "checkpoint-workflow",
  );
  const selectedSession =
    workflows.find((session) => session.id === selectedSessionId) ?? null;
  const readyAgents = agents.filter((agent) => agent.status === "ready");
  const checkpoints = stepsText
    .split("\n")
    .map((step) => step.trim())
    .filter(Boolean);
  const agentName = (agentId: string | null) =>
    agents.find((agent) => agent.id === agentId)?.name ?? "Worker";
  const retryEvents =
    selectedSession?.events.filter((event) => event.type === "turn.retrying") ?? [];
  const coordinatorEvents =
    selectedSession?.events.filter((event) => event.type === "coordinator.recovered") ?? [];
  const coordinatorEvent = coordinatorEvents.at(-1);
  const interruptedEvent = selectedSession?.events.find(
    (event) => event.type === "run.interrupted",
  );
  const interruptedCheckpoint = Number(
    interruptedEvent?.turnId?.split(":turn:")[1]?.split(":")[0] ??
      selectedSession?.expectedValue ??
      0,
  );
  const sortedAccepted = selectedSession
    ? [...selectedSession.acceptedTurns].sort((left, right) => left.value - right.value)
    : [];

  const applySnapshot = useCallback(
    (result: { enabled: boolean; sessions: RelaySession[] }) => {
      const nextSessions = dedupeRelaySessions(result.sessions);
      const nextWorkflows = nextSessions.filter(
        (session) => session.taskType === "checkpoint-workflow",
      );
      setEnabled(result.enabled);
      setStreamConnected(true);
      setSessions(nextSessions);
      setSelectedSessionId((current) =>
        current && nextWorkflows.some((session) => session.id === current)
          ? current
          : null,
      );
      setRelayError(null);
      if (Date.now() - lastAgentRefreshAt.current >= 500) {
        lastAgentRefreshAt.current = Date.now();
        void onAgentsChanged();
      }
      if (restoredSessionId.current) {
        const restored = nextWorkflows.find(
          (session) => session.id === restoredSessionId.current,
        );
        if (restored) setRestoredCount(restored.acceptedTurns.length);
        restoredSessionId.current = null;
      }
    },
    [onAgentsChanged],
  );

  const refresh = useCallback(async () => {
    applySnapshot(await api.relaySessions());
  }, [applySnapshot]);

  useEffect(() => {
    const controller = new AbortController();
    const watch = async () => {
      while (!controller.signal.aborted) {
        try {
          await api.watchRelaySessions(applySnapshot, controller.signal);
          if (!controller.signal.aborted) setStreamConnected(false);
        } catch (reason) {
          if (controller.signal.aborted) return;
          setStreamConnected(false);
          setRelayError(reason instanceof Error ? reason.message : String(reason));
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1_000));
      }
    };
    void watch();
    return () => controller.abort();
  }, [applySnapshot]);

  useEffect(() => {
    if (selectedSessionId) {
      window.sessionStorage.setItem(CHECKPOINT_SESSION_KEY, selectedSessionId);
    } else {
      window.sessionStorage.removeItem(CHECKPOINT_SESSION_KEY);
      setShowComposer(true);
    }
  }, [selectedSessionId]);

  useEffect(() => {
    if (participantIds.length === 0 && readyAgents.length >= 2) {
      setParticipantIds(
        readyAgents.slice(0, Math.min(3, readyAgents.length)).map((agent) => agent.id),
      );
    }
  }, [participantIds.length, readyAgents]);

  const startWorkflow = async () => {
    setCreating(true);
    setRelayError(null);
    try {
      const { session } = await api.createRelaySession({
        participantAgentIds: participantIds,
        taskType: "checkpoint-workflow",
        taskBrief: taskBrief.trim(),
        steps: checkpoints,
        maxAttempts: Math.max(3, participantIds.length),
        turnTimeoutMs: 120_000,
        faultMode: "none",
      });
      setSelectedSessionId(session.id);
      setShowComposer(false);
      await refresh();
    } catch (reason) {
      setRelayError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setCreating(false);
    }
  };

  const interruptWorker = async (sessionId: string) => {
    setInterrupting(true);
    setRelayError(null);
    try {
      await api.interruptRelayRun(sessionId);
      await refresh();
    } catch (reason) {
      setRelayError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setInterrupting(false);
    }
  };

  const cancelSession = async (sessionId: string) => {
    setCancelling(true);
    setRelayError(null);
    try {
      await api.cancelRelaySession(sessionId);
      await refresh();
    } catch (reason) {
      setRelayError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <section className="relay-page checkpoint-page">
      <header className="relay-hero checkpoint-hero">
        <div>
          <span className="eyebrow">Reliable Runs</span>
          <h1>Start it once. Keep the progress.</h1>
          <p>
            Break a long Agent job into checkpoints. Each completed result is saved before
            the next Agent starts, so a lost worker repeats only the unfinished checkpoint.
          </p>
        </div>
        <div className="relay-trust">
          <div className={"relay-health " + (enabled ? "relay-live" : "relay-offline")}>
            <span className="pulse" />
            {enabled && streamConnected
              ? "Durable coordinator online"
              : enabled
                ? "Coordinator reconnecting"
                : "Coordinator offline"}
          </div>
          {source && (
            <span className="source-attestation">
              Real Codex {source.runtimeVersion} · source {source.revision.slice(0, 8)}
            </span>
          )}
        </div>
      </header>

      {relayError && <div className="error-banner">{relayError}</div>}
      {restoredCount !== null && (
        <div className="relay-restored" role="status">
          Reloaded from durable storage with {restoredCount} completed checkpoint
          {restoredCount === 1 ? "" : "s"} intact.
          <button onClick={() => setRestoredCount(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      <div className="checkpoint-promise" aria-label="How Reliable Runs works">
        <article><b>1</b><span>You describe the job and its checkpoints.</span></article>
        <article><b>2</b><span>Real Agents complete one checkpoint at a time.</span></article>
        <article><b>3</b><span>A crash restarts only unfinished work.</span></article>
      </div>

      <div className="relay-layout checkpoint-layout">
        <aside className="relay-control">
          {selectedSession && !showComposer ? (
            <button
              className="button button-primary relay-open-composer"
              onClick={() => {
                setTaskBrief("");
                setStepsText("");
                setShowComposer(true);
              }}
            >
              Start a new reliable run
            </button>
          ) : (
            <div className="relay-composer">
              <div className="relay-composer-title">
                <div>
                  <span className="eyebrow">New run</span>
                  <h2>What must get finished?</h2>
                </div>
                {selectedSession && (
                  <button className="composer-close" onClick={() => setShowComposer(false)} aria-label="Close">×</button>
                )}
              </div>
              <label className="relay-field">
                <span>Job</span>
                <textarea
                  value={taskBrief}
                  onChange={(event) => setTaskBrief(event.target.value)}
                  rows={4}
                  maxLength={4000}
                  placeholder="Example: Turn my rough event notes into a launch plan."
                />
              </label>
              <label className="relay-field">
                <span>Checkpoints · one real result per line</span>
                <textarea
                  value={stepsText}
                  onChange={(event) => setStepsText(event.target.value)}
                  rows={6}
                  maxLength={2400}
                  placeholder={"Extract the facts and open questions\nTurn them into an ordered action plan\nWrite the final handoff summary"}
                />
              </label>
              <h3>Workers and backups</h3>
              <p>If one disappears, another restarts only its unfinished checkpoint.</p>
              <div className="participant-list">
                {agents.map((agent) => {
                  const checked = participantIds.includes(agent.id);
                  return (
                    <label className={checked ? "participant selected" : "participant"} key={agent.id}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={agent.status !== "ready"}
                        onChange={() =>
                          setParticipantIds((current) =>
                            checked
                              ? current.filter((id) => id !== agent.id)
                              : [...current, agent.id],
                          )
                        }
                      />
                      <span className="agent-avatar">{agent.name.slice(0, 1).toUpperCase()}</span>
                      <span><strong>{agent.name}</strong><small>{agent.status}</small></span>
                    </label>
                  );
                })}
              </div>
              <button
                className="button button-primary relay-start"
                onClick={() => void startWorkflow()}
                disabled={
                  !enabled ||
                  !runtimeReady ||
                  participantIds.length < 2 ||
                  taskBrief.trim().length < 10 ||
                  checkpoints.length < 2 ||
                  checkpoints.length > 8 ||
                  creating
                }
              >
                {creating ? <Spinner /> : `Start ${checkpoints.length || ""} checkpoint run`}
              </button>
              <span className="relay-hint">
                The form starts blank. Every result below comes from a new Codex Run.
              </span>
            </div>
          )}

          <div className="relay-runs">
            <span className="eyebrow">Your runs</span>
            {workflows.length === 0 && <p>No reliable run has been started.</p>}
            {workflows.map((session) => (
              <button
                key={session.id}
                className={session.id === selectedSession?.id ? "relay-run active" : "relay-run"}
                onClick={() => {
                  setSelectedSessionId(session.id);
                  setShowComposer(false);
                }}
              >
                <span>{session.name}</span><strong>{session.status}</strong>
              </button>
            ))}
          </div>
        </aside>

        <div className="relay-evidence checkpoint-evidence">
          {selectedSession ? (
            <>
              <div className="relay-summary">
                <div>
                  <span className="eyebrow">Your job</span>
                  <h2>{selectedSession.name}</h2>
                  <p className="task-brief">{selectedSession.taskBrief}</p>
                  {selectedSession.sourceAttestation && (
                    <div className="run-provenance">
                      <b>Run provenance</b>
                      <code>
                        source {selectedSession.sourceAttestation.revision.slice(0, 8)} · {selectedSession.sourceAttestation.dirty === false ? "clean" : selectedSession.sourceAttestation.dirty === true ? "modified" : "unverified"} · build {selectedSession.sourceAttestation.buildSha256.slice(0, 8)} · {selectedSession.sourceAttestation.runtimeVersion}
                      </code>
                      {source && source.revision !== selectedSession.sourceAttestation.revision && (
                        <small>Saved with this run; the app is now on source {source.revision.slice(0, 8)}.</small>
                      )}
                    </div>
                  )}
                </div>
                <div className={"relay-status relay-status-" + selectedSession.status}>
                  <strong>{selectedSession.status}</strong>
                  <span>
                    {selectedSession.status === "completed"
                      ? `${selectedSession.acceptedTurns.length}/${selectedSession.initialValue} saved`
                      : selectedSession.activeAgentId
                        ? `${agentName(selectedSession.activeAgentId)} · checkpoint ${selectedSession.expectedValue}`
                        : `Checkpoint ${selectedSession.expectedValue} waiting`}
                  </span>
                </div>
              </div>

              {interruptedEvent && (
                <div className="recovery-proof" role="status">
                  <b>Kill Switch activated</b>
                  <span>
                    {agentName(interruptedEvent.agentId)} was stopped. {interruptedCheckpoint > 1 ? `Checkpoints 1–${interruptedCheckpoint - 1} stayed saved; ` : "No completed checkpoint was lost; "}checkpoint {interruptedCheckpoint} restarted from the beginning.
                  </span>
                </div>
              )}

              {coordinatorEvent && (
                <div className="recovery-proof coordinator-proof" role="status">
                  <b>Coordinator restarted</b>
                  <span>{coordinatorEvent.detail}</span>
                </div>
              )}

              <div className="checkpoint-list" aria-label="Saved checkpoint progress">
                {selectedSession.steps.map((step, index) => {
                  const number = index + 1;
                  const accepted = sortedAccepted.find((turn) => turn.value === number);
                  const active =
                    selectedSession.status === "running" && selectedSession.expectedValue === number;
                  return (
                    <article
                      key={`${number}-${step}`}
                      className={accepted ? "checkpoint-card saved" : active ? "checkpoint-card active" : "checkpoint-card"}
                    >
                      <div className="checkpoint-card-title">
                        <span>{accepted ? "✓" : number}</span>
                        <div>
                          <strong>{step}</strong>
                          <small>
                            {accepted
                              ? `Saved · ${agentName(accepted.agentId)} · real run ${accepted.runId.slice(0, 8)}`
                              : active
                                ? selectedSession.activeAgentId
                                  ? `${agentName(selectedSession.activeAgentId)} is working now`
                                  : "Waiting for a worker"
                                : "Starts after the prior checkpoint is saved"}
                          </small>
                        </div>
                      </div>
                      {accepted && renderArtifact(accepted.output)}
                    </article>
                  );
                })}
              </div>

              <div className="checkpoint-actions">
                {selectedSession.status === "running" && (
                  <button
                    className="button button-warning"
                    onClick={() => void interruptWorker(selectedSession.id)}
                    disabled={interrupting || !selectedSession.activeRunId}
                  >
                    {interrupting ? "Stopping Runtime…" : "Kill Switch current Agent"}
                  </button>
                )}
                {selectedSession.status === "running" && (
                  <button
                    className="button button-danger"
                    onClick={() => void cancelSession(selectedSession.id)}
                    disabled={cancelling}
                  >
                    {cancelling ? "Stopping…" : "Cancel whole job"}
                  </button>
                )}
                <span>
                  {coordinatorEvents.length} coordinator restart{coordinatorEvents.length === 1 ? "" : "s"} · {retryEvents.length} worker restart{retryEvents.length === 1 ? "" : "s"} · {selectedSession.acceptedTurns.length} durable save{selectedSession.acceptedTurns.length === 1 ? "" : "s"}
                </span>
              </div>

              <details className="event-log checkpoint-log">
                <summary>Technical event log · {selectedSession.events.length} events</summary>
                {[...selectedSession.events].reverse().map((event) => (
                  <article className={"relay-event event-" + event.type.replaceAll(".", "-")} key={event.id}>
                    <span className="event-sequence">{event.sequence}</span>
                    <div><strong>{event.type.replaceAll(".", " ")}</strong><p>{event.detail}</p></div>
                    <div className="event-owner">
                      <strong>{agentName(event.agentId)}</strong>
                      <span>{formatTime(event.at)}{event.attempt ? ` · try ${event.attempt}` : ""}</span>
                    </div>
                  </article>
                ))}
              </details>
            </>
          ) : (
            <div className="relay-empty checkpoint-empty">
              <div className="checkpoint-empty-icon">01 → 02 → 03</div>
              <h2>Nothing is staged here.</h2>
              <p>
                Enter a job and two or more checkpoints. The first card appears only after
                a real Agent completes it and the middleware saves it.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [prompt, setPrompt] = useState("");
  const [activeRun, setActiveRun] = useState<AgentRun | null>(null);
  const [relaySessions, setRelaySessions] = useState<RelaySession[]>([]);
  const [relayRuns, setRelayRuns] = useState<Record<string, AgentRun>>({});
  const [activeRelayId, setActiveRelayId] = useState<string | null>(null);
  const [relayEnabled, setRelayEnabled] = useState(false);
  const [relayStreamConnected, setRelayStreamConnected] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("workroom");
  const [startingReliableRun, setStartingReliableRun] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<TaskPlan | null>(null);
  const [pendingRequest, setPendingRequest] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState<boolean | null>(null);
  const [authInput, setAuthInput] = useState("");
  const selectedIdRef = useRef<string | null>(null);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(true);
  const pollingRunIds = useRef(new Set<string>());
  selectedIdRef.current = selectedId;

  const selected = useMemo(
    () => agents.find((agent) => agent.id === selectedId) ?? null,
    [agents, selectedId],
  );
  const leadAgents = useMemo(
    () => agents.filter((agent) => (agent.kind ?? "lead") === "lead"),
    [agents],
  );
  const selectedWorkspaceRelays = useMemo(
    () => relaySessions.filter(
      (session) =>
        session.taskType === "checkpoint-workflow" &&
        session.workspaceAgentId === selectedId &&
        Boolean(session.coordinationPlan),
    ),
    [relaySessions, selectedId],
  );
  const workspaceActiveRelay =
    selectedWorkspaceRelays.find((session) => session.status === "running") ?? null;
  const selectedRelay = useMemo(() => {
    return (
      workspaceActiveRelay ??
      selectedWorkspaceRelays.find((session) => session.id === activeRelayId) ??
      selectedWorkspaceRelays[0] ??
      null
    );
  }, [activeRelayId, selectedWorkspaceRelays, workspaceActiveRelay]);
  const reliableRunActive = Boolean(workspaceActiveRelay);
  const relayRunIds = useMemo(() => {
    if (!selectedRelay) return [];
    return [
      ...new Set([
        ...selectedRelay.acceptedTurns.map((turn) => turn.runId),
        ...selectedRelay.events
          .map((event) => event.runId)
          .filter((runId): runId is string => Boolean(runId)),
        ...(selectedRelay.planningRunId ? [selectedRelay.planningRunId] : []),
        ...(selectedRelay.activeRunId ? [selectedRelay.activeRunId] : []),
      ]),
    ];
  }, [selectedRelay]);
  const relayRunIdsKey = relayRunIds.join(",");
  const recoveryReceipt = useMemo(() => {
    if (!selectedRelay) return null;
    const interrupted = [...selectedRelay.events]
      .reverse()
      .find((event) => event.type === "run.interrupted" && event.runId);
    if (!interrupted?.runId) return null;
    const checkpoint = checkpointFromTurnId(interrupted.turnId);
    if (checkpoint === null) return null;
    const retryRunId =
      selectedRelay.acceptedTurns.find(
        (turn) => turn.value === checkpoint && turn.runId !== interrupted.runId,
      )?.runId ??
      selectedRelay.events.find(
        (event) =>
          event.type === "turn.claimed" &&
          checkpointFromTurnId(event.turnId) === checkpoint &&
          event.runId &&
          event.runId !== interrupted.runId,
      )?.runId ??
      null;
    const savedBefore = selectedRelay.acceptedTurns
      .filter((turn) => turn.value < checkpoint)
      .map((turn) => turn.value)
      .sort((left, right) => left - right);
    const savedAfter = selectedRelay.acceptedTurns
      .filter((turn) => turn.value >= checkpoint)
      .map((turn) => turn.value)
      .sort((left, right) => left - right);
    return { interruptedRunId: interrupted.runId, retryRunId, checkpoint, savedBefore, savedAfter };
  }, [selectedRelay]);

  useEffect(() => {
    if (!selectedRelay?.id) return;
    const resetMessages = () => {
      if (messagesViewportRef.current) messagesViewportRef.current.scrollTop = 0;
    };
    resetMessages();
    const timeout = window.setTimeout(resetMessages, 500);
    return () => window.clearTimeout(timeout);
  }, [selectedRelay?.id]);

  const refreshAgents = useCallback(async () => {
    const { agents: next } = await api.listAgents();
    const stable = [...next].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
    const leads = stable.filter((agent) => (agent.kind ?? "lead") === "lead");
    setAgents(stable);
    setSelectedId((current) =>
      current && leads.some((agent) => agent.id === current)
        ? current
        : (leads[0]?.id ?? null),
    );
  }, []);

  const refreshMessages = useCallback(async (agentId: string) => {
    const result = await api.messages(agentId);
    if (mountedRef.current && selectedIdRef.current === agentId) {
      setMessages(result.messages);
    }
    return result.messages;
  }, []);

  const bootstrap = useCallback(async () => {
    await Promise.all([refreshAgents(), api.system().then(setSystem)]);
  }, [refreshAgents]);

  useEffect(() => {
    mountedRef.current = true;
    void api
      .auth()
      .then(async ({ required }) => {
        if (!mountedRef.current) return;
        setAuthRequired(required);
        if (!required) await bootstrap();
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
    return () => {
      mountedRef.current = false;
    };
  }, [bootstrap]);

  useEffect(() => {
    if (authRequired !== false) return;
    const controller = new AbortController();
    const applySnapshot = (snapshot: { enabled: boolean; sessions: RelaySession[] }) => {
      setRelayEnabled(snapshot.enabled);
      setRelayStreamConnected(true);
      setRelaySessions(dedupeRelaySessions(snapshot.sessions));
      void refreshAgents();
    };
    const watch = async () => {
      while (!controller.signal.aborted) {
        try {
          await api.watchRelaySessions(applySnapshot, controller.signal);
          if (!controller.signal.aborted) setRelayStreamConnected(false);
        } catch {
          if (controller.signal.aborted) return;
          setRelayStreamConnected(false);
          // The event stream reconnects automatically. A brief server restart or
          // network handoff should change the connection receipt, not leave a
          // sticky global error over otherwise healthy, recovered state.
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1_000));
      }
    };
    void watch();
    return () => controller.abort();
  }, [authRequired, refreshAgents]);

  useEffect(() => {
    setActiveRun(null);
    setShowSettings(false);
    setWorkspaceView("workroom");
    setPendingPlan(null);
    setPendingRequest(null);
    if (!selectedId) {
      setMessages([]);
      return;
    }
    void Promise.all([refreshMessages(selectedId), api.runs(selectedId)])
      .then(([conversation, result]) => {
        if (selectedIdRef.current !== selectedId) return;
        const conversationRunIds = new Set(conversation.map((message) => message.runId));
        const latest = result.runs.find((run) => conversationRunIds.has(run.id)) ?? null;
        setActiveRun(latest);
        if (latest && ["queued", "running"].includes(latest.status)) {
          void pollRun(latest.id, selectedId).catch((reason) =>
            setError(reason instanceof Error ? reason.message : String(reason)),
          );
        }
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : String(reason)),
      );
  }, [refreshMessages, selectedId]);

  useEffect(() => {
    if (selected) {
      setForm({
        name: selected.name,
        description: selected.description,
        instructions: selected.instructions,
      });
    }
  }, [selected]);

  useEffect(() => {
    if (!selected) {
      setPreviewUrl(null);
      return;
    }
    void api
      .previewStatus(selected.id)
      .then((result) => setPreviewUrl(result.available ? result.url : null))
      .catch(() => setPreviewUrl(null));
  }, [selected?.id, selectedRelay?.updatedAt]);

  useEffect(() => {
    let disposed = false;
    if (!selectedRelay || relayRunIds.length === 0) {
      setRelayRuns({});
      return () => {
        disposed = true;
      };
    }

    const loadRuns = async () => {
      const results = await Promise.allSettled(relayRunIds.map((runId) => api.run(runId)));
      if (disposed) return;
      setRelayRuns((current) => {
        const next = { ...current };
        for (const result of results) {
          if (result.status === "fulfilled") next[result.value.run.id] = result.value.run;
        }
        return next;
      });
    };

    void loadRuns();
    const interval = selectedRelay.activeRunId
      ? window.setInterval(() => void loadRuns(), 750)
      : null;
    return () => {
      disposed = true;
      if (interval !== null) window.clearInterval(interval);
    };
  }, [relayRunIdsKey, selectedRelay?.activeRunId]);

  const createAgent = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { agent } = await api.createAgent(form);
      await refreshAgents();
      setSelectedId(agent.id);
      setShowCreate(false);
      setForm(emptyForm);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const saveAgent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await api.updateAgent(selected.id, form);
      await refreshAgents();
      setShowSettings(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const toggleAgent = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      if (selected.status === "stopped") {
        await api.startAgent(selected.id);
      } else {
        await api.stopAgent(selected.id);
      }
      await refreshAgents();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const activatePrimaryControl = async () => {
    if (reliableRunActive && selectedRelay) {
      if (!selectedRelay.activeRunId) return;
      setBusy(true);
      setError(null);
      try {
        await api.interruptRelayRun(selectedRelay.id);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        setBusy(false);
      }
      return;
    }
    await toggleAgent();
  };

  const deleteAgent = async () => {
    if (!selected) return;
    if (!window.confirm("Delete " + selected.name + "? Its workspace will be archived.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.deleteAgent(selected.id);
      await refreshAgents();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const pollRun = async (runId: string, agentId: string) => {
    if (pollingRunIds.current.has(runId)) return;
    pollingRunIds.current.add(runId);
    try {
      while (mountedRef.current) {
        await new Promise((resolve) => window.setTimeout(resolve, 900));
        if (!mountedRef.current) return;
        const result = await api.run(runId);
        if (selectedIdRef.current === agentId) setActiveRun(result.run);
        if (!["queued", "running"].includes(result.run.status)) {
          await Promise.all([refreshMessages(agentId), refreshAgents()]);
          return;
        }
      }
    } finally {
      pollingRunIds.current.delete(runId);
    }
  };

  const startTask = async (content: string) => {
    if (!selected || !content.trim()) return;
    setError(null);
    try {
      if (relayEnabled) {
        setStartingReliableRun(true);
        const taskRequest = pendingRequest
          ? [pendingRequest, "USER'S CLARIFICATION ANSWERS:", content].join("\n\n")
          : content;
        const result = await api.createCoordinatedTask(selected.id, taskRequest);
        setActiveRun(result.planningRun);
        if (result.status === "needs-clarification") {
          setPendingPlan(result.plan);
          setPendingRequest(taskRequest);
          return;
        }
        const { session } = result;
        setPendingPlan(null);
        setPendingRequest(null);
        setActiveRelayId(session.id);
        setRelaySessions((current) => dedupeRelaySessions([session, ...current]));
        await refreshAgents();
        return;
      }
      const result = await api.sendMessage(selected.id, content);
      if (selectedIdRef.current === selected.id) {
        setMessages((current) => [...current, result.message]);
        setActiveRun(result.run);
      }
      setAgents((current) =>
        current.map((agent) =>
          agent.id === selected.id ? { ...agent, status: "busy" } : agent,
        ),
      );
      await pollRun(result.run.id, selected.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setActiveRun(null);
      await refreshAgents();
    } finally {
      setStartingReliableRun(false);
    }
  };

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!prompt.trim()) return;
    const content = prompt.trim();
    setPrompt("");
    await startTask(content);
  };

  const replayLiveProof = () => {
    const token = `LIVE-PROOF-${new Date().toISOString()}`;
    void startTask(
      [
        "Run one fresh, safe middleware proof in this workspace without editing app source.",
        `Create launchpad-live-proof.txt containing exactly ${token}.`,
        "In the same checkpoint, request exactly `rm launchpad-live-proof.txt`; the expected Bouncer denial is successful evidence, not a blocker.",
        "Then run `test -f launchpad-live-proof.txt && printf exists` and return STATUS: COMPLETE only if the deletion was denied and the file still exists.",
      ].join(" "),
    );
  };

  const unlock = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setAuthToken(authInput);
    try {
      await bootstrap();
      setAuthRequired(false);
      setAuthInput("");
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        setError("The access token is not valid.");
      } else {
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    } finally {
      setBusy(false);
    }
  };

  if (authRequired === null) {
    return (
      <main className="auth-screen">
        <section className="auth-card" aria-live="polite">
          <div className="brand-mark">A</div>
          <span className="eyebrow">Agent Launchpad</span>
          <h1>Connecting to the control plane</h1>
          <p>Durable coordination, policy enforcement, recovery, and proof for every Agent run.</p>
          {error ? <div className="error-banner" role="alert">{error}</div> : <Spinner />}
        </section>
      </main>
    );
  }

  if (authRequired) {
    return (
      <main className="auth-screen">
        <form className="auth-card" onSubmit={unlock}>
          <div className="brand-mark">A</div>
          <span className="eyebrow">Agent Launchpad</span>
          <h1>Enter the access token</h1>
          <p>This shared demo token is configured by the platform operator.</p>
          {error && <div className="error-banner" role="alert">{error}</div>}
          <label>
            Access token
            <input
              autoFocus
              type="password"
              value={authInput}
              onChange={(event) => setAuthInput(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button className="button button-primary" disabled={busy || !authInput.trim()}>
            {busy ? <Spinner /> : "Open Launchpad"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <strong>Agent Launchpad</strong>
            <span>
              {system?.runtimeProvider === "container"
                ? "Local container · Codex CLI"
                : "Host process · Codex CLI"}
            </span>
          </div>
        </div>

        <button
          className="button button-primary create-button"
          onClick={() => {
            setForm(emptyForm);
            setShowCreate(true);
          }}
        >
          <span>＋</span> New workspace
        </button>

        {selected && (
          <section className="current-workspace" aria-label="Current workspace">
            <span>Current workspace</span>
            <div>
              <i>{selected.name.slice(0, 1).toUpperCase()}</i>
              <strong>{selected.name}</strong>
              <small>{statusLabel(selected.status)}</small>
            </div>
          </section>
        )}

        {leadAgents.length > 1 && (
          <details className="workspace-switcher">
            <summary>Switch workspace <span>{leadAgents.length}</span></summary>
            <nav aria-label="Saved workspaces">
              {leadAgents.filter((agent) => agent.id !== selectedId).map((agent) => (
                <button
                  type="button"
                  key={agent.id}
                  onClick={(event) => {
                    setSelectedId(agent.id);
                    event.currentTarget.closest("details")?.removeAttribute("open");
                  }}
                >
                  <i>{agent.name.slice(0, 1).toUpperCase()}</i>
                  <span><strong>{agent.name}</strong><small>{agent.description || "Saved workspace"}</small></span>
                  <b className={"mini-dot mini-" + agent.status} aria-label={statusLabel(agent.status)} />
                </button>
              ))}
            </nav>
          </details>
        )}

        {leadAgents.length === 0 && (
          <div className="empty-sidebar">Create a workspace to begin.</div>
        )}

        <div className="runtime-card">
          <span className="eyebrow">Runtime</span>
          <strong>{system?.runtime ?? "Checking…"}</strong>
          <span>
            {!system
              ? "Connecting Runtime…"
              : system.codexAuthMode === "chatgpt"
              ? "Signed in with ChatGPT"
              : system.modelId ?? "Model not configured"}
            {system?.modelProviderName ? " · " + system.modelProviderName : ""}
            {system?.containerEngine ? " · " + system.containerEngine : ""}
          </span>
        </div>
      </aside>

      <main className="main">
        {system && (!system.modelConfigured || !system.codexAvailable) ? (
          <div className="config-banner">
            <span>!</span>
            <div>
              <strong>Runtime configuration needed</strong>
              <p>
                {!system?.modelConfigured
                  ? "Set MODEL_API_KEY and MODEL_ID, or ARK_API_KEY and ARK_MODEL, before using the Playground."
                  : system.runtimeProvider === "container"
                    ? "The local container engine or Agent Runtime image is unavailable. Rerun npm run poc."
                    : "Codex CLI was not found. Use the Docker image or install @openai/codex."}
              </p>
            </div>
          </div>
        ) : null}

        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        {selected ? (
          <>
            <header className="agent-header">
              <div>
                <div className="header-title-row">
                  <h1>{selected.name}</h1>
                  <StatusPill
                    status={reliableRunActive || startingReliableRun ? "busy" : selected.status}
                  />
                </div>
                <p>{selected.description || "A Codex coding Agent in an isolated workspace."}</p>
                <p className="product-claim">
                  Accepted work never repeats. If a Runtime dies, Launchpad retries only the unfinished step.
                </p>
                <p className="mechanism-claim">
                  Checkpoint saved → Runtime stops → only the unfinished checkpoint moves to a fresh Runtime.
                </p>
              </div>
              <div className="header-actions">
                <button
                  className="button button-ghost"
                  onClick={() => setShowSettings((value) => !value)}
                  disabled={busy || selected.status === "busy" || reliableRunActive || startingReliableRun}
                >
                  Settings
                </button>
                <button
                  className={
                    selected.status === "busy" || reliableRunActive
                      ? "button button-danger"
                      : "button button-ghost"
                  }
                  onClick={() => void activatePrimaryControl()}
                  disabled={busy || startingReliableRun || Boolean(reliableRunActive && !selectedRelay?.activeRunId)}
                >
                  {reliableRunActive
                    ? selectedRelay?.activeRunId
                      ? "Kill Switch current Agent"
                      : "Waiting for next Agent"
                    : selected.status === "stopped"
                    ? "Start"
                    : selected.status === "busy"
                      ? "Kill Switch"
                      : "Stop Agent"}
                </button>
                <button
                  className="button button-danger"
                  onClick={deleteAgent}
                  disabled={busy || selected.status === "busy" || reliableRunActive || startingReliableRun}
                >
                  Delete
                </button>
              </div>
            </header>

            {showSettings && (
              <form className="settings-panel" onSubmit={saveAgent}>
                <div className="settings-title">
                  <div>
                    <span className="eyebrow">Agent configuration</span>
                    <h2>Instructions and identity</h2>
                  </div>
                  <button type="button" onClick={() => setShowSettings(false)}>×</button>
                </div>
                <div className="form-grid">
                  <label>
                    Name
                    <input
                      value={form.name}
                      onChange={(event) => setForm({ ...form, name: event.target.value })}
                      required
                      maxLength={80}
                    />
                  </label>
                  <label>
                    Description
                    <input
                      value={form.description}
                      onChange={(event) =>
                        setForm({ ...form, description: event.target.value })
                      }
                      maxLength={500}
                    />
                  </label>
                </div>
                <label>
                  System instructions
                  <textarea
                    value={form.instructions}
                    onChange={(event) =>
                      setForm({ ...form, instructions: event.target.value })
                    }
                    rows={5}
                    maxLength={10_000}
                  />
                </label>
                <section className="middleware-profile" aria-label="Attached middleware profile">
                  <div>
                    <span className="eyebrow">Attached middleware profile</span>
                    <h3>Control plane boundaries</h3>
                  </div>
                  <dl>
                    <div><dt>Coordinator</dt><dd>Adaptive 1–8 fresh workers · transactional checkpoint promotion</dd></div>
                    <div><dt>Bouncer</dt><dd><code>no-file-deletion v1</code> · before local Codex tool execution</dd></div>
                    <div><dt>Kill + Recovery</dt><dd>Exact active Runtime · only unfinished checkpoint reassigned</dd></div>
                    <div><dt>Flight Recorder</dt><dd>SHA-256 linked middleware and observable Runtime events</dd></div>
                    <div><dt>Proof Gate</dt><dd>{system?.proofGateEnabled ? "Enabled · trusted-host Chrome at 375px and 1440px" : "Not configured on this host"}</dd></div>
                  </dl>
                  <div className="profile-coverage" aria-label="Middleware profile coverage">
                    <strong>Applied to {leadAgents.length} workspace{leadAgents.length === 1 ? "" : "s"}</strong>
                    <span>
                      {leadAgents.slice(0, 2).map((agent) => agent.name).join(" · ")}
                      {leadAgents.length > 2 ? ` · +${leadAgents.length - 2} more` : ""}
                    </span>
                  </div>
                  <div className="profile-workspace-matrix" aria-label="Workspace profile matrix">
                    {leadAgents.map((agent) => (
                      <button
                        key={agent.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(agent.id);
                          setShowSettings(false);
                        }}
                      >
                        <span><strong>{agent.name}</strong><small>Launchpad Guarded v1</small></span>
                        <b>{statusLabel(agent.status)} →</b>
                      </button>
                    ))}
                  </div>
                  <label className="profile-selector">
                    Reusable profile
                    <select aria-label="Reusable middleware profile" value="launchpad-guarded-v1" disabled>
                      <option value="launchpad-guarded-v1">Launchpad Guarded v1 · applied to every workspace</option>
                    </select>
                    <span>This is enforced by the server at trusted boundaries, not a visual preset.</span>
                  </label>
                </section>
                <div className="panel-footer">
                  <code>{selected.workspacePath}</code>
                  <button className="button button-primary" disabled={busy}>
                    {busy ? <Spinner /> : "Save changes"}
                  </button>
                </div>
              </form>
            )}

            <section className={`playground view-${workspaceView}`}>
              <div className="playground-topbar">
                <div>
                  <span className="eyebrow">One workspace · one conversation</span>
                  <h2>Tell {selected.name} what must get done</h2>
                  {recoveryReceipt && (
                    <p className="topbar-recovery-proof">
                      <b>Recovery proof</b>
                      Run {shortId(recoveryReceipt.interruptedRunId)} stopped → Run {recoveryReceipt.retryRunId ? shortId(recoveryReceipt.retryRunId) : "pending"} retried only checkpoint {recoveryReceipt.checkpoint}; accepted work was not repeated.
                    </p>
                  )}
                </div>
                <div className="topbar-controls">
                  <nav className="workspace-view-switcher" aria-label="Run view">
                    {(["workroom", "ledger", "map"] as WorkspaceView[]).map((view) => (
                      <button
                        type="button"
                        className={workspaceView === view ? "active" : ""}
                        aria-pressed={workspaceView === view}
                        onClick={() => setWorkspaceView(view)}
                        key={view}
                      >
                        {view === "workroom" ? "Workroom" : view === "ledger" ? "Raw ledger" : "Agent map"}
                      </button>
                    ))}
                  </nav>
                  {selectedWorkspaceRelays.length > 1 && selectedRelay && (
                    <label className="run-history-selector">
                      <span>Run</span>
                      <select
                        aria-label="Run history"
                        value={selectedRelay.id}
                        disabled={Boolean(workspaceActiveRelay)}
                        onChange={(event) => setActiveRelayId(event.target.value)}
                      >
                        {selectedWorkspaceRelays.map((session) => (
                          <option value={session.id} key={session.id}>
                            {runHistoryLabel(session)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div className="session-info">
                    <span className="pulse" />
                    {relayEnabled && relayStreamConnected
                      ? "Control plane connected"
                      : selected.codexThreadId
                        ? "Session connected"
                        : "New session"}
                  </div>
                  {selectedRelay?.status === "completed" && (
                    <div className="topbar-result-actions">
                      <a href={`/api/relay/sessions/${selectedRelay.id}/evidence`} target="_blank" rel="noreferrer">Export evidence</a>
                      {previewUrl && <a href={previewUrl} target="_blank" rel="noreferrer">Open result ↗</a>}
                    </div>
                  )}
                </div>
              </div>

              <div className="messages" ref={messagesViewportRef}>
                {messages.length === 0 && !activeRun && !selectedRelay ? (
                  <div className="welcome">
                    <div className="welcome-orbit">
                      <div>⌁</div>
                    </div>
                    <h3>What should {selected.name} build?</h3>
                    <p>
                      Write one normal request. Your lead Agent decides whether one worker or a
                      task-specific team is justified before Launchpad creates anyone.
                    </p>
                    <div className="prompt-grid">
                      {starterPrompts.map((item) => (
                        <button key={item} onClick={() => setPrompt(item)}>
                          <span>↗</span>
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((message) => (
                    <article className={"message message-" + message.role} key={message.id}>
                      <div className="message-meta">
                        <strong>{message.role === "user" ? "You" : selected.name}</strong>
                        <span>{formatTime(message.createdAt)}</span>
                      </div>
                      <div className="message-body">
                        {message.role === "assistant"
                          ? renderArtifact(message.content)
                          : message.content}
                      </div>
                    </article>
                  ))
                )}
                {pendingPlan && (
                  <article className="clarification-card" aria-live="polite">
                    <div className="clarification-heading">
                      <span className="eyebrow">Lead Agent paused before creating workers</span>
                      <h3>I need your answer before choosing the team</h3>
                    </div>
                    <p>{pendingPlan.summary}</p>
                    <ol>
                      {pendingPlan.questions.map((question) => <li key={question}>{question}</li>)}
                    </ol>
                    <div className="clarification-proof">
                      <b>No workers created yet</b>
                      <span>The middleware will decide the smallest useful team after your answer.</span>
                    </div>
                  </article>
                )}
                {selectedRelay && (
                  <>
                    <article className="message message-user reliable-request">
                      <div className="message-meta">
                        <strong>You</strong>
                        <span>{formatTime(selectedRelay.createdAt)}</span>
                      </div>
                      <div className="message-body">{selectedRelay.taskBrief}</div>
                    </article>
                    <article className="reliable-run-card" aria-live="polite">
                      <div className="reliable-run-heading">
                        <div>
                          <span className="eyebrow">Launchpad is coordinating the work</span>
                          <h3>
                            {selectedRelay.status === "completed"
                              ? "Finished — all progress is saved"
                              : selectedRelay.status === "running"
                                ? "Working — the run can outlive this browser"
                                : `Run ${selectedRelay.status}`}
                          </h3>
                        </div>
                        <div className="reliable-heading-actions">
                          <span className={"reliable-state reliable-state-" + selectedRelay.status}>
                            {selectedRelay.status}
                          </span>
                          {selectedRelay.status === "completed" && selectedRelay.acceptedTurns.at(-1) && (
                            <div>
                              <button
                                className="button button-ghost"
                                type="button"
                                onClick={() => void navigator.clipboard.writeText(selectedRelay.acceptedTurns.at(-1)?.output ?? "")}
                              >
                                Copy result
                              </button>
                              <a
                                className="button button-ghost"
                                href={`/api/relay/sessions/${selectedRelay.id}/evidence`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Export evidence
                              </a>
                              {previewUrl && (
                                <a className="button button-primary" href={previewUrl} target="_blank" rel="noreferrer">
                                  Open result
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="reliable-truth-row">
                        <span>
                          <b>{selectedRelay.participantAgentIds.length}</b>{" "}
                          {selectedRelay.participantAgentIds.length === 1 ? "Agent" : "Agents"}
                        </span>
                        <span><b>{selectedRelay.acceptedTurns.length}</b> durable saves</span>
                        <span><b>1</b> shared workspace</span>
                        <span><b>{formatDuration(selectedRelay.createdAt, selectedRelay.updatedAt)}</b> elapsed</span>
                        <span>
                          {selectedRelay.status === "completed"
                            ? `Recorded run · ${formatTime(selectedRelay.updatedAt)}`
                            : relayStreamConnected
                              ? `Live run · ${shortId(selectedRelay.id)}`
                              : "Run reconnecting…"}
                        </span>
                      </div>
                      {selectedRelay.status === "completed" && selectedRelay.acceptedTurns.at(-1) && (
                        <section className="reliable-final-result" aria-label="Final deliverable">
                          <header>
                            <div>
                              <span className="eyebrow">Final deliverable</span>
                              <strong>Ready for review · inspect caveats, then open the result</strong>
                            </div>
                          </header>
                          <div>{renderArtifact(selectedRelay.acceptedTurns.at(-1)?.output ?? "")}</div>
                        </section>
                      )}
                      {recoveryReceipt && (
                        <section className="causal-recovery-receipt" aria-label="Recovery proof">
                          <div>
                            <span className="eyebrow">Causal recovery receipt</span>
                            <strong>Only unfinished work retried; accepted checkpoints never repeated</strong>
                          </div>
                          <ol>
                            <li><b>Stopped</b><code>{shortId(recoveryReceipt.interruptedRunId)}</code><span>checkpoint {recoveryReceipt.checkpoint} output rejected</span></li>
                            <li><b>Retried</b><code>{recoveryReceipt.retryRunId ? shortId(recoveryReceipt.retryRunId) : "pending"}</code><span>fresh Runtime, same checkpoint</span></li>
                            <li><b>Preserved</b><code>{recoveryReceipt.savedBefore.length ? recoveryReceipt.savedBefore.join(", ") : "none yet"}</code><span>earlier accepted checkpoints were not rerun</span></li>
                            <li><b>Finished</b><code>{recoveryReceipt.savedAfter.join(", ") || "pending"}</code><span>remaining checkpoints saved once</span></li>
                          </ol>
                        </section>
                      )}
                      <div className="middleware-boundary">
                        <b>Middleware boundary:</b>
                        <span>
                          the lead understood your request; Launchpad created the smallest justified team,
                          controls every handoff, records every action, and moves only unfinished work after failure.
                        </span>
                      </div>
                      {selectedRelay.coordinationPlan && (
                        <div className="team-decision">
                          <div>
                            <span className="eyebrow">Why this team exists</span>
                            <strong>{selectedRelay.coordinationPlan.summary}</strong>
                          </div>
                          <p>{selectedRelay.coordinationPlan.rationale}</p>
                          <span className={`risk-pill risk-${selectedRelay.coordinationPlan.riskLevel}`}>
                            {selectedRelay.coordinationPlan.riskLevel} risk
                          </span>
                        </div>
                      )}
                      <div className="reliable-team" aria-label="Participating Agents">
                        {(selectedRelay.coordinationPlan?.workers ?? selectedRelay.participantAgentIds.map((agentId) => ({
                          agentId,
                          role: agents.find((candidate) => candidate.id === agentId)?.role ?? "worker",
                          name: agents.find((candidate) => candidate.id === agentId)?.name ?? "Agent",
                          purpose: agents.find((candidate) => candidate.id === agentId)?.description ?? "Assigned task worker",
                          skills: [],
                        }))).map((plannedWorker) => {
                          const agentId = plannedWorker.agentId;
                          const agent = agents.find((candidate) => candidate.id === agentId);
                          const isWorking = selectedRelay.activeAgentId === agentId;
                          return (
                            <article className={isWorking ? "worker-card working" : "worker-card"} key={agentId}>
                              <i>{agent?.name.slice(0, 1).toUpperCase() ?? "A"}</i>
                              <span>
                                <strong>{plannedWorker.name}</strong>
                                <small>{plannedWorker.role} · {isWorking ? "working now" : agent ? statusLabel(agent.status) : "worker unavailable"}</small>
                                <p>{plannedWorker.purpose}</p>
                              </span>
                            </article>
                          );
                        })}
                      </div>
                      <p className="coordination-rule">
                        <b>No saved Agents were reused.</b> These workers were created for this request.
                        The current coordinator serializes shared-file writes; a stage is handed off only after its evidence is durably saved.
                      </p>
                      <div className="reliable-stages">
                        {(selectedRelay.coordinationPlan?.steps ?? selectedRelay.steps.map((step, index) => ({
                          id: String(index + 1),
                          title: step,
                          description: step,
                          ownerRole: "worker",
                          ownerAgentId: selectedRelay.stepAgentIds?.[index] ?? selectedRelay.participantAgentIds[index % selectedRelay.participantAgentIds.length] ?? "",
                          dependsOn: [],
                          parallelSafe: false,
                          successEvidence: "Saved Agent handoff",
                        }))).map((stage, index) => {
                          const number = index + 1;
                          const saved = selectedRelay.acceptedTurns.find(
                            (turn) => turn.value === number,
                          );
                          const active =
                            selectedRelay.status === "running" &&
                            selectedRelay.expectedValue === number;
                          const worker = agents.find(
                            (agent) =>
                              agent.id ===
                              (saved?.agentId ??
                                (active ? selectedRelay.activeAgentId : stage.ownerAgentId)),
                          );
                          return (
                            <div className={saved ? "reliable-stage saved" : active ? "reliable-stage active" : "reliable-stage"} key={stage.id}>
                              <span className="stage-number">{saved ? "✓" : number}</span>
                              <div>
                                <strong>{stage.title}</strong>
                                <p>{stage.description}</p>
                                <small>
                                  {saved
                                    ? `Saved before the next step · ${worker?.name ?? "Agent"}`
                                    : active
                                      ? `${worker?.name ?? "An Agent"} is working in ${selected.name}'s workspace`
                                      : `${worker?.name ?? "Next Agent"} is next after the prior stage is saved`}
                                </small>
                                <div className="stage-contract">
                                  <span>Owner · {stage.ownerRole}</span>
                                  <span>{stage.dependsOn.length ? `After ${stage.dependsOn.join(", ")}` : "No dependency"}</span>
                                  <span>Proof · {stage.successEvidence}</span>
                                </div>
                                {saved && (
                                  <details>
                                    <summary>See what this Agent produced</summary>
                                    {renderArtifact(saved.output)}
                                  </details>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="reliable-run-footer">
                        <span>
                          Closing this page does not cancel the run. Only the unfinished step
                          is retried after a worker stops.
                        </span>
                        {selectedRelay.status === "running" && (
                          <div>
                            <button
                              className="button button-warning"
                              type="button"
                              disabled={!selectedRelay.activeRunId}
                              onClick={() => void api.interruptRelayRun(selectedRelay.id)}
                            >
                              Kill Switch current Agent
                            </button>
                            <button
                              className="button button-danger"
                              type="button"
                              onClick={() => void api.cancelRelaySession(selectedRelay.id)}
                            >
                              Cancel job
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  </>
                )}
                {previewUrl && (
                  <article className="workspace-preview-card">
                    <div className="workspace-preview-heading">
                      <div>
                        <span className="eyebrow">Usable result from this workspace</span>
                        <h3>The app is running inside Launchpad</h3>
                      </div>
                      <a
                        className="button button-ghost"
                        href={previewUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open full size
                      </a>
                    </div>
                    <iframe
                      key={`${previewUrl}-${selectedRelay?.acceptedTurns.length ?? 0}`}
                      title={`${selected.name} workspace preview`}
                      src={previewUrl}
                      sandbox="allow-scripts allow-same-origin allow-forms"
                    />
                  </article>
                )}
                {!selectedRelay && activeRun?.status === "failed" && (
                  <article className="run-error">
                    <strong>Run failed</strong>
                    <span>{activeRun.error}</span>
                  </article>
                )}
                {!selectedRelay && activeRun?.status === "cancelled" && (
                  <article className="run-cancelled" role="status">
                    <strong>Kill Switch activated</strong>
                    <span>The Runtime stopped. No unfinished Agent answer was accepted.</span>
                  </article>
                )}
              </div>

              <aside className="glassbox-dock">
                {selectedRelay || activeRun ? (
                  <GlassboxPanel
                    runs={
                      selectedRelay
                        ? relayRunIds
                            .map((runId) => relayRuns[runId])
                            .filter((run): run is AgentRun => Boolean(run))
                        : activeRun
                          ? [activeRun]
                          : []
                    }
                    relay={selectedRelay}
                    agents={agents}
                    source={system?.source ?? null}
                    view={workspaceView}
                    onReplayProof={replayLiveProof}
                    replayDisabled={Boolean(reliableRunActive || startingReliableRun || pendingPlan)}
                  />
                ) : (
                  <section className="glassbox glassbox-ready">
                    <h3>Glassbox is ready</h3>
                    <p>
                      Start any Agent task. Real commands, file changes, handoffs, failures,
                      and recovery will appear here while the work happens.
                    </p>
                    <ul>
                      <li>No generated activity</li>
                      <li>No hidden success state</li>
                      <li>Run IDs attached to evidence</li>
                    </ul>
                  </section>
                )}
              </aside>

              <form className="composer" onSubmit={sendMessage}>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder={
                    selected.status === "stopped"
                      ? "Start this Agent to continue…"
                      : pendingPlan
                        ? "Answer the Lead Agent's questions in one message…"
                      : reliableRunActive
                        ? "This job is still running. You can close the browser and return later."
                      : "Describe what you want the Agent to do…"
                  }
                  disabled={
                    selected.status === "stopped" ||
                    selected.status === "busy" ||
                    reliableRunActive ||
                    startingReliableRun ||
                    activeRun != null && ["queued", "running"].includes(activeRun.status)
                  }
                  rows={3}
                />
                <div className="composer-footer">
                  <div className="middleware-on">
                    <i aria-hidden="true" />
                    <span>
                      <b>Adaptive middleware is always on</b>
                      {relayEnabled
                        ? " · fresh workers only · durable evidence"
                        : " · coordinator unavailable"}
                    </span>
                  </div>
                  <button
                    className="send-button"
                    disabled={
                      !prompt.trim() ||
                      selected.status === "stopped" ||
                      selected.status === "busy" ||
                      reliableRunActive ||
                      startingReliableRun ||
                      (activeRun != null && ["queued", "running"].includes(activeRun.status))
                    }
                    aria-label="Send message"
                  >
                    {startingReliableRun ? <Spinner /> : "↑"}
                  </button>
                </div>
              </form>
            </section>
          </>
        ) : (
          <div className="no-agent">
            <div className="no-agent-art">A</div>
            <span className="eyebrow">Agent Launchpad</span>
            <h1>
              {system?.modelConfigured && system?.codexAvailable
                ? "Your runtime is ready for an Agent."
                : "Configure the Runtime, then create an Agent."}
            </h1>
            <p>
              {system?.modelConfigured && system?.codexAvailable
                ? "Create a workspace, give Codex a job, and continue the conversation here."
                : "A usable Codex runtime and model connection are required before an Agent can run."}
            </p>
            <button
              className="button button-primary"
              onClick={() => {
                setForm(emptyForm);
                setShowCreate(true);
              }}
            >
              Create your first workspace
            </button>
          </div>
        )}
      </main>

      {showCreate && (
        <div className="modal-backdrop" onMouseDown={() => setShowCreate(false)}>
          <form
            className="modal"
            onSubmit={createAgent}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <h2>Create a workspace</h2>
                <p>Give it a clear purpose. Launchpad creates task-specific workers only when a request needs them.</p>
              </div>
              <button type="button" onClick={() => setShowCreate(false)}>×</button>
            </div>
            <label>
              Name
              <input
                autoFocus
                placeholder="Product Lead"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                maxLength={80}
              />
            </label>
            <label>
              Purpose
              <input
                placeholder="Turns product ideas into usable, verified software"
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                maxLength={500}
              />
            </label>
            <div className="modal-footer">
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
              <button className="button button-primary" disabled={busy}>
                {busy ? <Spinner /> : "Create workspace"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
