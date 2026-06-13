import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  EDGE_TYPES,
  type LlmAnswer,
  type LlmRequest,
  type LlmResponse,
  NODE_TYPES,
} from "@threadmap/shared";
import { config } from "../config.js";
import { buildContext } from "./context.js";

const SYSTEM = `You are the ThreadMap sidecar — an optional, READ-ONLY assistant that interrogates a
senior IC's delegation mind map stored as a typed graph in Neo4j.

Hard rules:
- You NEVER mutate the graph. You may only PROPOSE edits, which a human approves.
- Separate what you know by source. Every answer is a single JSON object with exactly these keys:
  - "summary": optional short prose overview.
  - "factsFromGraph": string[] — facts directly present in the supplied nodes/edges.
  - "factsFromReferences": string[] — facts from linked docs/tickets/code references (only if their content was provided; otherwise leave empty).
  - "inferences": string[] — reasonable conclusions from graph structure, clearly labelled as inference.
  - "unknowns": string[] — missing information. Do NOT invent data; if it is not in the graph, it is an unknown.
  - "proposedEdits": array of edit proposals requiring human approval. Each item is one of:
      {"kind":"createNode","rationale":string,"node":{"type":NodeType,"title":string,...optional fields}}
      {"kind":"updateNode","rationale":string,"nodeId":string,"changes":{...fields}}
      {"kind":"createEdge","rationale":string,"edge":{"type":EdgeType,"source":nodeId,"target":nodeId}}
      {"kind":"updateEdge","rationale":string,"edgeId":string,"changes":{...fields}}
- NodeType is one of: ${NODE_TYPES.join(", ")}.
- EdgeType is one of: ${EDGE_TYPES.join(", ")}.
- Output ONLY the JSON object. No markdown, no code fences, no prose outside the JSON.`;

// Tolerant validation: keep well-formed edits, drop malformed ones.
const nodeInput = z
  .object({ type: z.enum(NODE_TYPES), title: z.string() })
  .passthrough();
const edgeInput = z
  .object({ type: z.enum(EDGE_TYPES), source: z.string(), target: z.string() })
  .passthrough();

const proposedEdit = z.union([
  z.object({ kind: z.literal("createNode"), rationale: z.string(), node: nodeInput }),
  z.object({ kind: z.literal("updateNode"), rationale: z.string(), nodeId: z.string(), changes: z.record(z.unknown()) }),
  z.object({ kind: z.literal("createEdge"), rationale: z.string(), edge: edgeInput }),
  z.object({ kind: z.literal("updateEdge"), rationale: z.string(), edgeId: z.string(), changes: z.record(z.unknown()) }),
]);

const answerSchema = z.object({
  summary: z.string().optional(),
  factsFromGraph: z.array(z.string()).default([]),
  factsFromReferences: z.array(z.string()).default([]),
  inferences: z.array(z.string()).default([]),
  unknowns: z.array(z.string()).default([]),
  proposedEdits: z.array(z.unknown()).default([]),
});

const EMPTY_ANSWER: LlmAnswer = {
  factsFromGraph: [],
  factsFromReferences: [],
  inferences: [],
  unknowns: [],
  proposedEdits: [],
};

function stripFences(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  return trimmed;
}

function coerceAnswer(raw: string): LlmAnswer {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    // The model returned prose; surface it as a summary rather than failing.
    return { ...EMPTY_ANSWER, summary: raw.trim() };
  }
  const result = answerSchema.safeParse(parsed);
  if (!result.success) return { ...EMPTY_ANSWER, summary: typeof raw === "string" ? raw.trim() : undefined };

  // Validate proposed edits individually; keep only the well-formed ones.
  const edits = result.data.proposedEdits
    .map((e) => proposedEdit.safeParse(e))
    .filter((r): r is z.SafeParseSuccess<z.infer<typeof proposedEdit>> => r.success)
    .map((r) => r.data as unknown as LlmAnswer["proposedEdits"][number]);

  return {
    summary: result.data.summary,
    factsFromGraph: result.data.factsFromGraph,
    factsFromReferences: result.data.factsFromReferences,
    inferences: result.data.inferences,
    unknowns: result.data.unknowns,
    proposedEdits: edits,
  };
}

export async function askSidecar(req: LlmRequest): Promise<LlmResponse> {
  if (!config.llm.enabled) {
    return { answer: EMPTY_ANSWER, model: config.llm.model, disabled: true };
  }

  const client = new Anthropic({ apiKey: config.llm.apiKey });
  const { text } = await buildContext(req);

  const userContent = `Question: ${req.question}\n\nHere is the graph context (read-only):\n\n${text}`;

  // Stream and collect: graph context can be large, and adaptive thinking plus a
  // generous max_tokens keep us clear of request timeouts.
  const stream = client.messages.stream({
    model: config.llm.model,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    messages: [{ role: "user", content: userContent }],
  });
  const message = await stream.finalMessage();

  const textOut = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  return { answer: coerceAnswer(textOut), model: message.model };
}
