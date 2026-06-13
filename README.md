# ThreadMap

**A manual-first, Neo4j-backed delegation mind map for senior ICs managing many active technical threads.**

ThreadMap represents engineering work as a *typed graph* of initiatives, capabilities,
workstreams, people, docs, tickets, code areas, risks, decisions, and milestones — so a
senior IC can externalize what they're carrying, see what can be delegated, and keep
visibility into outcomes, risks, milestones, and ownership.

```
Human captures truth.   Graph stores structure.   Model interrogates later.
```

The common path **never requires an LLM**. You create typed nodes, draw typed edges, and
review delegation-oriented saved views. The LLM is an optional, read-only *interface* to
the graph — not a core part of the system, and it never mutates graph state.

---

## Local-first & BYO-Neo4j

ThreadMap runs entirely on your machine. There is no cloud service. You bring your own
Neo4j — either a **local container** (one command, fully offline) or a **remote instance**
you point the server at. Cypher is the query language throughout; the saved views and graph
traversals are native Cypher against Neo4j.

## What's here

A TypeScript monorepo:

| Package            | What it is                                                                 |
| ------------------ | ------------------------------------------------------------------------- |
| `packages/shared`  | The typed schema: 13 node types, 14 edge types, the delegation/SMART/readiness model, and the saved-view catalog. Shared by server and web. |
| `packages/server`  | Fastify + `neo4j-driver` API: typed CRUD, neighborhoods, the 12 saved views (Cypher), delegation-readiness scoring, and the optional LLM sidecar. |
| `packages/web`     | React + Cytoscape app: fast keyboard capture, graph canvas, the inspector with delegation fields, saved-view review screens, and the optional sidecar panel. |

---

## Quickstart

```bash
# 1. Install
npm install

# 2. Start a local Neo4j (or point the server at your own — see Configuration)
npm run neo4j:up          # docker compose up -d neo4j  (user/pass: neo4j / threadmap-dev)

# 3. (optional) configure
cp .env.example .env      # defaults already match the local container

# 4. Seed the Customer QoS Enforcement example (optional but recommended)
npm run seed

# 5. Run server (:4000) + web (:5173) together
npm run dev
```

Open http://localhost:5173. The web dev server proxies `/api` to the server on `:4000`.

> **No Docker?** Point `NEO4J_URI`/`NEO4J_USER`/`NEO4J_PASSWORD` at any Neo4j 5 instance
> (Aura, a remote box, an existing local install) and skip step 2.

---

## Configuration

All via environment variables (see `.env.example`):

| Variable             | Default                  | Purpose                                            |
| -------------------- | ------------------------ | -------------------------------------------------- |
| `NEO4J_URI`          | `bolt://localhost:7687`  | Your Neo4j (local container or remote).            |
| `NEO4J_USER` / `NEO4J_PASSWORD` | `neo4j` / `threadmap-dev` | Credentials.                            |
| `NEO4J_DATABASE`     | `neo4j`                  | Database name.                                     |
| `PORT`               | `4000`                   | API server port.                                   |
| `CORS_ORIGIN`        | `http://localhost:5173`  | Allowed web origin(s), comma-separated.            |
| `ANTHROPIC_API_KEY`  | *(unset)*                | **Optional.** Enables the read-only LLM sidecar. Leave unset to run fully without an LLM. |
| `THREADMAP_LLM_MODEL`| `claude-opus-4-8`        | Sidecar model.                                     |

---

## The typed graph

**13 node types:** Initiative, Capability, Workstream, Pipeline Stage, Network Element,
Technology, Ticket, Doc, Code Area, Person, Milestone, Risk, Decision.

**14 edge types:** `PART_OF`, `IMPLEMENTS`, `DEPENDS_ON`, `BLOCKS`, `OWNED_BY`,
`TRACKED_BY`, `DOCUMENTED_IN`, `TOUCHES`, `USES`, `VALIDATED_BY`, `HAS_MILESTONE`,
`HAS_RISK`, `REQUIRES_DECISION`, `DELEGATED_TO`.

Every node has `title`, `type`, `createdAt`, `updatedAt`, plus optional fields (note, owner,
status, review/due dates, URL, repo path, external ref, risk/confidence level, tags).
**Workstreams** additionally carry the full delegation model — outcome, owner/delegate,
next milestone, success & escalation criteria, definition of done, readiness state, decision
boundary, and SMART framing. See [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md).

### Delegation model

Each Workstream can be classified **Keep / Delegate Now / Delegate After Context Transfer /
Split Ownership / Drop or Defer**, given a **decision boundary** (Delegate Decides /
Recommends / Senior IC Decides) and **SMART** framing. The server computes a
*delegation-readiness* checklist (owner, supported capability, outcome, next milestone,
success criteria, escalation rules, review date, acknowledged risks) and the inspector shows
it live.

### Saved views (review & delegation)

My Carried Work · Unowned Work · Delegate Now · Needs Context Transfer · Missing Milestone ·
Missing Review Date · Risks Without Mitigation · Decisions Needed · Capability Map · Packet
Pipeline Map · Code Area Collision Map · Owner Load.

Each is a native Cypher query; clicking one lists/groups the results and highlights them on
the canvas.

---

## The LLM sidecar (optional, read-only)

The sidecar is **off unless `ANTHROPIC_API_KEY` is set**, lives entirely in
`packages/server/src/llm/` behind `/api/llm/*`, and is never touched by capture, CRUD, or
views. It can *read* selected nodes, neighborhoods, and saved views, and it *proposes* edits
— but it **never mutates the graph**. Every answer separates **facts from graph**, **facts
from references**, **inferences**, **unknowns**, and **proposed edits**, and every proposed
edit requires explicit human approval in the UI before it is applied.

> **Possible (non-core) extension:** because Neo4j 5 has native vector indexes, the same
> instance could also hold embeddings, letting the sidecar surface semantically-related
> content into the mind map and vice-versa. That's a thing that *can* be added later — it is
> deliberately **not** part of the core design.

---

## Keyboard shortcuts

| Key            | Action                          |
| -------------- | ------------------------------- |
| `c`            | Focus the capture box           |
| `/`            | Focus search                    |
| `Enter`        | Add the captured node           |
| `Esc`          | Deselect / cancel edge drawing  |

Draw an edge by selecting a node → **Draw edge from here** → clicking the target → picking
the (type-aware suggested) relationship.

---

## Acceptance tests (from the product spec)

- **Capture (< 60s):** create & link Initiative → Capability → Workstream → Person → Ticket → Milestone.
- **Delegate (< 2m):** mark a Workstream *Delegate Now*, assign a person, link a capability, give a SMART outcome, a next milestone, a review date, and escalation criteria.
- **Review (< 10s):** answer "what am I carrying / what's unowned / what needs review / what's blocked / what has no milestone / what's ready to delegate" via the saved views.

The seeded **Customer QoS Enforcement** dataset exercises every node type, edge type, and view.

---

## Scripts

```bash
npm run dev          # server + web together
npm run dev:server   # server only (tsx watch)
npm run dev:web      # web only (vite)
npm run seed         # load the QoS example into Neo4j
npm run build        # build shared, server, web
npm test             # server unit tests (vitest)
npm run typecheck    # typecheck all workspaces
npm run neo4j:up     # start local Neo4j container
npm run neo4j:down   # stop it
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for design notes and
[`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) for the full field reference.
