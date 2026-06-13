import type {
  CreateEdgeInput,
  CreateNodeInput,
  EdgeTypeMeta,
  Graph,
  GraphEdge,
  GraphNode,
  LlmRequest,
  LlmResponse,
  Neighborhood,
  NodeType,
  NodeTypeMeta,
  ReadinessReport,
  UpdateEdgeInput,
  UpdateNodeInput,
  ViewDef,
  ViewResult,
} from "@threadmap/shared";

const BASE = "";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  return body as T;
}

export interface Meta {
  nodeTypes: NodeType[];
  nodeTypeMeta: Record<NodeType, NodeTypeMeta>;
  edgeTypes: string[];
  edgeTypeMeta: Record<string, EdgeTypeMeta>;
  levels: string[];
  readinessStates: string[];
  readinessMeta: Record<string, { description: string; useWhen: string[] }>;
  decisionBoundaries: string[];
  decisionBoundaryMeta: Record<string, string>;
  smartFields: { key: string; label: string; prompt: string }[];
  monitorSignals: string[];
  doNotThinkAbout: string[];
  views: ViewDef[];
  sidecarQuestions: { id: string; label: string }[];
}

export const api = {
  health: () => req<{ ok: boolean; neo4j: string }>("/health"),
  meta: () => req<Meta>("/api/meta"),

  graph: () => req<Graph>("/api/graph"),
  listNodes: (q?: { type?: string; q?: string }) => {
    const params = new URLSearchParams();
    if (q?.type) params.set("type", q.type);
    if (q?.q) params.set("q", q.q);
    const qs = params.toString();
    return req<GraphNode[]>(`/api/nodes${qs ? `?${qs}` : ""}`);
  },
  getNode: (id: string) => req<GraphNode>(`/api/nodes/${id}`),
  createNode: (input: CreateNodeInput) => req<GraphNode>("/api/nodes", { method: "POST", body: JSON.stringify(input) }),
  updateNode: (id: string, changes: UpdateNodeInput) =>
    req<GraphNode>(`/api/nodes/${id}`, { method: "PATCH", body: JSON.stringify(changes) }),
  deleteNode: (id: string) => req<void>(`/api/nodes/${id}`, { method: "DELETE" }),
  neighborhood: (id: string, depth = 1) => req<Neighborhood>(`/api/nodes/${id}/neighborhood?depth=${depth}`),
  readiness: (id: string) => req<ReadinessReport>(`/api/nodes/${id}/readiness`),

  createEdge: (input: CreateEdgeInput) => req<GraphEdge>("/api/edges", { method: "POST", body: JSON.stringify(input) }),
  updateEdge: (id: string, changes: UpdateEdgeInput) =>
    req<GraphEdge>(`/api/edges/${id}`, { method: "PATCH", body: JSON.stringify(changes) }),
  deleteEdge: (id: string) => req<void>(`/api/edges/${id}`, { method: "DELETE" }),

  runView: (id: string) => req<ViewResult>(`/api/views/${id}`),

  llmStatus: () => req<{ enabled: boolean; model: string; questions: { id: string; label: string }[] }>("/api/llm/status"),
  ask: (input: LlmRequest) => req<LlmResponse>("/api/llm/ask", { method: "POST", body: JSON.stringify(input) }),
};
