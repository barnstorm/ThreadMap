import type { FastifyInstance } from "fastify";
import { SIDECAR_QUESTIONS } from "@threadmap/shared";
import { config } from "../config.js";
import { askSidecar } from "../llm/sidecar.js";
import { llmRequestSchema } from "../validation.js";

export async function llmRoutes(app: FastifyInstance): Promise<void> {
  // Lets the UI show whether the optional sidecar is configured.
  app.get("/api/llm/status", async () => ({
    enabled: config.llm.enabled,
    model: config.llm.model,
    questions: SIDECAR_QUESTIONS,
  }));

  app.post("/api/llm/ask", async (req, reply) => {
    const parsed = llmRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      return await askSidecar(parsed.data);
    } catch (err) {
      return reply.code(502).send({ error: `Sidecar error: ${(err as Error).message}` });
    }
  });
}
