import type { Graph, LlmRequest } from "@threadmap/shared";
import { getGraph, getNeighborhood } from "../repositories/nodeRepo.js";
import { runView } from "../repositories/viewRepo.js";

/**
 * Assemble the read-only context the sidecar is allowed to see. Scope narrows
 * from focus nodes → saved view → whole graph, so the model gets the smallest
 * relevant slice. The graph is a single IC's mind map, so even "whole graph"
 * is small enough to send.
 */
export async function buildContext(req: LlmRequest): Promise<{ text: string; graph: Graph }> {
  let graph: Graph = { nodes: [], edges: [] };

  if (req.focusNodeIds && req.focusNodeIds.length > 0) {
    const seenNodes = new Map<string, Graph["nodes"][number]>();
    const seenEdges = new Map<string, Graph["edges"][number]>();
    for (const id of req.focusNodeIds) {
      const hood = await getNeighborhood(id, 2);
      if (!hood) continue;
      for (const n of hood.nodes) seenNodes.set(n.id, n);
      for (const e of hood.edges) seenEdges.set(e.id, e);
    }
    graph = { nodes: [...seenNodes.values()], edges: [...seenEdges.values()] };
  } else {
    graph = await getGraph();
  }

  let viewText = "";
  if (req.viewId) {
    try {
      const view = await runView(req.viewId);
      viewText = `\n\n## Saved view: ${view.view.name}\n${JSON.stringify(view, null, 2)}`;
    } catch {
      viewText = `\n\n(Requested view "${req.viewId}" could not be run.)`;
    }
  }

  const text = [
    "## Graph nodes",
    JSON.stringify(graph.nodes, null, 2),
    "## Graph edges",
    JSON.stringify(graph.edges, null, 2),
    viewText,
  ].join("\n");

  return { text, graph };
}
