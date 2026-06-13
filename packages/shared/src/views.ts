/**
 * Saved views oriented around review and delegation. Each view has a stable
 * id (used by the API), a human name, and a short description. The Cypher that
 * backs each view lives server-side; this catalog is the shared contract.
 *
 * `shape` tells the UI how to render results:
 *   - "list"  : a flat list of workstreams/risks/decisions
 *   - "graph" : a subgraph (nodes + edges) for the canvas
 *   - "group" : items grouped by a key (owner, decision owner, pipeline stage)
 */
export const VIEW_SHAPES = ["list", "graph", "group"] as const;
export type ViewShape = (typeof VIEW_SHAPES)[number];

export interface ViewDef {
  id: string;
  name: string;
  description: string;
  shape: ViewShape;
  /** For "group" views, a label for the grouping dimension. */
  groupBy?: string;
}

export const VIEWS: ViewDef[] = [
  {
    id: "my-carried-work",
    name: "My Carried Work",
    description: "Workstreams owned by the senior IC or lacking another owner.",
    shape: "list",
  },
  {
    id: "unowned-work",
    name: "Unowned Work",
    description: "Workstreams without an owner.",
    shape: "list",
  },
  {
    id: "delegate-now",
    name: "Delegate Now",
    description: "Workstreams classified as ready to delegate.",
    shape: "list",
  },
  {
    id: "needs-context-transfer",
    name: "Needs Context Transfer",
    description: "Workstreams that could be delegated after setup.",
    shape: "list",
  },
  {
    id: "missing-milestone",
    name: "Missing Milestone",
    description: "Workstreams with no next milestone.",
    shape: "list",
  },
  {
    id: "missing-review-date",
    name: "Missing Review Date",
    description: "Workstreams with no next review date.",
    shape: "list",
  },
  {
    id: "risks-without-mitigation",
    name: "Risks Without Mitigation",
    description: "Risk nodes without mitigation notes.",
    shape: "list",
  },
  {
    id: "decisions-needed",
    name: "Decisions Needed",
    description: "Unresolved decisions grouped by decision owner.",
    shape: "group",
    groupBy: "owner",
  },
  {
    id: "capability-map",
    name: "Capability Map",
    description: "Initiatives, capabilities, and implementing workstreams.",
    shape: "graph",
  },
  {
    id: "packet-pipeline-map",
    name: "Packet Pipeline Map",
    description: "Capabilities and workstreams grouped by pipeline stage.",
    shape: "group",
    groupBy: "pipeline stage",
  },
  {
    id: "code-area-collision-map",
    name: "Code Area Collision Map",
    description: "Code areas touched by multiple active workstreams or initiatives.",
    shape: "group",
    groupBy: "code area",
  },
  {
    id: "owner-load",
    name: "Owner Load",
    description: "Active workstreams grouped by person.",
    shape: "group",
    groupBy: "owner",
  },
];

export const VIEW_IDS = VIEWS.map((v) => v.id);

export function getView(id: string): ViewDef | undefined {
  return VIEWS.find((v) => v.id === id);
}

/** Result envelope returned by GET /api/views/:id */
export interface ViewResultGroup {
  key: string;
  items: import("./types.js").GraphNode[];
}

export interface ViewResult {
  view: ViewDef;
  /** Populated for list views. */
  items?: import("./types.js").GraphNode[];
  /** Populated for group views. */
  groups?: ViewResultGroup[];
  /** Populated for graph views. */
  graph?: import("./types.js").Graph;
}
