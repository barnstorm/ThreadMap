# ThreadMap — Data Model

The canonical definitions live in `packages/shared/src`. This is the reference.

## Node types (13)

| Type            | Meaning                                                              |
| --------------- | ------------------------------------------------------------------- |
| Initiative      | A broad technical or business outcome.                              |
| Capability      | A functional ability required by an initiative.                     |
| Workstream      | A bounded body of work that can be owned and delegated.             |
| Pipeline Stage  | A stage in a packet/request/data/control pipeline.                  |
| Network Element | A deployable or operational network component.                      |
| Technology      | A mechanism, protocol, subsystem, or implementation approach.       |
| Ticket          | An external tracking item (Jira/Linear/GitHub).                     |
| Doc             | A design, runbook, note, architecture doc, or decision record.      |
| Code Area       | A repo, module, service, path, component, package, or subsystem.    |
| Person          | An engineer, stakeholder, reviewer, or owner.                       |
| Milestone       | An observable checkpoint with evidence of progress.                 |
| Risk            | A technical/schedule/ownership/dependency/operational risk.         |
| Decision        | A decision point, tradeoff, or unresolved question.                 |

## Edge types (14)

Directional `source → target`. Suggested endpoint types drive the capture UI's ranking but
are not hard constraints (the human is never blocked from capturing reality).

| Type               | Meaning                                                  | Example |
| ------------------ | -------------------------------------------------------- | ------- |
| `PART_OF`          | Smaller unit → larger one.                               | AQM PART_OF Customer QoS Enforcement |
| `IMPLEMENTS`       | Work → capability it realizes.                           | Add WRED IMPLEMENTS AQM |
| `DEPENDS_ON`       | Dependency.                                              | CIR validation DEPENDS_ON queue telemetry |
| `BLOCKS`           | Blocking impact.                                         | Missing telemetry BLOCKS rollout |
| `OWNED_BY`         | Work → accountable person.                               | Add WRED OWNED_BY Alice |
| `TRACKED_BY`       | Work → ticket.                                           | Add WRED TRACKED_BY JIRA-1234 |
| `DOCUMENTED_IN`    | Work/capability/decision → doc.                          | QoS architecture DOCUMENTED_IN design doc |
| `TOUCHES`          | Work → code area / pipeline stage / network element.     | Add WRED TOUCHES egress queue management |
| `USES`             | Work/capability → technology.                            | AQM USES WRED |
| `VALIDATED_BY`     | Capability/workstream → validation evidence.             | CIR enforcement VALIDATED_BY congestion test plan |
| `HAS_MILESTONE`    | Work → observable checkpoint.                            | Add WRED HAS_MILESTONE lab validation complete |
| `HAS_RISK`         | Work/capability/initiative → risk.                       | Customer QoS Enforcement HAS_RISK inconsistent behavior |
| `REQUIRES_DECISION`| Work → unresolved decision.                              | AQM rollout REQUIRES_DECISION RED vs WRED defaults |
| `DELEGATED_TO`     | Workstream → person taking execution ownership.          | Queue telemetry DELEGATED_TO Bob |

## Node fields

**Required:** `id`, `type`, `title`, `createdAt`, `updatedAt`.

**Optional (any node):** `note`, `owner`, `status`, `reviewDate`, `dueDate`, `url`,
`repoPath`, `externalRef`, `riskLevel` (`low|medium|high`), `confidence` (`low|medium|high`),
`tags[]`.

## Workstream delegation fields

Stored under `workstream` on Workstream nodes (flattened to `ws_*` / `smart_*` in Neo4j):

`outcome`, `currentOwner`, `proposedDelegate`, `currentStatus`, `nextMilestone`,
`successCriteria`, `escalationCriteria`, `definitionOfDone`, `seniorIcRole`, `delegateRole`,
`readiness`, `decisionBoundary`, and `smart { specific, measurable, achievable, relevant, timeBound }`.

- **Readiness states:** Keep · Delegate Now · Delegate After Context Transfer · Split Ownership · Drop or Defer.
- **Decision boundaries:** Delegate Decides · Delegate Recommends · Senior IC Decides.

## Edge fields

**Required:** `id`, `type`, `source`, `target`, `createdAt`, `updatedAt`.
**Optional:** `note`, `status`, `confidence`.

## Delegation readiness

A Workstream is *delegation-ready* when all hold: an owner or proposed owner; a supported
capability (`IMPLEMENTS`/`PART_OF` → Capability/Initiative); a clear outcome; a next
milestone (`HAS_MILESTONE` edge or `nextMilestone`); success criteria; escalation rules; a
review date; and acknowledged risks (`HAS_RISK` edge, a `riskLevel`, or a set readiness).

## API surface

```
GET    /health
GET    /api/meta                       # the whole closed schema, for a data-driven UI
GET    /api/graph                      # all nodes + edges (canvas)
GET    /api/nodes        ?type&q&tag
POST   /api/nodes
GET    /api/nodes/:id
GET    /api/nodes/:id/neighborhood ?depth
GET    /api/nodes/:id/readiness        # Workstreams only
PATCH  /api/nodes/:id                  # null clears a field
DELETE /api/nodes/:id
GET    /api/edges  · POST /api/edges · GET/PATCH/DELETE /api/edges/:id
GET    /api/views                      # catalog
GET    /api/views/:id                  # run a saved view
GET    /api/llm/status                 # enabled? model? built-in questions
POST   /api/llm/ask                    # optional, read-only; returns structured answer + proposed edits
```
