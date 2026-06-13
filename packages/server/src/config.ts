import "dotenv/config";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  neo4j: {
    uri: required("NEO4J_URI", "bolt://localhost:7687"),
    user: required("NEO4J_USER", "neo4j"),
    password: required("NEO4J_PASSWORD", "threadmap-dev"),
    database: process.env.NEO4J_DATABASE ?? "neo4j",
  },
  llm: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    model: process.env.THREADMAP_LLM_MODEL ?? "claude-opus-4-8",
    get enabled() {
      return this.apiKey.length > 0;
    },
  },
};
