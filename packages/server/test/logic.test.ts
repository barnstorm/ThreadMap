import { describe, expect, it } from "vitest";
import {
  EDGE_TYPES,
  NODE_TYPES,
  VIEWS,
  VIEW_IDS,
  computeReadiness,
  getView,
  suggestEdgeTypes,
} from "@threadmap/shared";
import type { GraphNode } from "@threadmap/shared";
import { nodeToProps, propsToEdge, propsToNode } from "../src/db/mapping.js";
import { createNodeSchema, updateNodeSchema } from "../src/validation.js";

const ts = "2026-06-13T00:00:00.000Z";

function workstream(overrides: Partial<GraphNode> = {}): GraphNode {
  return { id: "w1", type: "Workstream", title: "WS", createdAt: ts, updatedAt: ts, ...overrides };
}

describe("delegation readiness", () => {
  const fullCtx = { hasCapabilityLink: true, hasMilestone: true, hasOwner: true, riskAcknowledged: true };

  it("is not ready when fields and context are empty", () => {
    const report = computeReadiness(workstream(), {
      hasCapabilityLink: false,
      hasMilestone: false,
      hasOwner: false,
      riskAcknowledged: false,
    });
    expect(report.ready).toBe(false);
    expect(report.metCount).toBe(0);
  });

  it("is ready when all requirements are satisfied via fields + context", () => {
    const node = workstream({
      reviewDate: "2026-07-01",
      workstream: {
        outcome: "ship it",
        successCriteria: "passes test",
        escalationCriteria: "ping IC",
      },
    });
    const report = computeReadiness(node, fullCtx);
    expect(report.ready).toBe(true);
    expect(report.metCount).toBe(report.total);
  });

  it("counts a field-provided owner even without an OWNED_BY edge", () => {
    const node = workstream({ workstream: { currentOwner: "Alice" } });
    const report = computeReadiness(node, { ...fullCtx, hasOwner: false });
    expect(report.requirements.find((r) => r.key === "owner")?.met).toBe(true);
  });
});

describe("edge type suggestion", () => {
  it("ranks IMPLEMENTS first for Workstream -> Capability", () => {
    const ranked = suggestEdgeTypes("Workstream", "Capability");
    expect(ranked[0]).toBe("IMPLEMENTS");
  });

  it("ranks OWNED_BY/DELEGATED_TO near the top for Workstream -> Person", () => {
    const ranked = suggestEdgeTypes("Workstream", "Person");
    expect(ranked.slice(0, 3)).toContain("OWNED_BY");
  });

  it("returns every edge type regardless of input", () => {
    expect(suggestEdgeTypes()).toHaveLength(EDGE_TYPES.length);
  });
});

describe("node property mapping round-trip", () => {
  it("flattens and reconstructs a workstream with nested smart fields", () => {
    const node = workstream({
      note: "n",
      riskLevel: "high",
      tags: ["qos", "edge"],
      workstream: {
        outcome: "o",
        readiness: "Delegate Now",
        decisionBoundary: "Delegate Recommends",
        smart: { specific: "s", measurable: "m" },
      },
    });
    const props = nodeToProps(node);
    expect(props.ws_outcome).toBe("o");
    expect(props.smart_specific).toBe("s");
    const back = propsToNode(props);
    expect(back.workstream?.outcome).toBe("o");
    expect(back.workstream?.smart?.measurable).toBe("m");
    expect(back.tags).toEqual(["qos", "edge"]);
    expect(back.riskLevel).toBe("high");
  });

  it("passes null through for field clearing", () => {
    const props = nodeToProps({ note: null } as never);
    expect(props.note).toBeNull();
  });

  it("reconstructs an edge from props", () => {
    const edge = propsToEdge({ id: "e1", createdAt: ts, updatedAt: ts, note: "x" }, "IMPLEMENTS", "a", "b");
    expect(edge).toMatchObject({ id: "e1", type: "IMPLEMENTS", source: "a", target: "b", note: "x" });
  });
});

describe("views catalog", () => {
  it("has 12 views with unique ids", () => {
    expect(VIEWS).toHaveLength(12);
    expect(new Set(VIEW_IDS).size).toBe(VIEWS.length);
  });

  it("resolves views by id", () => {
    expect(getView("delegate-now")?.name).toBe("Delegate Now");
    expect(getView("nope")).toBeUndefined();
  });
});

describe("validation", () => {
  it("requires a title and a valid type", () => {
    expect(createNodeSchema.safeParse({ type: "Workstream", title: "x" }).success).toBe(true);
    expect(createNodeSchema.safeParse({ type: "Nope", title: "x" }).success).toBe(false);
    expect(createNodeSchema.safeParse({ type: "Workstream", title: "" }).success).toBe(false);
  });

  it("accepts null to clear fields on update", () => {
    expect(updateNodeSchema.safeParse({ note: null }).success).toBe(true);
  });

  it("knows all node and edge types", () => {
    expect(NODE_TYPES).toContain("Workstream");
    expect(EDGE_TYPES).toContain("DELEGATED_TO");
  });
});
