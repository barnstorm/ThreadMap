import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { config } from "./config.js";
import { ensureSchema, verifyConnectivity } from "./db/driver.js";
import { edgeRoutes } from "./routes/edges.js";
import { llmRoutes } from "./routes/llm.js";
import { metaRoutes } from "./routes/meta.js";
import { nodeRoutes } from "./routes/nodes.js";
import { viewRoutes } from "./routes/views.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: config.corsOrigins });

  app.get("/health", async () => {
    try {
      await verifyConnectivity();
      return { ok: true, neo4j: "connected" };
    } catch (err) {
      return { ok: false, neo4j: (err as Error).message };
    }
  });

  await app.register(metaRoutes);
  await app.register(nodeRoutes);
  await app.register(edgeRoutes);
  await app.register(viewRoutes);
  await app.register(llmRoutes);

  return app;
}

/** Verify Neo4j and apply constraints; logs a clear hint if Neo4j is down. */
export async function prepareDatabase(app: FastifyInstance): Promise<void> {
  try {
    await verifyConnectivity();
    await ensureSchema();
    app.log.info("Connected to Neo4j and ensured schema.");
  } catch (err) {
    app.log.error(
      `Could not reach Neo4j at ${config.neo4j.uri}: ${(err as Error).message}. ` +
        "ThreadMap is BYO-Neo4j — start a local container with `npm run neo4j:up` or point NEO4J_URI at your instance.",
    );
  }
}
