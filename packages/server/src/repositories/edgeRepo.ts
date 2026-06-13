import { nanoid } from "nanoid";
import { type CreateEdgeInput, type GraphEdge, type UpdateEdgeInput, isEdgeType } from "@threadmap/shared";
import { withSession } from "../db/driver.js";
import { propsToEdge } from "../db/mapping.js";

function now(): string {
  return new Date().toISOString();
}

/** Neo4j cannot parameterize relationship types, so we validate against the
 *  closed schema whitelist before interpolating. */
function safeType(type: string): string {
  if (!isEdgeType(type)) throw new Error(`Unknown edge type: ${type}`);
  return type;
}

export async function createEdge(input: CreateEdgeInput): Promise<GraphEdge> {
  const t = safeType(input.type);
  const ts = now();
  const id = nanoid(12);
  const props: Record<string, unknown> = { id, createdAt: ts, updatedAt: ts };
  if (input.note !== undefined) props.note = input.note;
  if (input.status !== undefined) props.status = input.status;
  if (input.confidence !== undefined) props.confidence = input.confidence;
  return withSession(async (s) => {
    const res = await s.run(
      `MATCH (a:ThreadNode {id: $source}), (b:ThreadNode {id: $target})
       CREATE (a)-[r:${t}]->(b) SET r = $props
       RETURN type(r) AS t, a.id AS src, b.id AS tgt, properties(r) AS props`,
      { source: input.source, target: input.target, props },
    );
    const rec = res.records[0];
    if (!rec) throw new Error("Source or target node not found");
    return propsToEdge(rec.get("props"), rec.get("t"), rec.get("src"), rec.get("tgt"));
  });
}

export async function getEdge(id: string): Promise<GraphEdge | null> {
  return withSession(async (s) => {
    const res = await s.run(
      "MATCH (a:ThreadNode)-[r {id: $id}]->(b:ThreadNode) RETURN type(r) AS t, a.id AS src, b.id AS tgt, properties(r) AS props",
      { id },
    );
    const rec = res.records[0];
    return rec ? propsToEdge(rec.get("props"), rec.get("t"), rec.get("src"), rec.get("tgt")) : null;
  });
}

export async function listEdges(): Promise<GraphEdge[]> {
  return withSession(async (s) => {
    const res = await s.run(
      "MATCH (a:ThreadNode)-[r]->(b:ThreadNode) RETURN type(r) AS t, a.id AS src, b.id AS tgt, properties(r) AS props",
    );
    return res.records.map((r) => propsToEdge(r.get("props"), r.get("t"), r.get("src"), r.get("tgt")));
  });
}

export async function updateEdge(id: string, changes: UpdateEdgeInput): Promise<GraphEdge | null> {
  // Relationship type is immutable in Neo4j; a type change is delete + recreate.
  if (changes.type) {
    const existing = await getEdge(id);
    if (!existing) return null;
    if (changes.type !== existing.type) {
      await deleteEdge(id);
      return createEdge({
        type: changes.type,
        source: existing.source,
        target: existing.target,
        note: changes.note ?? existing.note,
        status: changes.status ?? existing.status,
        confidence: changes.confidence ?? existing.confidence,
      });
    }
  }
  const setProps: Record<string, unknown> = { updatedAt: now() };
  const removeKeys: string[] = [];
  for (const key of ["note", "status", "confidence"] as const) {
    const v = changes[key];
    if (v === undefined) continue;
    if (v === null) removeKeys.push(key);
    else setProps[key] = v;
  }
  const removeClause = removeKeys.length ? "REMOVE " + removeKeys.map((k) => `r.\`${k}\``).join(", ") : "";
  return withSession(async (s) => {
    const res = await s.run(
      `MATCH (a:ThreadNode)-[r {id: $id}]->(b:ThreadNode)
       SET r += $setProps ${removeClause}
       RETURN type(r) AS t, a.id AS src, b.id AS tgt, properties(r) AS props`,
      { id, setProps },
    );
    const rec = res.records[0];
    return rec ? propsToEdge(rec.get("props"), rec.get("t"), rec.get("src"), rec.get("tgt")) : null;
  });
}

export async function deleteEdge(id: string): Promise<boolean> {
  return withSession(async (s) => {
    const res = await s.run("MATCH ()-[r {id: $id}]->() DELETE r RETURN count(r) AS c", { id });
    return Number(res.records[0]?.get("c") ?? 0) > 0;
  });
}
