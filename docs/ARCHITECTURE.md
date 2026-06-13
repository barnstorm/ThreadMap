# ThreadMap — Architecture

## Principles

1. **Human captures truth. Graph stores structure. Model interrogates later.**
2. **Manual-first.** The common loop (create node → type → title → draw edge → review)
   never requires an LLM and never blocks on perfect data.
3. **Local-first, BYO-Neo4j.** Everything runs on the user's machine against a Neo4j they
   provide (local container or remote). No cloud dependency.
4. **The LLM is an optional interface, not a core element.** It is read-only with respect
   to the graph and can only *propose* edits for human approval.

## Shape

```
packages/shared ── typed schema + delegation model + view catalog (no runtime deps)
       │
       ├── packages/server ── Fastify + neo4j-driver
       │       routes/   meta, nodes, edges, views, llm
       │       repositories/  nodeRepo, edgeRepo, viewRepo, readinessRepo
       │       db/  driver (single :ThreadNode label), mapping (flatten/unflatten)
       │       llm/  context (read-only slice), sidecar (Anthropic, propose-only)
       │
       └── packages/web ── React + Cytoscape
               CaptureBar · GraphCanvas · Inspector (delegation fields + readiness)
               ViewsPanel · Sidecar (optional)
```

## Data model in Neo4j

All nodes share a single `:ThreadNode` label with a `type` property (one of the 13 node
types) and a unique `id`. This keeps cross-type queries and constraints simple
(`CREATE CONSTRAINT … REQUIRE n.id IS UNIQUE`, plus an index on `type`).

Edges use the 14 relationship types directly as Neo4j relationship types. Because Cypher
cannot parameterize a relationship type, the server validates every type against the closed
schema whitelist before interpolating it — there is no injection surface.

Nested model fields (a Workstream's `workstream` object and its `smart` sub-object) are
flattened onto the node with stable `ws_` / `smart_` prefixes on write and reconstructed on
read (`db/mapping.ts`). Updates use `SET n += $props` and `REMOVE` for explicitly-cleared
(`null`) fields.

## Saved views

Each of the 12 views is a hand-written Cypher query in `repositories/viewRepo.ts`, returning
one of three shapes: a flat **list** of nodes, **groups** (`{key, items[]}`), or a **graph**
(nodes + edges) for the canvas. The view catalog (ids, names, descriptions, shapes) lives in
`shared` so the server and web agree on the contract.

## Delegation readiness

`shared/readiness.ts` is a pure function: given a Workstream node and four graph-derived
flags (has a capability link, has a milestone, has an owner, risks acknowledged — computed in
`readinessRepo.ts`), it returns a checklist and a ready/not-ready verdict. Pure logic in
`shared` is unit-tested without a database.

## LLM sidecar (optional)

`config.llm.enabled` is `false` whenever `ANTHROPIC_API_KEY` is unset; the whole feature
degrades to a friendly "off" state. When enabled:

- `llm/context.ts` assembles a **read-only** slice of the graph (focus-node neighborhoods, a
  saved-view result, or the whole — small — graph).
- `llm/sidecar.ts` calls the Anthropic Messages API (`claude-opus-4-8` by default, adaptive
  thinking, streamed) with a system prompt that forces the structured contract: facts from
  graph / facts from references / inferences / unknowns / proposed edits.
- Proposed edits are validated and surfaced in the UI; **nothing is applied without explicit
  human approval**, at which point the UI calls the ordinary CRUD endpoints.

The sidecar imports from the repositories but the repositories never import the sidecar — the
dependency only points one way, so the core has no knowledge of the LLM.

## Testing & verification

- `packages/server/test/logic.test.ts` unit-tests the pure logic (readiness, edge-type
  suggestion, node/edge mapping round-trips, the view catalog, validation) — no DB required.
- Integration against a live Neo4j: `npm run neo4j:up && npm run seed`, then exercise the API
  (`/health`, `/api/graph`, `/api/views/:id`) and the web app. The seed dataset is built to
  light up every view.

## Possible (non-core) extension: vector RAG

Neo4j 5 ships native vector indexes. A future, opt-in layer could store embeddings of Doc /
Ticket / Code Area / Note content on the same nodes and let the sidecar surface
semantically-related items into the mind map (and use a node's neighborhood to query the
vector store). This would reuse the existing store and keep the LLM read-only/propose-only.
It is intentionally **out of the core** — a capability that can be added, not a pillar of the
design.
