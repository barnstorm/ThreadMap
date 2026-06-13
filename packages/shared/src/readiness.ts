import type { GraphNode } from "./types.js";

/**
 * Graph-derived context needed to judge whether a Workstream is
 * delegation-ready. The server computes these flags from incident edges so
 * the readiness logic itself stays pure and testable.
 */
export interface ReadinessContext {
  /** IMPLEMENTS or PART_OF edge to a Capability/Initiative. */
  hasCapabilityLink: boolean;
  /** HAS_MILESTONE edge, or a non-empty nextMilestone field. */
  hasMilestone: boolean;
  /** OWNED_BY / DELEGATED_TO edge, or an owner/currentOwner/proposedDelegate field. */
  hasOwner: boolean;
  /** HAS_RISK edge, or riskLevel set (= risks acknowledged, even if "none"). */
  riskAcknowledged: boolean;
}

export interface ReadinessRequirement {
  key: string;
  label: string;
  met: boolean;
}

export interface ReadinessReport {
  requirements: ReadinessRequirement[];
  metCount: number;
  total: number;
  /** True when every requirement is satisfied. */
  ready: boolean;
}

const nonEmpty = (v?: string): boolean => typeof v === "string" && v.trim().length > 0;

/**
 * A Workstream is delegation-ready when it has:
 *   owner/proposed owner, a supported capability, a clear outcome,
 *   a next milestone, success criteria, escalation rules, a review date,
 *   and acknowledged risks (or confirmation none are known).
 */
export function computeReadiness(node: GraphNode, ctx: ReadinessContext): ReadinessReport {
  const ws = node.workstream ?? {};
  const requirements: ReadinessRequirement[] = [
    {
      key: "owner",
      label: "Owner or proposed owner",
      met: ctx.hasOwner || nonEmpty(node.owner) || nonEmpty(ws.currentOwner) || nonEmpty(ws.proposedDelegate),
    },
    { key: "capability", label: "Supports a capability", met: ctx.hasCapabilityLink },
    { key: "outcome", label: "Clear outcome", met: nonEmpty(ws.outcome) },
    {
      key: "milestone",
      label: "Next milestone",
      met: ctx.hasMilestone || nonEmpty(ws.nextMilestone),
    },
    { key: "success", label: "Success criteria", met: nonEmpty(ws.successCriteria) },
    { key: "escalation", label: "Escalation rules", met: nonEmpty(ws.escalationCriteria) },
    {
      key: "review",
      label: "Review date",
      met: nonEmpty(node.reviewDate),
    },
    {
      key: "risk",
      label: "Risks acknowledged",
      met: ctx.riskAcknowledged || nonEmpty(node.riskLevel) || nonEmpty(ws.readiness),
    },
  ];
  const metCount = requirements.filter((r) => r.met).length;
  return { requirements, metCount, total: requirements.length, ready: metCount === requirements.length };
}
