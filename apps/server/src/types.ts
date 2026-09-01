export type AgentStatus = "ready" | "busy" | "stopped" | "error";
export type RunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type MessageRole = "user" | "assistant";

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
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface RunUsage {
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
}

export type RunTraceKind =
  | "runtime"
  | "policy"
  | "control"
  | "message"
  | "command"
  | "file"
  | "tool"
  | "web"
  | "error";

export type RunTracePhase = "started" | "completed" | "failed";

export interface RunTraceEvent {
  id: string;
  sequence: number;
  kind: RunTraceKind;
  phase: RunTracePhase;
  title: string;
  summary: string | null;
  detail: string | null;
  exitCode: number | null;
  at: string;
  updatedAt: string;
  previousHash?: string;
  eventHash?: string;
}

export interface AgentRun {
  id: string;
  agentId: string;
  status: RunStatus;
  prompt: string;
  output: string | null;
  error: string | null;
  usage: RunUsage | null;
  trace: RunTraceEvent[];
  workspaceTransaction?: {
    workspaceAgentId: string;
    status: "open" | "committed" | "discarded";
  };
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface Database {
  version: 1;
  agents: Agent[];
  messages: Message[];
  runs: AgentRun[];
}

export interface CreateAgentInput {
  name: string;
  description?: string | undefined;
  instructions?: string | undefined;
  kind?: "lead" | "worker" | undefined;
  parentAgentId?: string | null | undefined;
  taskPlanId?: string | null | undefined;
  role?: string | null | undefined;
}

export interface UpdateAgentInput {
  name?: string | undefined;
  description?: string | undefined;
  instructions?: string | undefined;
}

export interface RunnerResult {
  output: string;
  threadId: string | null;
  usage: RunUsage | null;
}

export interface RunnerRequest {
  runId: string;
  agentId: string;
  workspacePath: string;
  prompt: string;
  threadId: string | null;
  onTrace?: ((event: RunTraceEvent) => void) | undefined;
}

export interface AgentRunner {
  run(request: RunnerRequest): Promise<RunnerResult>;
  cancel(agentId: string): Promise<boolean>;
  isAvailable(): Promise<boolean>;
}
