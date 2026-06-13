import type { CreateEdgeInput, CreateNodeInput, UpdateEdgeInput, UpdateNodeInput } from "./types.js";

/**
 * The LLM sidecar is OPTIONAL and READ-ONLY with respect to the graph. It may
 * read selected nodes, neighborhoods, saved views, and linked references, and
 * it may *propose* edits — but it never mutates graph state. Every proposed
 * edit is surfaced to the human for explicit approval.
 */

/**
 * Structured sections the model must separate in every answer. This keeps the
 * human in control: graph facts, reference facts, inference, and unknowns are
 * never blended together, and edits are always proposals.
 */
export interface LlmAnswer {
  /** Information directly present in graph nodes and edges. */
  factsFromGraph: string[];
  /** Information found in linked docs, tickets, or code references. */
  factsFromReferences: string[];
  /** Reasonable conclusions based on graph structure. */
  inferences: string[];
  /** Missing information that should not be invented. */
  unknowns: string[];
  /** Suggested nodes, edges, or field updates requiring approval. */
  proposedEdits: ProposedEdit[];
  /** Optional free-form prose summary shown above the structured sections. */
  summary?: string;
}

export type ProposedEdit =
  | { kind: "createNode"; rationale: string; node: CreateNodeInput }
  | { kind: "updateNode"; rationale: string; nodeId: string; changes: UpdateNodeInput }
  | { kind: "createEdge"; rationale: string; edge: CreateEdgeInput }
  | { kind: "updateEdge"; rationale: string; edgeId: string; changes: UpdateEdgeInput };

/** Built-in sidecar prompts the UI offers as one-click questions. */
export const SIDECAR_QUESTIONS: { id: string; label: string }[] = [
  { id: "carrying", label: "What work am I still carrying personally?" },
  { id: "ready-to-delegate", label: "Which workstreams are ready to delegate?" },
  { id: "missing-smart", label: "Which workstreams lack SMART success criteria?" },
  { id: "capability-gaps", label: "Which capabilities have no implementing workstream?" },
  { id: "blockers", label: "Which workstreams block Customer QoS Enforcement?" },
  { id: "delegated-no-milestone", label: "Which delegated items have no next milestone?" },
  { id: "risks-no-mitigation", label: "Which risks lack mitigation?" },
  { id: "decisions-senior", label: "Which decisions require senior IC input?" },
  { id: "implementer", label: "Where am I acting as implementer instead of owner?" },
  { id: "stop-tracking", label: "What should I stop tracking?" },
];

export interface LlmRequest {
  question: string;
  /** Optional node ids to scope the context the model sees. */
  focusNodeIds?: string[];
  /** Optional saved-view id whose results become part of the context. */
  viewId?: string;
}

export interface LlmResponse {
  answer: LlmAnswer;
  model: string;
  /** True when the sidecar is disabled (no API key); answer will be empty. */
  disabled?: boolean;
}
