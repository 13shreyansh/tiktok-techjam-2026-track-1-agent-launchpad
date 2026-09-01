export type RelaySessionStatus = "running" | "completed" | "failed" | "cancelled";
export type RelayFaultMode = "none" | "fail-first-claim";
export type RelayTaskType =
  | "countdown"
  | "ordered-sequence"
  | "team-task"
  | "checkpoint-workflow";
export type RelayWorkStage = "draft" | "review" | "revise";

export interface RelayReviewCheck {
  criterion: string;
  passed: boolean;
  evidence: string;
}

export interface RelayOperatorInterruption {
  runId: string;
  agentId: string;
  requestedAt: string;
  status: "requested" | "cancelled" | "failed";
  completedAt: string | null;
  error: string | null;
}

export interface RelaySourceAttestation {
  revision: string;
  dirty: boolean | null;
  buildSha256: string;
  runtimeVersion: string;
}

export interface RelayPreviewViewportAttestation {
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
}

export interface RelayPreviewAttestation {
  id: string;
  checkedAt: string;
  status: "passed" | "failed";
  entryFile: string;
  browser: string;
  viewports: RelayPreviewViewportAttestation[];
  failure: string | null;
}

export type RelayEventType =
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

export interface RelayEvent {
  id: string;
  sessionId: string;
  sequence: number;
  type: RelayEventType;
  at: string;
  turnId: string | null;
  agentId: string | null;
  runId?: string | null;
  attempt: number | null;
  detail: string;
  fromAgentId?: string | null;
  toAgentId?: string | null;
  previousHash?: string;
  eventHash?: string;
}

export interface RelayTurn {
  id: string;
  sessionId: string;
  value: number;
  stage?: RelayWorkStage | undefined;
  revision?: number | undefined;
  createdAt: string;
}

export interface RelayAcceptedTurn {
  turnId: string;
  value: number;
  expectedOutput: string;
  agentId: string;
  runId: string;
  attempt: number;
  output: string;
  stage?: RelayWorkStage | undefined;
  verdict?: "PASS" | "REVISE" | undefined;
  feedback?: string | undefined;
  checks?: RelayReviewCheck[] | undefined;
  completedAt: string;
}

export interface RelaySession {
  id: string;
  name: string;
  taskType: RelayTaskType;
  faultMode: RelayFaultMode;
  status: RelaySessionStatus;
  participantAgentIds: string[];
  workspaceAgentId?: string | undefined;
  planningRunId?: string | undefined;
  coordinationPlan?: {
    id: string;
    summary: string;
    rationale: string;
    riskLevel: "low" | "medium" | "high";
    workers: Array<{
      agentId: string;
      role: string;
      name: string;
      purpose: string;
      skills: string[];
    }>;
    steps: Array<{
      id: string;
      title: string;
      description: string;
      ownerRole: string;
      ownerAgentId: string;
      dependsOn: string[];
      parallelSafe: boolean;
      successEvidence: string;
    }>;
    createdAt: string;
  } | undefined;
  stepAgentIds?: string[] | undefined;
  sourceAttestation?: RelaySourceAttestation | undefined;
  previewAttestations?: RelayPreviewAttestation[] | undefined;
  initialValue: number;
  expectedValue: number;
  steps: string[];
  taskBrief?: string | undefined;
  successCriteria?: string[] | undefined;
  workStage?: RelayWorkStage | null | undefined;
  artifact?: string | null | undefined;
  artifactVersion?: number | undefined;
  reviewVerdict?: "PASS" | "REVISE" | null | undefined;
  reviewFeedback?: string | null | undefined;
  reviewChecks?: RelayReviewCheck[] | undefined;
  maxRevisions?: number | undefined;
  maxAttempts: number;
  turnTimeoutMs: number;
  activeRunId?: string | null;
  activeAgentId?: string | null;
  operatorInterruptions?: RelayOperatorInterruption[] | undefined;
  attemptsByValue: Record<string, number>;
  nextEventSequence: number;
  acceptedTurns: RelayAcceptedTurn[];
  events: RelayEvent[];
  failure: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface CreateRelaySessionInput {
  name?: string | undefined;
  participantAgentIds: string[];
  workspaceAgentId?: string | undefined;
  planningRunId?: string | undefined;
  coordinationPlan?: RelaySession["coordinationPlan"];
  stepAgentIds?: string[] | undefined;
  taskType?: RelayTaskType | undefined;
  initialValue?: number | undefined;
  steps?: string[] | undefined;
  taskBrief?: string | undefined;
  successCriteria?: string[] | undefined;
  maxRevisions?: number | undefined;
  maxAttempts?: number | undefined;
  turnTimeoutMs?: number | undefined;
  faultMode?: RelayFaultMode | undefined;
}

export interface RelayDelivery {
  turn: RelayTurn;
  deliveryCount: number;
  extendLease(): void;
  acknowledge(): Promise<void>;
  retry(delayMs: number): void;
  terminate(reason: string): void;
}

export interface RelayStateRecord {
  session: RelaySession;
  revision: number;
}

export interface RelayBus {
  initialize(): Promise<void>;
  close(): Promise<void>;
  createSession(session: RelaySession): Promise<void>;
  getSession(sessionId: string): Promise<RelayStateRecord | null>;
  listSessions(): Promise<RelaySession[]>;
  updateSession(
    sessionId: string,
    revision: number,
    session: RelaySession,
  ): Promise<number>;
  publishTurn(turn: RelayTurn): Promise<{ duplicate: boolean }>;
  publishEvent(event: RelayEvent): Promise<{ duplicate: boolean }>;
  nextTurn(expiresMs: number): Promise<RelayDelivery | null>;
}
