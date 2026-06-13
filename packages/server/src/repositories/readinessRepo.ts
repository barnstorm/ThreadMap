import { type ReadinessContext, type ReadinessReport, computeReadiness } from "@threadmap/shared";
import { withSession } from "../db/driver.js";
import { getNode } from "./nodeRepo.js";

/** Derive the graph-side readiness flags for a workstream from its edges. */
export async function readinessContext(id: string): Promise<ReadinessContext> {
  return withSession(async (s) => {
    const res = await s.run(
      `MATCH (n:ThreadNode {id: $id})
       OPTIONAL MATCH (n)-[:IMPLEMENTS|PART_OF]->(cap:ThreadNode)
         WHERE cap.type IN ['Capability','Initiative']
       OPTIONAL MATCH (n)-[:HAS_MILESTONE]->(ms:ThreadNode {type: 'Milestone'})
       OPTIONAL MATCH (n)-[:OWNED_BY|DELEGATED_TO]->(p:ThreadNode {type: 'Person'})
       OPTIONAL MATCH (n)-[:HAS_RISK]->(rk:ThreadNode {type: 'Risk'})
       RETURN count(DISTINCT cap) > 0 AS hasCap,
              count(DISTINCT ms) > 0 AS hasMs,
              count(DISTINCT p) > 0 AS hasOwner,
              count(DISTINCT rk) > 0 AS hasRisk`,
      { id },
    );
    const rec = res.records[0];
    return {
      hasCapabilityLink: Boolean(rec?.get("hasCap")),
      hasMilestone: Boolean(rec?.get("hasMs")),
      hasOwner: Boolean(rec?.get("hasOwner")),
      riskAcknowledged: Boolean(rec?.get("hasRisk")),
    };
  });
}

export async function nodeReadiness(id: string): Promise<ReadinessReport | null> {
  const node = await getNode(id);
  if (!node || node.type !== "Workstream") return null;
  const ctx = await readinessContext(id);
  return computeReadiness(node, ctx);
}
