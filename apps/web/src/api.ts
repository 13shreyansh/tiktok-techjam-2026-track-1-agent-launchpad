import type { Agent, AgentRun, Message, RelaySession, SystemInfo, TaskPlan } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

let authToken = "";

export function setAuthToken(token: string): void {
  authToken = token.trim();
}

function authorizedHeaders(headers?: HeadersInit): HeadersInit {
  return {
    ...(authToken ? { Authorization: "Bearer " + authToken } : {}),
    ...headers,
  };
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers = authorizedHeaders({
    ...(options?.body ? { "Content-Type": "application/json" } : {}),
    ...options?.headers,
  });
  const response = await fetch(url, {
    ...options,
    headers,
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new ApiError(data.error ?? "Request failed", response.status);
  }
  return data;
}

async function watchRelaySessions(
  onSnapshot: (snapshot: { enabled: boolean; sessions: RelaySession[] }) => void,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch("/api/relay/sessions/stream", {
    headers: authorizedHeaders({ Accept: "text/event-stream" }),
    signal,
  });
  if (!response.ok || !response.body) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(data.error ?? "Relay event stream failed", response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true }).replaceAll("\r\n", "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = frame
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (data) onSnapshot(JSON.parse(data) as { enabled: boolean; sessions: RelaySession[] });
      boundary = buffer.indexOf("\n\n");
    }
  }
}

export const api = {
  auth: () => request<{ required: boolean }>("/api/auth"),
  system: () => request<SystemInfo>("/api/system"),
  listAgents: () => request<{ agents: Agent[] }>("/api/agents"),
  createAgent: (body: {
    name: string;
    description: string;
    instructions: string;
  }) =>
    request<{ agent: Agent }>("/api/agents", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateAgent: (
    id: string,
    body: { name: string; description: string; instructions: string },
  ) =>
    request<{ agent: Agent }>("/api/agents/" + id, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteAgent: (id: string) =>
    request<{ archivedWorkspace: string }>("/api/agents/" + id, {
      method: "DELETE",
    }),
  startAgent: (id: string) =>
    request<{ agent: Agent }>("/api/agents/" + id + "/start", {
      method: "POST",
    }),
  stopAgent: (id: string) =>
    request<{ agent: Agent }>("/api/agents/" + id + "/stop", {
      method: "POST",
    }),
  messages: (id: string) =>
    request<{ messages: Message[] }>("/api/agents/" + id + "/messages"),
  runs: (id: string) =>
    request<{ runs: AgentRun[] }>("/api/agents/" + id + "/runs"),
  previewStatus: (id: string) =>
    request<{ available: boolean; url: string | null }>(
      "/api/agents/" + id + "/preview-status",
    ),
  sendMessage: (id: string, content: string) =>
    request<{ run: AgentRun; message: Message }>(
      "/api/agents/" + id + "/messages",
      {
        method: "POST",
        body: JSON.stringify({ content }),
      },
    ),
  createCoordinatedTask: (id: string, content: string) =>
    request<
      | {
          status: "needs-clarification";
          plan: TaskPlan;
          planningRun: AgentRun;
        }
      | {
          status: "started";
          plan: TaskPlan;
          planningRun: AgentRun;
          workers: Agent[];
          session: RelaySession;
        }
    >("/api/agents/" + id + "/tasks", {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
  run: (id: string) => request<{ run: AgentRun }>("/api/runs/" + id),
  relaySessions: () =>
    request<{ enabled: boolean; sessions: RelaySession[] }>("/api/relay/sessions"),
  relaySession: (id: string) =>
    request<{ session: RelaySession }>("/api/relay/sessions/" + id),
  relayEvidence: (id: string) =>
    request<{
      evidence: Record<string, unknown>;
      digest: { algorithm: string; value: string };
      contentDigest: { algorithm: string; value: string };
    }>(
      "/api/relay/sessions/" + id + "/evidence",
    ),
  cancelRelaySession: (id: string) =>
    request<{ session: RelaySession }>("/api/relay/sessions/" + id + "/cancel", {
      method: "POST",
    }),
  interruptRelayRun: (id: string) =>
    request<{ session: RelaySession; interruptedRunId: string }>(
      "/api/relay/sessions/" + id + "/interrupt",
      { method: "POST" },
    ),
  watchRelaySessions,
  createRelaySession: (body: {
    name?: string;
    participantAgentIds: string[];
    workspaceAgentId?: string;
    taskType?: "countdown" | "ordered-sequence" | "team-task" | "checkpoint-workflow";
    initialValue?: number;
    steps?: string[];
    taskBrief?: string;
    successCriteria?: string[];
    maxRevisions?: number;
    maxAttempts: number;
    turnTimeoutMs: number;
    faultMode: "none" | "fail-first-claim";
  }) =>
    request<{ session: RelaySession }>("/api/relay/sessions", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
