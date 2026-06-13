import {
  type Graph,
  type GraphEdge,
  type GraphNode,
  type ViewResult,
  type ViewResultGroup,
  getView,
} from "@threadmap/shared";
import { withSession } from "../db/driver.js";
import { propsToEdge, propsToNode } from "../db/mapping.js";

type Rec = { properties: Record<string, unknown> };

function mapNodes(records: { get: (k: string) => Rec }[], key: string): GraphNode[] {
  return records.map((r) => propsToNode(r.get(key).properties));
}

/** Run one of the saved views by id. Throws if the id is unknown. */
export async function runView(id: string): Promise<ViewResult> {
  const view = getView(id);
  if (!view) throw new Error(`Unknown view: ${id}`);

  switch (id) {
    case "my-carried-work":
      return { view, items: await listQuery(CARRIED) };
    case "unowned-work":
      return { view, items: await listQuery(UNOWNED) };
    case "delegate-now":
      return { view, items: await listQuery(DELEGATE_NOW) };
    case "needs-context-transfer":
      return { view, items: await listQuery(NEEDS_CONTEXT) };
    case "missing-milestone":
      return { view, items: await listQuery(MISSING_MILESTONE) };
    case "missing-review-date":
      return { view, items: await listQuery(MISSING_REVIEW) };
    case "risks-without-mitigation":
      return { view, items: await listQuery(RISKS_NO_MITIGATION) };
    case "decisions-needed":
      return { view, groups: await groupQuery(DECISIONS_NEEDED) };
    case "capability-map":
      return { view, graph: await capabilityMap() };
    case "packet-pipeline-map":
      return { view, groups: await groupQuery(PIPELINE_MAP) };
    case "code-area-collision-map":
      return { view, groups: await groupQuery(CODE_COLLISION) };
    case "owner-load":
      return { view, groups: await groupQuery(OWNER_LOAD) };
    default:
      throw new Error(`View not implemented: ${id}`);
  }
}

async function listQuery(cypher: string): Promise<GraphNode[]> {
  return withSession(async (s) => {
    const res = await s.run(cypher);
    return mapNodes(res.records, "n");
  });
}

/** Group queries must RETURN `key` (string) and `n` (a node), one row per item. */
async function groupQuery(cypher: string): Promise<ViewResultGroup[]> {
  return withSession(async (s) => {
    const res = await s.run(cypher);
    const map = new Map<string, GraphNode[]>();
    for (const r of res.records) {
      const key = String(r.get("key") ?? "(none)");
      const node = propsToNode(r.get("n").properties);
      const arr = map.get(key) ?? [];
      arr.push(node);
      map.set(key, arr);
    }
    return [...map.entries()].map(([key, items]) => ({ key, items }));
  });
}

// --- List views -----------------------------------------------------------

// Workstreams still personally carried: not delegated to another person.
const CARRIED = `
MATCH (n:ThreadNode {type: 'Workstream'})
WHERE NOT (n)-[:DELEGATED_TO]->(:ThreadNode {type: 'Person'})
  AND coalesce(n.ws_readiness, '') <> 'Drop or Defer'
RETURN n ORDER BY n.updatedAt DESC`;

// Workstreams with no owner at all (no OWNED_BY edge, no owner/currentOwner field).
const UNOWNED = `
MATCH (n:ThreadNode {type: 'Workstream'})
WHERE NOT (n)-[:OWNED_BY]->(:ThreadNode {type: 'Person'})
  AND NOT (n)-[:DELEGATED_TO]->(:ThreadNode {type: 'Person'})
  AND coalesce(n.owner, '') = ''
  AND coalesce(n.ws_currentOwner, '') = ''
RETURN n ORDER BY n.updatedAt DESC`;

const DELEGATE_NOW = `
MATCH (n:ThreadNode {type: 'Workstream'})
WHERE n.ws_readiness = 'Delegate Now'
RETURN n ORDER BY n.updatedAt DESC`;

const NEEDS_CONTEXT = `
MATCH (n:ThreadNode {type: 'Workstream'})
WHERE n.ws_readiness = 'Delegate After Context Transfer'
RETURN n ORDER BY n.updatedAt DESC`;

const MISSING_MILESTONE = `
MATCH (n:ThreadNode {type: 'Workstream'})
WHERE NOT (n)-[:HAS_MILESTONE]->(:ThreadNode {type: 'Milestone'})
  AND coalesce(n.ws_nextMilestone, '') = ''
RETURN n ORDER BY n.updatedAt DESC`;

const MISSING_REVIEW = `
MATCH (n:ThreadNode {type: 'Workstream'})
WHERE coalesce(n.reviewDate, '') = ''
RETURN n ORDER BY n.updatedAt DESC`;

// Risk nodes whose note (mitigation) is empty.
const RISKS_NO_MITIGATION = `
MATCH (n:ThreadNode {type: 'Risk'})
WHERE coalesce(n.note, '') = ''
RETURN n ORDER BY n.updatedAt DESC`;

// --- Group views -----------------------------------------------------------

// Unresolved decisions grouped by decision owner.
const DECISIONS_NEEDED = `
MATCH (n:ThreadNode {type: 'Decision'})
WHERE coalesce(n.status, '') <> 'resolved'
RETURN coalesce(n.owner, '(unassigned)') AS key, n ORDER BY key, n.updatedAt DESC`;

// Capabilities and workstreams grouped by the pipeline stage they touch.
const PIPELINE_MAP = `
MATCH (stage:ThreadNode {type: 'PipelineStage'})<-[:TOUCHES]-(n:ThreadNode)
WHERE n.type IN ['Workstream', 'Capability']
RETURN stage.title AS key, n ORDER BY key, n.type, n.updatedAt DESC`;

// Code areas touched by 2+ workstreams/initiatives (collisions).
const CODE_COLLISION = `
MATCH (area:ThreadNode {type: 'CodeArea'})<-[:TOUCHES]-(n:ThreadNode)
WHERE n.type IN ['Workstream', 'Initiative', 'Capability']
WITH area, collect(n) AS touchers
WHERE size(touchers) >= 2
UNWIND touchers AS n
RETURN area.title AS key, n ORDER BY key, n.updatedAt DESC`;

// Active workstreams grouped by person (owner or delegate).
const OWNER_LOAD = `
MATCH (p:ThreadNode {type: 'Person'})<-[:OWNED_BY|DELEGATED_TO]-(n:ThreadNode {type: 'Workstream'})
WHERE coalesce(n.ws_readiness, '') <> 'Drop or Defer'
RETURN p.title AS key, n ORDER BY key, n.updatedAt DESC`;

// --- Graph view ------------------------------------------------------------

async function capabilityMap(): Promise<Graph> {
  return withSession(async (s) => {
    const res = await s.run(`
      MATCH (n:ThreadNode)
      WHERE n.type IN ['Initiative', 'Capability', 'Workstream']
      WITH collect(n) AS nodes
      UNWIND nodes AS a
      OPTIONAL MATCH (a)-[r:PART_OF|IMPLEMENTS]->(b:ThreadNode)
      WHERE b IN nodes
      RETURN nodes, collect(DISTINCT {t: type(r), src: a.id, tgt: b.id, props: properties(r)}) AS rels`);
    const rec = res.records[0];
    if (!rec) return { nodes: [], edges: [] };
    const nodes: GraphNode[] = rec.get("nodes").map((n: Rec) => propsToNode(n.properties));
    const edges: GraphEdge[] = rec
      .get("rels")
      .filter((x: { t: string | null }) => x.t)
      .map((x: { t: string; src: string; tgt: string; props: Record<string, unknown> }) =>
        propsToEdge(x.props, x.t, x.src, x.tgt),
      );
    return { nodes, edges };
  });
}
