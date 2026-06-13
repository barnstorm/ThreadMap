import type { FastifyInstance } from "fastify";
import { VIEWS } from "@threadmap/shared";
import { runView } from "../repositories/viewRepo.js";

export async function viewRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/views", async () => VIEWS);

  app.get("/api/views/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      return await runView(id);
    } catch (err) {
      return reply.code(404).send({ error: (err as Error).message });
    }
  });
}
