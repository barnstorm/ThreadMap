import { nanoid } from "nanoid";
import type {
  CreateNodeInput,
  Graph,
  GraphEdge,
  GraphNode,
  Neighborhood,
  NodeType,
  UpdateNodeInput,
} from "@threadmap/shared";
import { withSession } from "../db/driver.js";
import { nodeToProps, propsToEdge, propsToNode } from "../db/mapping.js";

function now(): string {
  return new Date().toISOString();
}

export interface NodeListFilter {
  type?: NodeType;
  /** Case-insensitive substring match on title. */
  q?: string;
  tag?: string;
}

export async function createNode(input: CreateNodeInput): Promise<GraphNode> {
  const ts = now();
  const node: GraphNode = { ...input, id: nanoid(12), createdAt: ts, updatedAt: ts };
  const props = nodeToProps(node);
  return withSession(async (s) => {
    await s.run("CREATE (n:ThreadNode) SET n = $props", { props });
    return node;
  });
}

export async function getNode(id: string): Promise<GraphNode | null> {
  return withSession(async (s) => {
    const res = await s.run("MATCH (n:ThreadNode {id: $id}) RETURN n", { id });
    const rec = res.records[0];
    if (!rec) return null;
    return propsToNode(rec.get("n").properties);
  });
}

export async function listNodes(filter: NodeListFilter = {}): Promise<GraphNode[]> {
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (filter.type) {
    where.push("n.type = $type");
    params.type = filter.type;
  }
  if (filter.q) {
    where.push("toLower(n.title) CONTAINS toLower($q)");
    params.q = filter.q;
  }
  if (filter.tag) {
    where.push("$tag IN n.tags");
    params.tag = filter.tag;
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return withSession(async (s) => {
    const res = await s.run(`MATCH (n:ThreadNode) ${clause} RETURN n ORDER BY n.updatedAt DESC`, params);
    return res.records.map((r) => propsToNode(r.get("n").properties));
  });
}

export async function updateNode(id: string, changes: UpdateNodeInput): Promise<GraphNode | null> {
  // Flatten; null values mean "remove this property".
  const flat = nodeToProps({ ...changes } as Partial<GraphNode>);
  const setProps: Record<string, unknown> = { updatedAt: now() };
  const removeKeys: string[] = [];
  for (const [k, v] of Object.entries(flat)) {
    if (k === "id" || k === "createdAt") continue;
    if (v === null) removeKeys.push(k);
    else setProps[k] = v;
  }
  const removeClause = removeKeys.length ? "REMOVE " + removeKeys.map((k) => `n.\`${k}\``).join(", ") : "";
  return withSession(async (s) => {
    const res = await s.run(
      `MATCH (n:ThreadNode {id: $id}) SET n += $setProps ${removeClause} RETURN n`,
      { id, setProps },
    );
    const rec = res.records[0];
    return rec ? propsToNode(rec.get("n").properties) : null;
  });
}

export async function deleteNode(id: string): Promise<boolean> {
  return withSession(async (s) => {
    const res = await s.run("MATCH (n:ThreadNode {id: $id}) DETACH DELETE n RETURN count(n) AS c", { id });
    return Number(res.records[0]?.get("c") ?? 0) > 0;
  });
}

/** Whole-graph fetch for the canvas. Bounded by an optional limit. */
export async function getGraph(limit = 2000): Promise<Graph> {
  return withSession(async (s) => {
    const nodesRes = await s.run("MATCH (n:ThreadNode) RETURN n LIMIT $limit", { limit });
    const nodes = nodesRes.records.map((r) => propsToNode(r.get("n").properties));
    const edgesRes = await s.run(
      "MATCH (a:ThreadNode)-[r]->(b:ThreadNode) RETURN type(r) AS t, a.id AS src, b.id AS tgt, properties(r) AS props LIMIT $limit",
      { limit },
    );
    const edges: GraphEdge[] = edgesRes.records.map((r) =>
      propsToEdge(r.get("props"), r.get("t"), r.get("src"), r.get("tgt")),
    );
    return { nodes, edges };
  });
}

export async function getNeighborhood(id: string, depth = 1): Promise<Neighborhood | null> {
  const center = await getNode(id);
  if (!center) return null;
  const d = Math.max(1, Math.min(depth, 3));
  return withSession(async (s) => {
    const res = await s.run(
      `MATCH (c:ThreadNode {id: $id})
       OPTIONAL MATCH path = (c)-[*1..${d}]-(m:ThreadNode)
       WITH c, collect(DISTINCT m) AS others
       WITH [c] + others AS ns
       UNWIND ns AS n
       WITH collect(DISTINCT n) AS nodes
       UNWIND nodes AS a
       OPTIONAL MATCH (a)-[r]->(b:ThreadNode) WHERE b IN nodes
       RETURN nodes, collect(DISTINCT {t: type(r), src: a.id, tgt: b.id, props: properties(r)}) AS rels`,
      { id },
    );
    const rec = res.records[0];
    if (!rec) return { center, nodes: [center], edges: [] };
    const nodes: GraphNode[] = rec.get("nodes").map((n: { properties: Record<string, unknown> }) => propsToNode(n.properties));
    const edges: GraphEdge[] = rec
      .get("rels")
      .filter((x: { t: string | null }) => x.t)
      .map((x: { t: string; src: string; tgt: string; props: Record<string, unknown> }) =>
        propsToEdge(x.props, x.t, x.src, x.tgt),
      );
    return { center, nodes, edges };
  });
}
