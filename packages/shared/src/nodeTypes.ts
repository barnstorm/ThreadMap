/**
 * The 13 typed node kinds ThreadMap supports.
 *
 * The graph is deliberately constrained: every node MUST be one of these
 * types. New types should be added rarely and on purpose — vague nodes
 * defeat the point of a typed delegation graph.
 */
export const NODE_TYPES = [
  "Initiative",
  "Capability",
  "Workstream",
  "PipelineStage",
  "NetworkElement",
  "Technology",
  "Ticket",
  "Doc",
  "CodeArea",
  "Person",
  "Milestone",
  "Risk",
  "Decision",
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

export function isNodeType(value: string): value is NodeType {
  return (NODE_TYPES as readonly string[]).includes(value);
}

export interface NodeTypeMeta {
  type: NodeType;
  label: string;
  description: string;
  /** A short hint shown in fast-capture pickers. */
  examples: string[];
  /** Stable accent color used by the UI. */
  color: string;
}

export const NODE_TYPE_META: Record<NodeType, NodeTypeMeta> = {
  Initiative: {
    type: "Initiative",
    label: "Initiative",
    description: "A broad technical or business outcome.",
    examples: ["Customer QoS Enforcement", "Platform Observability", "Control Plane Reliability"],
    color: "#6366f1",
  },
  Capability: {
    type: "Capability",
    label: "Capability",
    description: "A functional ability required by an initiative.",
    examples: ["CIR enforcement", "AQM", "Queue telemetry"],
    color: "#0ea5e9",
  },
  Workstream: {
    type: "Workstream",
    label: "Workstream",
    description: "A bounded body of work that can be owned and delegated.",
    examples: ["Add WRED support to aggregation router", "Build queue telemetry dashboard"],
    color: "#10b981",
  },
  PipelineStage: {
    type: "PipelineStage",
    label: "Pipeline Stage",
    description: "A stage in a packet, request, data, or control pipeline.",
    examples: ["Ingress classification", "Policing", "Queue management", "Egress shaping"],
    color: "#f59e0b",
  },
  NetworkElement: {
    type: "NetworkElement",
    label: "Network Element",
    description: "A deployable or operational network component.",
    examples: ["BNG", "Edge router", "Aggregation router", "Access device"],
    color: "#8b5cf6",
  },
  Technology: {
    type: "Technology",
    label: "Technology",
    description: "A technical mechanism, protocol, subsystem, or implementation approach.",
    examples: ["HTB", "RED", "WRED", "ECN", "Linux TC", "DPDK"],
    color: "#14b8a6",
  },
  Ticket: {
    type: "Ticket",
    label: "Ticket",
    description: "An external tracking item (Jira, Linear, GitHub issue).",
    examples: ["JIRA-1234", "LIN-42", "gh#987"],
    color: "#64748b",
  },
  Doc: {
    type: "Doc",
    label: "Doc",
    description: "A design, runbook, note, architecture document, or decision record.",
    examples: ["QoS architecture", "WRED runbook", "ADR-0007"],
    color: "#475569",
  },
  CodeArea: {
    type: "CodeArea",
    label: "Code Area",
    description: "A repo, module, service, path, component, package, function, or subsystem.",
    examples: ["egress/queue_mgmt", "tc-shaper", "qos-config-model"],
    color: "#ef4444",
  },
  Person: {
    type: "Person",
    label: "Person",
    description: "An engineer, stakeholder, reviewer, or owner.",
    examples: ["Alice", "Bob", "Platform PM"],
    color: "#ec4899",
  },
  Milestone: {
    type: "Milestone",
    label: "Milestone",
    description: "An observable checkpoint with evidence of progress.",
    examples: ["Lab validation complete", "Canary at 5%", "GA"],
    color: "#22c55e",
  },
  Risk: {
    type: "Risk",
    label: "Risk",
    description: "A technical, schedule, ownership, dependency, or operational risk.",
    examples: ["Inconsistent platform behavior", "Single maintainer"],
    color: "#f97316",
  },
  Decision: {
    type: "Decision",
    label: "Decision",
    description: "A decision point, tradeoff, or unresolved question.",
    examples: ["RED vs WRED defaults", "Per-queue vs per-class shaping"],
    color: "#eab308",
  },
};
