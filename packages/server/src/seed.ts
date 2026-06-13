import "dotenv/config";
import type { CreateNodeInput, EdgeType } from "@threadmap/shared";
import { buildApp, prepareDatabase } from "./app.js";
import { closeDriver, withSession } from "./db/driver.js";
import { createEdge } from "./repositories/edgeRepo.js";
import { createNode } from "./repositories/nodeRepo.js";

/**
 * Seeds the Customer QoS Enforcement example from the spec. Exercises every
 * node type, edge type, and saved view. Wipes existing ThreadNodes first so the
 * demo is reproducible — run `npm run seed`.
 */

const ids = new Map<string, string>();

async function node(input: CreateNodeInput): Promise<void> {
  const created = await createNode(input);
  ids.set(input.title, created.id);
}

async function edge(type: EdgeType, sourceTitle: string, targetTitle: string, note?: string): Promise<void> {
  const source = ids.get(sourceTitle);
  const target = ids.get(targetTitle);
  if (!source || !target) throw new Error(`Missing node for edge ${type}: ${sourceTitle} -> ${targetTitle}`);
  await createEdge({ type, source, target, note });
}

async function seed(): Promise<void> {
  await withSession((s) => s.run("MATCH (n:ThreadNode) DETACH DELETE n"));

  // Initiative
  await node({ type: "Initiative", title: "Customer QoS Enforcement", note: "Consistent QoS across the access/aggregation edge." });

  // Capabilities
  for (const title of ["CIR enforcement", "MIR enforcement", "Shaping", "AQM", "Queue telemetry", "Congestion validation"]) {
    await node({ type: "Capability", title });
  }

  // Pipeline stages
  for (const title of ["Ingress classification", "Policing", "Queue assignment", "Queue management", "Scheduling", "Egress shaping"]) {
    await node({ type: "PipelineStage", title });
  }

  // Network elements
  for (const title of ["BNG", "Edge router", "Aggregation router", "Access device"]) {
    await node({ type: "NetworkElement", title });
  }

  // Technologies
  for (const title of ["HTB", "RED", "WRED", "ECN", "Linux TC", "DPDK"]) {
    await node({ type: "Technology", title });
  }

  // People
  for (const title of ["Alice", "Bob", "Carol"]) {
    await node({ type: "Person", title });
  }

  // Code areas
  for (const title of ["egress/queue_mgmt", "tc-shaper", "qos-config-model"]) {
    await node({ type: "CodeArea", title, repoPath: `services/${title}` });
  }

  // Tickets, docs, milestone
  await node({ type: "Ticket", title: "JIRA-1234", url: "https://example.atlassian.net/browse/JIRA-1234", externalRef: "JIRA-1234" });
  await node({ type: "Ticket", title: "JIRA-1290", url: "https://example.atlassian.net/browse/JIRA-1290", externalRef: "JIRA-1290" });
  await node({ type: "Doc", title: "QoS architecture", url: "https://docs.example.com/qos-arch" });
  await node({ type: "Doc", title: "Congestion test plan", url: "https://docs.example.com/congestion-test-plan" });
  await node({ type: "Milestone", title: "Lab validation complete", dueDate: "2026-07-01" });

  // Risks — one mitigated, one not (drives Risks Without Mitigation)
  await node({ type: "Risk", title: "Inconsistent platform behavior", riskLevel: "high", note: "Mitigation: define shaping policy defaults and a conformance test." });
  await node({ type: "Risk", title: "Single maintainer for tc-shaper", riskLevel: "medium" });

  // Decision — unresolved, owned by Alice
  await node({ type: "Decision", title: "RED vs WRED defaults", owner: "Alice", status: "open", note: "Pick default AQM behavior for aggregation routers." });

  // Workstreams with delegation fields and varied readiness.
  await node({
    type: "Workstream",
    title: "Add WRED support to aggregation router",
    reviewDate: "2026-06-20",
    riskLevel: "medium",
    workstream: {
      outcome: "WRED active on aggregation routers with safe defaults.",
      currentOwner: "Alice",
      currentStatus: "in progress",
      nextMilestone: "Lab validation complete",
      successCriteria: "Drops follow WRED curve under congestion; no false drops at < 70% utilization.",
      escalationCriteria: "Escalate to senior IC if drop behavior diverges from spec by > 10%.",
      definitionOfDone: "Merged, lab-validated, runbook updated.",
      readiness: "Delegate Now",
      decisionBoundary: "Delegate Recommends",
      smart: {
        specific: "Enable WRED on egress queues of the aggregation router.",
        measurable: "Congestion test plan passes.",
        achievable: "Scoped to one platform.",
        relevant: "Implements AQM for Customer QoS Enforcement.",
        timeBound: "Lab validation by 2026-07-01.",
      },
    },
  });

  await node({
    type: "Workstream",
    title: "Build queue telemetry for egress queues",
    workstream: {
      outcome: "Per-queue depth and drop telemetry exported.",
      proposedDelegate: "Bob",
      currentStatus: "not started",
      readiness: "Delegate After Context Transfer",
      decisionBoundary: "Delegate Decides",
    },
  });

  await node({
    type: "Workstream",
    title: "Validate CIR/MIR behavior under congestion",
    reviewDate: "2026-06-18",
    workstream: {
      outcome: "Confirmed CIR/MIR enforcement under sustained congestion.",
      currentOwner: "Carol",
      currentStatus: "in progress",
      nextMilestone: "Congestion test plan signed off",
      readiness: "Split Ownership",
      seniorIcRole: "Owns acceptance criteria",
      delegateRole: "Runs the test campaign",
    },
  });

  await node({
    type: "Workstream",
    title: "Define shaping policy defaults",
    workstream: {
      outcome: "Documented default shaping policy per platform.",
      readiness: "Keep",
      currentStatus: "in progress",
    },
  });

  // Unowned, no milestone, no review date — shows in several review views.
  await node({ type: "Workstream", title: "Add customer QoS config model support" });

  // --- Edges -----------------------------------------------------------------
  // Capabilities PART_OF initiative
  for (const cap of ["CIR enforcement", "MIR enforcement", "Shaping", "AQM", "Queue telemetry", "Congestion validation"]) {
    await edge("PART_OF", cap, "Customer QoS Enforcement");
  }

  // AQM USES WRED/RED/ECN
  await edge("USES", "AQM", "WRED");
  await edge("USES", "AQM", "RED");
  await edge("USES", "AQM", "ECN");
  await edge("USES", "Shaping", "HTB");

  // Workstream IMPLEMENTS capability
  await edge("IMPLEMENTS", "Add WRED support to aggregation router", "AQM");
  await edge("IMPLEMENTS", "Build queue telemetry for egress queues", "Queue telemetry");
  await edge("IMPLEMENTS", "Validate CIR/MIR behavior under congestion", "CIR enforcement");
  await edge("IMPLEMENTS", "Define shaping policy defaults", "Shaping");

  // Ownership / delegation
  await edge("OWNED_BY", "Add WRED support to aggregation router", "Alice");
  await edge("OWNED_BY", "Validate CIR/MIR behavior under congestion", "Carol");
  await edge("DELEGATED_TO", "Build queue telemetry for egress queues", "Bob");

  // Milestones
  await edge("HAS_MILESTONE", "Add WRED support to aggregation router", "Lab validation complete");

  // Touches (code areas / pipeline stages / network elements)
  await edge("TOUCHES", "Add WRED support to aggregation router", "egress/queue_mgmt");
  await edge("TOUCHES", "Add WRED support to aggregation router", "Queue management");
  await edge("TOUCHES", "Add WRED support to aggregation router", "Aggregation router");
  await edge("TOUCHES", "Build queue telemetry for egress queues", "egress/queue_mgmt"); // collision with WRED
  await edge("TOUCHES", "Build queue telemetry for egress queues", "Queue management");
  await edge("TOUCHES", "Define shaping policy defaults", "tc-shaper");
  await edge("TOUCHES", "Define shaping policy defaults", "Egress shaping");
  await edge("TOUCHES", "Add customer QoS config model support", "qos-config-model");

  // Tickets / docs / validation
  await edge("TRACKED_BY", "Add WRED support to aggregation router", "JIRA-1234");
  await edge("TRACKED_BY", "Build queue telemetry for egress queues", "JIRA-1290");
  await edge("DOCUMENTED_IN", "Customer QoS Enforcement", "QoS architecture");
  await edge("VALIDATED_BY", "Validate CIR/MIR behavior under congestion", "Congestion test plan");

  // Risks
  await edge("HAS_RISK", "Customer QoS Enforcement", "Inconsistent platform behavior");
  await edge("HAS_RISK", "Define shaping policy defaults", "Single maintainer for tc-shaper");

  // Decisions
  await edge("REQUIRES_DECISION", "Add WRED support to aggregation router", "RED vs WRED defaults");

  // Dependencies / blocks
  await edge("DEPENDS_ON", "Validate CIR/MIR behavior under congestion", "Build queue telemetry for egress queues");
  await edge("BLOCKS", "Build queue telemetry for egress queues", "Validate CIR/MIR behavior under congestion");
}

async function main(): Promise<void> {
  const app = await buildApp();
  await prepareDatabase(app);
  await seed();
  app.log.info(`Seeded ${ids.size} nodes for the Customer QoS Enforcement example.`);
  await app.close();
  await closeDriver();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
