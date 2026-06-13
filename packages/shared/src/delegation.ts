/**
 * Delegation model: readiness states, decision boundaries, SMART framing,
 * and the cognitive-load split. These make delegation explicit, which is the
 * core value of ThreadMap.
 */

export const READINESS_STATES = [
  "Keep",
  "Delegate Now",
  "Delegate After Context Transfer",
  "Split Ownership",
  "Drop or Defer",
] as const;

export type ReadinessState = (typeof READINESS_STATES)[number];

export const READINESS_META: Record<ReadinessState, { description: string; useWhen: string[] }> = {
  Keep: {
    description: "The senior IC should retain ownership.",
    useWhen: [
      "architecture direction",
      "cross-team alignment",
      "high-risk tradeoffs",
      "ambiguous strategy",
      "stakeholder commitment",
    ],
  },
  "Delegate Now": {
    description: "The work is bounded enough to hand off.",
    useWhen: ["clear outcome", "recoverable failure modes", "sufficient context", "observable milestone"],
  },
  "Delegate After Context Transfer": {
    description: "The work is delegateable but needs setup first.",
    useWhen: ["missing context", "missing docs", "missing acceptance criteria", "missing initial milestone", "unclear decision boundaries"],
  },
  "Split Ownership": {
    description: "The senior IC owns the outcome or architecture; another person owns execution.",
    useWhen: ["owner keeps the outcome", "delegate runs execution"],
  },
  "Drop or Defer": {
    description: "The work may not be worth carrying right now.",
    useWhen: ["low value", "no near-term window", "better revisited later"],
  },
};

export function isReadinessState(value: string): value is ReadinessState {
  return (READINESS_STATES as readonly string[]).includes(value);
}

/** Who is allowed to decide on a workstream. */
export const DECISION_BOUNDARIES = ["Delegate Decides", "Delegate Recommends", "Senior IC Decides"] as const;

export type DecisionBoundary = (typeof DECISION_BOUNDARIES)[number];

export const DECISION_BOUNDARY_META: Record<DecisionBoundary, string> = {
  "Delegate Decides": "The delegate may decide independently.",
  "Delegate Recommends": "The delegate should investigate and bring a recommendation.",
  "Senior IC Decides": "The senior IC must decide due to architectural, strategic, or cross-team impact.",
};

export function isDecisionBoundary(value: string): value is DecisionBoundary {
  return (DECISION_BOUNDARIES as readonly string[]).includes(value);
}

/** Generic graded levels used for risk and confidence. */
export const LEVELS = ["low", "medium", "high"] as const;
export type Level = (typeof LEVELS)[number];

/**
 * SMART goal framing for a delegated workstream. Each field is free text; the
 * readiness checks only care whether they are present, not their wording.
 */
export interface SmartFraming {
  specific?: string; // What exactly should be produced or changed?
  measurable?: string; // How will completion or success be observed?
  achievable?: string; // Is the scope appropriate for the owner?
  relevant?: string; // Which initiative or capability does this support?
  timeBound?: string; // When is the next checkpoint or target delivery date?
}

export const SMART_FIELDS: { key: keyof SmartFraming; label: string; prompt: string }[] = [
  { key: "specific", label: "Specific", prompt: "What exactly should be produced or changed?" },
  { key: "measurable", label: "Measurable", prompt: "How will completion or success be observed?" },
  { key: "achievable", label: "Achievable", prompt: "Is the scope appropriate for the owner?" },
  { key: "relevant", label: "Relevant", prompt: "Which initiative or capability does this support?" },
  { key: "timeBound", label: "Time-Bound", prompt: "When is the next checkpoint or target delivery date?" },
];

/**
 * The cognitive-load split: a small set of signals the senior IC monitors,
 * versus the implementation details they deliberately do NOT think about.
 * These are descriptive constants the UI surfaces; they are not stored per node.
 */
export const MONITOR_SIGNALS = [
  "milestone date",
  "risk level",
  "blocked state",
  "missing owner",
  "decision required",
] as const;

export const DO_NOT_THINK_ABOUT = [
  "exact implementation sequence",
  "local refactors",
  "test fixture details",
  "internal task ordering",
  "routine code choices",
] as const;
