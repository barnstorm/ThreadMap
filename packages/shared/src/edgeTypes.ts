import type { NodeType } from "./nodeTypes.js";

/**
 * The 14 typed relationship kinds. Edges are directional (source -> target).
 *
 * Each edge declares which source/target node types are *suggested*. The UI
 * uses these to rank edge-type choices during fast capture; the server treats
 * them as guidance, not hard constraints, so the human is never blocked by
 * the schema when capturing reality.
 */
export const EDGE_TYPES = [
  "PART_OF",
  "IMPLEMENTS",
  "DEPENDS_ON",
  "BLOCKS",
  "OWNED_BY",
  "TRACKED_BY",
  "DOCUMENTED_IN",
  "TOUCHES",
  "USES",
  "VALIDATED_BY",
  "HAS_MILESTONE",
  "HAS_RISK",
  "REQUIRES_DECISION",
  "DELEGATED_TO",
] as const;

export type EdgeType = (typeof EDGE_TYPES)[number];

export function isEdgeType(value: string): value is EdgeType {
  return (EDGE_TYPES as readonly string[]).includes(value);
}

export interface EdgeTypeMeta {
  type: EdgeType;
  label: string;
  description: string;
  example: string;
  /** Suggested source node types ([] = any). */
  sourceTypes: NodeType[];
  /** Suggested target node types ([] = any). */
  targetTypes: NodeType[];
}

export const EDGE_TYPE_META: Record<EdgeType, EdgeTypeMeta> = {
  PART_OF: {
    type: "PART_OF",
    label: "part of",
    description: "Connects a smaller unit to a larger one.",
    example: "AQM PART_OF Customer QoS Enforcement",
    sourceTypes: ["Capability", "Workstream", "PipelineStage"],
    targetTypes: ["Initiative", "Capability"],
  },
  IMPLEMENTS: {
    type: "IMPLEMENTS",
    label: "implements",
    description: "Connects work to the capability it realizes.",
    example: "Add WRED support IMPLEMENTS AQM",
    sourceTypes: ["Workstream"],
    targetTypes: ["Capability"],
  },
  DEPENDS_ON: {
    type: "DEPENDS_ON",
    label: "depends on",
    description: "Represents a dependency.",
    example: "CIR validation DEPENDS_ON queue telemetry",
    sourceTypes: [],
    targetTypes: [],
  },
  BLOCKS: {
    type: "BLOCKS",
    label: "blocks",
    description: "Represents blocking impact.",
    example: "Missing telemetry BLOCKS production rollout",
    sourceTypes: [],
    targetTypes: [],
  },
  OWNED_BY: {
    type: "OWNED_BY",
    label: "owned by",
    description: "Connects work to the accountable person.",
    example: "Add WRED support OWNED_BY Alice",
    sourceTypes: ["Workstream", "Initiative", "Capability"],
    targetTypes: ["Person"],
  },
  TRACKED_BY: {
    type: "TRACKED_BY",
    label: "tracked by",
    description: "Connects work to a ticket.",
    example: "Add WRED support TRACKED_BY JIRA-1234",
    sourceTypes: ["Workstream", "Initiative", "Capability"],
    targetTypes: ["Ticket"],
  },
  DOCUMENTED_IN: {
    type: "DOCUMENTED_IN",
    label: "documented in",
    description: "Connects work, capability, or decision to a doc.",
    example: "QoS architecture DOCUMENTED_IN design doc",
    sourceTypes: ["Workstream", "Initiative", "Capability", "Decision"],
    targetTypes: ["Doc"],
  },
  TOUCHES: {
    type: "TOUCHES",
    label: "touches",
    description: "Connects work to a code area, pipeline stage, or network element.",
    example: "Add WRED support TOUCHES egress queue management",
    sourceTypes: ["Workstream", "Capability"],
    targetTypes: ["CodeArea", "PipelineStage", "NetworkElement"],
  },
  USES: {
    type: "USES",
    label: "uses",
    description: "Connects work or capability to a technology.",
    example: "AQM USES WRED",
    sourceTypes: ["Workstream", "Capability"],
    targetTypes: ["Technology"],
  },
  VALIDATED_BY: {
    type: "VALIDATED_BY",
    label: "validated by",
    description: "Connects capability or workstream to validation evidence.",
    example: "CIR enforcement VALIDATED_BY congestion test plan",
    sourceTypes: ["Capability", "Workstream"],
    targetTypes: ["Doc", "Milestone", "Ticket"],
  },
  HAS_MILESTONE: {
    type: "HAS_MILESTONE",
    label: "has milestone",
    description: "Connects work to observable checkpoints.",
    example: "Add WRED support HAS_MILESTONE lab validation complete",
    sourceTypes: ["Workstream", "Initiative", "Capability"],
    targetTypes: ["Milestone"],
  },
  HAS_RISK: {
    type: "HAS_RISK",
    label: "has risk",
    description: "Connects work, capability, or initiative to a risk.",
    example: "Customer QoS Enforcement HAS_RISK inconsistent platform behavior",
    sourceTypes: ["Workstream", "Initiative", "Capability"],
    targetTypes: ["Risk"],
  },
  REQUIRES_DECISION: {
    type: "REQUIRES_DECISION",
    label: "requires decision",
    description: "Connects work to an unresolved decision.",
    example: "AQM rollout REQUIRES_DECISION RED vs WRED defaults",
    sourceTypes: ["Workstream", "Initiative", "Capability"],
    targetTypes: ["Decision"],
  },
  DELEGATED_TO: {
    type: "DELEGATED_TO",
    label: "delegated to",
    description: "Connects a workstream to the person taking execution ownership.",
    example: "Queue telemetry workstream DELEGATED_TO Bob",
    sourceTypes: ["Workstream"],
    targetTypes: ["Person"],
  },
};

/**
 * Rank edge types for a given source/target type pair. Exact matches on both
 * ends sort first, then partial matches, then everything else. Used by the
 * capture UI to put the most likely relationship at the top of the list.
 */
export function suggestEdgeTypes(source?: NodeType, target?: NodeType): EdgeType[] {
  const score = (meta: EdgeTypeMeta): number => {
    const srcOk = meta.sourceTypes.length === 0 || (source ? meta.sourceTypes.includes(source) : false);
    const tgtOk = meta.targetTypes.length === 0 || (target ? meta.targetTypes.includes(target) : false);
    const srcExact = source ? meta.sourceTypes.includes(source) : false;
    const tgtExact = target ? meta.targetTypes.includes(target) : false;
    const base = (srcExact ? 2 : 0) + (tgtExact ? 2 : 0) + (srcOk ? 1 : 0) + (tgtOk ? 1 : 0);
    // Tiebreak toward the more specific edge: an exact match against a narrow
    // suggested-type list (e.g. IMPLEMENTS: Workstream->Capability) beats a
    // match against a broad one (e.g. PART_OF: many sources/targets).
    const specificity =
      (srcExact ? 1 / meta.sourceTypes.length : 0) + (tgtExact ? 1 / meta.targetTypes.length : 0);
    return base + specificity * 0.5;
  };
  return [...EDGE_TYPES].sort((a, b) => score(EDGE_TYPE_META[b]) - score(EDGE_TYPE_META[a]));
}
