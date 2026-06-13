import type { FastifyInstance } from "fastify";
import { createEdge, deleteEdge, getEdge, listEdges, updateEdge } from "../repositories/edgeRepo.js";
import { createEdgeSchema, updateEdgeSchema } from "../validation.js";

export async function edgeRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/edges", async () => listEdges());

  app.post("/api/edges", async (req, reply) => {
    const parsed = createEdgeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const edge = await createEdge(parsed.data);
      return reply.code(201).send(edge);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  app.get("/api/edges/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const edge = await getEdge(id);
    if (!edge) return reply.code(404).send({ error: "Edge not found" });
    return edge;
  });

  app.patch("/api/edges/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateEdgeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const edge = await updateEdge(id, parsed.data);
    if (!edge) return reply.code(404).send({ error: "Edge not found" });
    return edge;
  });

  app.delete("/api/edges/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const ok = await deleteEdge(id);
    if (!ok) return reply.code(404).send({ error: "Edge not found" });
    return reply.code(204).send();
  });
}
