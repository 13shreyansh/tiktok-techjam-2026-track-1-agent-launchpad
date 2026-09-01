export type AgentStatus = "ready" | "busy" | "stopped" | "error";
export type RunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface Agent {
  id: string;
  name: string;
  description: string;
  instructions: string;
  status: AgentStatus;
  workspacePath: string;
  codexThreadId: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  kind?: "lead" | "worker";
  parentAgentId?: string | null;
  taskPlanId?: string | null;
  role?: string | null;
}

export interface Message {
  id: string;
  agentId: string;
  runId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface AgentRun {
  id: string;
  agentId: string;
  status: RunStatus;
  prompt: string;
  output: string | null;
  error: string | null;
  usage: {
    inputTokens?: number;
    cachedInputTokens?: number;
    outputTokens?: number;
  } | null;
  trace: Array<{
    id: string;
    sequence: number;
    kind: "runtime" | "policy" | "control" | "message" | "command" | "file" | "tool" | "web" | "error";
    phase: "started" | "completed" | "failed";
    title: string;
    summary: string | null;
    detail: string | null;
    exitCode: number | null;
    at: string;
    updatedAt: string;
    previousHash?: string;
    eventHash?: string;
  }>;
  workspaceTransaction?: {
    workspaceAgentId: string;
    status: "open" | "committed" | "discarded";
  };
  createdAt: string;
}

export interface SystemInfo {
  arkConfigured: boolean;
  arkBaseUrl: string;
  arkModel: string | null;
  modelConfigured: boolean;
  modelBaseUrl: string;
  modelId: string | null;
  modelProviderName: string;
  codexAuthMode: "provider-key" | "chatgpt";
  codexAvailable: boolean;
  codexSandboxMode: string;
  runtimeProvider: "local-process" | "container";
  containerEngine: string | null;
  runtime: string;
  proofGateEnabled: boolean;
  source: {
    revision: string;
    dirty: boolean | null;
    buildSha256: string;
    runtimeVersion: string;
  };
}

export type RelaySessionStatus = "running" | "completed" | "failed" | "cancelled";

export interface RelayEvent {
  id: string;
  sessionId: string;
  sequence: number;
  type:
    | "session.started"
    | "plan.created"
    | "worker.created"
    | "coordinator.recovered"
    | "policy.enforced"
    | "turn.assigned"
    | "turn.claimed"
    | "run.started"
    | "run.interrupt-requested"
    | "run.interrupted"
    | "run.interrupt-failed"
    | "run.cancelled"
    | "run.cancel-failed"
    | "workspace.opened"
    | "workspace.committed"
    | "workspace.discarded"
    | "preview.attested"
    | "preview.attestation-failed"
    | "fault.injected"
    | "checkpoint.saved"
    | "handoff.sent"
    | "artifact.saved"
    | "review.passed"
    | "review.revision-requested"
    | "turn.completed"
    | "turn.retrying"
    | "turn.duplicate-suppressed"
    | "turn.failed"
    | "session.completed"
    | "session.failed"
    | "session.cancelled";
  previousHash?: string;
  eventHash?: string;
  fromAgentId?: string | null;
  toAgentId?: string | null;
  at: string;
  turnId: string | null;
  agentId: string | null;
  runId?: string | null;
  attempt: number | null;
  detail: string;
}

export interface RelaySession {
  id: string;
  name: string;
  taskType: "countdown" | "ordered-sequence" | "team-task" | "checkpoint-workflow";
  faultMode: "none" | "fail-first-claim";
  status: RelaySessionStatus;
  participantAgentIds: string[];
  workspaceAgentId?: string;
  planningRunId?: string;
  coordinationPlan?: {
    id: string;
    summary: string;
    rationale: string;
    riskLevel: "low" | "medium" | "high";
    createdAt: string;
    workers: Array<TaskWorkerPlan & { agentId: string }>;
    steps: Array<TaskStepPlan & { ownerAgentId: string }>;
  };
  stepAgentIds?: string[];
  sourceAttestation?: SystemInfo["source"];
  previewAttestations?: Array<{
    id: string;
    checkedAt: string;
    status: "passed" | "failed";
    entryFile: string;
    browser: string;
    failure: string | null;
    viewports: Array<{
      name: "mobile-375" | "desktop-1440";
      width: number;
      height: number;
      bodyTextLength: number;
      headingCount: number;
      interactiveControlCount: number;
      horizontalOverflowPx: number;
      consoleErrors: string[];
      pageErrors: string[];
      screenshotFile: string;
      screenshotSha256: string;
    }>;
  }>;
  initialValue: number;
  expectedValue: number;
  steps: string[];
  taskBrief?: string;
  successCriteria?: string[];
  workStage?: "draft" | "review" | "revise" | null;
  artifact?: string | null;
  artifactVersion?: number;
  reviewVerdict?: "PASS" | "REVISE" | null;
  reviewFeedback?: string | null;
  reviewChecks?: Array<{ criterion: string; passed: boolean; evidence: string }>;
  maxRevisions?: number;
  maxAttempts: number;
  turnTimeoutMs: number;
  activeRunId?: string | null;
  activeAgentId?: string | null;
  operatorInterruptions?: Array<{
    runId: string;
    agentId: string;
    requestedAt: string;
    status: "requested" | "cancelled" | "failed";
    completedAt: string | null;
    error: string | null;
  }>;
  attemptsByValue: Record<string, number>;
  nextEventSequence: number;
  acceptedTurns: Array<{
    turnId: string;
    value: number;
    expectedOutput: string;
    agentId: string;
    runId: string;
    attempt: number;
    output: string;
    stage?: "draft" | "review" | "revise";
    verdict?: "PASS" | "REVISE";
    feedback?: string;
    checks?: Array<{ criterion: string; passed: boolean; evidence: string }>;
    completedAt: string;
  }>;
  events: RelayEvent[];
  failure: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface TaskWorkerPlan {
  role: string;
  name: string;
  purpose: string;
  skills: string[];
}

export interface TaskStepPlan {
  id: string;
  title: string;
  description: string;
  ownerRole: string;
  dependsOn: string[];
  parallelSafe: boolean;
  successEvidence: string;
}

export interface TaskPlan {
  id: string;
  request: string;
  summary: string;
  needsClarification: boolean;
  questions: string[];
  rationale: string;
  riskLevel: "low" | "medium" | "high";
  workers: TaskWorkerPlan[];
  steps: TaskStepPlan[];
  createdAt: string;
}
