import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDriver, ensureSchema, withSession } from "../src/db/driver.js";
import { createEdge, deleteEdge, listEdges } from "../src/repositories/edgeRepo.js";
import { createNode, getNeighborhood, getNode } from "../src/repositories/nodeRepo.js";
import { nodeReadiness } from "../src/repositories/readinessRepo.js";
import { runView } from "../src/repositories/viewRepo.js";
import type { ViewResultGroup } from "@threadmap/shared";

/**
 * Integration smoke tests against a live Neo4j. These WIPE the target database,
 * so they are opt-in: run with `THREADMAP_IT=1 npm test` (or `npm run test:it`)
 * against a throwaway instance — e.g. `npm run neo4j:up` first.
 */
const RUN = !!process.env.THREADMAP_IT;
const ids: Record<string, string> = {};

const titles = (items?: { title: string }[]): string[] => (items ?? []).map((n) => n.title);
const group = (groups: ViewResultGroup[] | undefined, key: string) => groups?.find((g) => g.key === key);

describe.skipIf(!RUN)("integration (live Neo4j)", () => {
  beforeAll(async () => {
    await ensureSchema();
    await withSession((s) => s.run("MATCH (n:ThreadNode) DETACH DELETE n"));

    const I = await createNode({ type: "Initiative", title: "IT Initiative" });
    const C = await createNode({ type: "Capability", title: "IT Capability" });
    const P = await createNode({ type: "Person", title: "IT Alice" });
    const M = await createNode({ type: "Milestone", title: "IT Milestone" });

    // Fully delegation-ready, owned, delegate-now.
    const W1 = await createNode({
      type: "Workstream",
      title: "IT Ready Workstream",
      reviewDate: "2026-07-01",
      riskLevel: "low",
      workstream: {
        outcome: "done",
        successCriteria: "passes",
        escalationCriteria: "escalate",
        readiness: "Delegate Now",
      },
    });
    // Bare: unowned, no milestone, no review date.
    const W2 = await createNode({ type: "Workstream", title: "IT Bare Workstream" });

    const R1 = await createNode({ type: "Risk", title: "IT Mitigated Risk", note: "mitigation here" });
    const R2 = await createNode({ type: "Risk", title: "IT Open Risk" });
    const D = await createNode({ type: "Decision", title: "IT Decision", owner: "IT Alice", status: "open" });

    Object.assign(ids, { I: I.id, C: C.id, P: P.id, M: M.id, W1: W1.id, W2: W2.id, R1: R1.id, R2: R2.id, D: D.id });

    await createEdge({ type: "PART_OF", source: C.id, target: I.id });
    await createEdge({ type: "IMPLEMENTS", source: W1.id, target: C.id });
    await createEdge({ type: "OWNED_BY", source: W1.id, target: P.id });
    await createEdge({ type: "HAS_MILESTONE", source: W1.id, target: M.id });
    await createEdge({ type: "HAS_RISK", source: I.id, target: R2.id });
  });

  afterAll(async () => {
    await withSession((s) => s.run("MATCH (n:ThreadNode) DETACH DELETE n"));
    await closeDriver();
  });

  it("round-trips a workstream with nested delegation fields", async () => {
    const w = await getNode(ids.W1!);
    expect(w?.workstream?.outcome).toBe("done");
    expect(w?.workstream?.readiness).toBe("Delegate Now");
    expect(w?.reviewDate).toBe("2026-07-01");
  });

  it("computes delegation readiness from graph + fields", async () => {
    const ready = await nodeReadiness(ids.W1!);
    expect(ready?.ready).toBe(true);
    const bare = await nodeReadiness(ids.W2!);
    expect(bare?.ready).toBe(false);
  });

  it("delegate-now lists the ready workstream only", async () => {
    const res = await runView("delegate-now");
    expect(titles(res.items)).toContain("IT Ready Workstream");
    expect(titles(res.items)).not.toContain("IT Bare Workstream");
  });

  it("unowned-work and missing views catch the bare workstream", async () => {
    expect(titles((await runView("unowned-work")).items)).toContain("IT Bare Workstream");
    expect(titles((await runView("missing-milestone")).items)).toContain("IT Bare Workstream");
    expect(titles((await runView("missing-review-date")).items)).toContain("IT Bare Workstream");
    // The ready workstream has an owner edge, a milestone, and a review date.
    expect(titles((await runView("unowned-work")).items)).not.toContain("IT Ready Workstream");
    expect(titles((await runView("missing-milestone")).items)).not.toContain("IT Ready Workstream");
  });

  it("risks-without-mitigation surfaces only the un-noted risk", async () => {
    const t = titles((await runView("risks-without-mitigation")).items);
    expect(t).toContain("IT Open Risk");
    expect(t).not.toContain("IT Mitigated Risk");
  });

  it("owner-load groups the workstream under its person", async () => {
    const res = await runView("owner-load");
    expect(titles(group(res.groups, "IT Alice")?.items)).toContain("IT Ready Workstream");
  });

  it("decisions-needed groups the open decision by owner", async () => {
    const res = await runView("decisions-needed");
    expect(titles(group(res.groups, "IT Alice")?.items)).toContain("IT Decision");
  });

  it("capability-map returns initiative, capability, and workstream with edges", async () => {
    const res = await runView("capability-map");
    expect(titles(res.graph?.nodes)).toEqual(expect.arrayContaining(["IT Initiative", "IT Capability", "IT Ready Workstream"]));
    expect(res.graph!.edges.length).toBeGreaterThanOrEqual(2);
  });

  it("neighborhood includes immediate neighbors", async () => {
    const hood = await getNeighborhood(ids.W1!, 1);
    expect(titles(hood?.nodes)).toEqual(expect.arrayContaining(["IT Capability", "IT Alice", "IT Milestone"]));
  });

  it("creates and deletes an edge", async () => {
    const e = await createEdge({ type: "DEPENDS_ON", source: ids.W2!, target: ids.W1! });
    expect((await listEdges()).some((x) => x.id === e.id)).toBe(true);
    expect(await deleteEdge(e.id)).toBe(true);
    expect((await listEdges()).some((x) => x.id === e.id)).toBe(false);
  });
});
