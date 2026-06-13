import type { NodeType } from "./nodeTypes.js";
import type { EdgeType } from "./edgeTypes.js";
import type { DecisionBoundary, Level, ReadinessState, SmartFraming } from "./delegation.js";

/** ISO-8601 timestamp string. */
export type Iso = string;

/**
 * Workstream-specific delegation fields. Stored flat on Workstream nodes
 * (Neo4j has no nested objects), but modelled here as a sub-object for clarity.
 * The repository layer flattens/unflattens these with a `ws_` prefix.
 */
export interface WorkstreamFields {
  outcome?: string;
  currentOwner?: string;
  proposedDelegate?: string;
  currentStatus?: string;
  nextMilestone?: string;
  successCriteria?: string;
  escalationCriteria?: string;
  definitionOfDone?: string;
  seniorIcRole?: string;
  delegateRole?: string;
  readiness?: ReadinessState;
  decisionBoundary?: DecisionBoundary;
  smart?: SmartFraming;
}

/** Optional fields available on any node. */
export interface NodeOptionalFields {
  note?: string;
  owner?: string;
  status?: string;
  reviewDate?: Iso;
  dueDate?: Iso;
  url?: string;
  repoPath?: string;
  externalRef?: string;
  riskLevel?: Level;
  confidence?: Level;
  tags?: string[];
}

export interface GraphNode extends NodeOptionalFields {
  id: string;
  type: NodeType;
  title: string;
  createdAt: Iso;
  updatedAt: Iso;
  /** Present (and meaningful) only when type === "Workstream". */
  workstream?: WorkstreamFields;
}

export interface GraphEdge {
  id: string;
  type: EdgeType;
  source: string; // node id
  target: string; // node id
  note?: string;
  status?: string;
  confidence?: Level;
  createdAt: Iso;
  updatedAt: Iso;
}

/** Payload to create a node. createdAt/updatedAt/id are server-assigned. */
export interface CreateNodeInput extends NodeOptionalFields {
  type: NodeType;
  title: string;
  workstream?: WorkstreamFields;
}

/** Optional fields on updates accept `null` to explicitly clear the property. */
type Clearable<T> = { [K in keyof T]?: T[K] | null };

export type UpdateNodeInput = Clearable<NodeOptionalFields> & {
  /** Type changes are allowed but discouraged; the UI confirms first. */
  type?: NodeType;
  title?: string;
  workstream?: WorkstreamFields;
};

export interface CreateEdgeInput {
  type: EdgeType;
  source: string;
  target: string;
  note?: string;
  status?: string;
  confidence?: Level;
}

export type UpdateEdgeInput = {
  type?: EdgeType;
  note?: string | null;
  status?: string | null;
  confidence?: Level | null;
};

/** A node plus its incident edges and immediate neighbors. */
export interface Neighborhood {
  center: GraphNode;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
