import type { GraphEdge, GraphNode, SmartFraming, WorkstreamFields } from "@threadmap/shared";

/**
 * Neo4j stores flat property maps, but our model nests `workstream` and
 * `workstream.smart`. We flatten with stable prefixes on the way in and
 * reconstruct on the way out.
 */

const WS_PREFIX = "ws_";
const SMART_PREFIX = "smart_";

const WS_KEYS: (keyof WorkstreamFields)[] = [
  "outcome",
  "currentOwner",
  "proposedDelegate",
  "currentStatus",
  "nextMilestone",
  "successCriteria",
  "escalationCriteria",
  "definitionOfDone",
  "seniorIcRole",
  "delegateRole",
  "readiness",
  "decisionBoundary",
];

const SMART_KEYS: (keyof SmartFraming)[] = ["specific", "measurable", "achievable", "relevant", "timeBound"];

const TOP_LEVEL_NODE_KEYS = [
  "note",
  "owner",
  "status",
  "reviewDate",
  "dueDate",
  "url",
  "repoPath",
  "externalRef",
  "riskLevel",
  "confidence",
  "tags",
] as const;

/** Flatten a node-shaped object into Neo4j props. Skips undefined values. */
export function nodeToProps(node: Partial<GraphNode>): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const key of ["id", "type", "title", "createdAt", "updatedAt"] as const) {
    if (node[key] !== undefined) props[key] = node[key];
  }
  for (const key of TOP_LEVEL_NODE_KEYS) {
    const v = node[key];
    if (v !== undefined) props[key] = v;
  }
  if (node.workstream) {
    for (const key of WS_KEYS) {
      const v = node.workstream[key];
      if (v !== undefined) props[`${WS_PREFIX}${key}`] = v;
    }
    if (node.workstream.smart) {
      for (const key of SMART_KEYS) {
        const v = node.workstream.smart[key];
        if (v !== undefined) props[`${SMART_PREFIX}${key}`] = v;
      }
    }
  }
  return props;
}

/** Reconstruct a GraphNode from a flat Neo4j property map. */
export function propsToNode(props: Record<string, unknown>): GraphNode {
  const node: GraphNode = {
    id: String(props.id),
    type: props.type as GraphNode["type"],
    title: String(props.title ?? ""),
    createdAt: String(props.createdAt),
    updatedAt: String(props.updatedAt),
  };
  for (const key of TOP_LEVEL_NODE_KEYS) {
    if (props[key] !== undefined && props[key] !== null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (node as any)[key] = props[key];
    }
  }
  const ws: WorkstreamFields = {};
  const smart: SmartFraming = {};
  let hasWs = false;
  let hasSmart = false;
  for (const key of WS_KEYS) {
    const v = props[`${WS_PREFIX}${key}`];
    if (v !== undefined && v !== null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ws as any)[key] = v;
      hasWs = true;
    }
  }
  for (const key of SMART_KEYS) {
    const v = props[`${SMART_PREFIX}${key}`];
    if (v !== undefined && v !== null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (smart as any)[key] = v;
      hasSmart = true;
    }
  }
  if (hasSmart) {
    ws.smart = smart;
    hasWs = true;
  }
  if (hasWs || node.type === "Workstream") node.workstream = ws;
  return node;
}

export function propsToEdge(props: Record<string, unknown>, type: string, source: string, target: string): GraphEdge {
  const edge: GraphEdge = {
    id: String(props.id),
    type: type as GraphEdge["type"],
    source,
    target,
    createdAt: String(props.createdAt),
    updatedAt: String(props.updatedAt),
  };
  if (props.note != null) edge.note = String(props.note);
  if (props.status != null) edge.status = String(props.status);
  if (props.confidence != null) edge.confidence = props.confidence as GraphEdge["confidence"];
  return edge;
}
