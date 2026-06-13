import type { FastifyInstance } from "fastify";
import { isNodeType } from "@threadmap/shared";
import {
  createNode,
  deleteNode,
  getGraph,
  getNeighborhood,
  getNode,
  listNodes,
  updateNode,
} from "../repositories/nodeRepo.js";
import { nodeReadiness } from "../repositories/readinessRepo.js";
import { createNodeSchema, updateNodeSchema } from "../validation.js";

export async function nodeRoutes(app: FastifyInstance): Promise<void> {
  // Whole graph for the canvas. Registered before /:id so "graph" isn't an id.
  app.get("/api/graph", async () => getGraph());

  app.get("/api/nodes", async (req) => {
    const q = req.query as { type?: string; q?: string; tag?: string };
    const type = q.type && isNodeType(q.type) ? q.type : undefined;
    return listNodes({ type, q: q.q, tag: q.tag });
  });

  app.post("/api/nodes", async (req, reply) => {
    const parsed = createNodeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const node = await createNode(parsed.data);
    return reply.code(201).send(node);
  });

  app.get("/api/nodes/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const node = await getNode(id);
    if (!node) return reply.code(404).send({ error: "Node not found" });
    return node;
  });

  app.get("/api/nodes/:id/neighborhood", async (req, reply) => {
    const { id } = req.params as { id: string };
    const depth = Number((req.query as { depth?: string }).depth ?? 1);
    const hood = await getNeighborhood(id, depth);
    if (!hood) return reply.code(404).send({ error: "Node not found" });
    return hood;
  });

  app.get("/api/nodes/:id/readiness", async (req, reply) => {
    const { id } = req.params as { id: string };
    const report = await nodeReadiness(id);
    if (!report) return reply.code(404).send({ error: "Workstream not found" });
    return report;
  });

  app.patch("/api/nodes/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateNodeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const node = await updateNode(id, parsed.data);
    if (!node) return reply.code(404).send({ error: "Node not found" });
    return node;
  });

  app.delete("/api/nodes/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const ok = await deleteNode(id);
    if (!ok) return reply.code(404).send({ error: "Node not found" });
    return reply.code(204).send();
  });
}
