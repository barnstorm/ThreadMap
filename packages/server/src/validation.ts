import { z } from "zod";
import { DECISION_BOUNDARIES, EDGE_TYPES, LEVELS, NODE_TYPES, READINESS_STATES } from "@threadmap/shared";

const level = z.enum(LEVELS);

const smart = z
  .object({
    specific: z.string().optional(),
    measurable: z.string().optional(),
    achievable: z.string().optional(),
    relevant: z.string().optional(),
    timeBound: z.string().optional(),
  })
  .partial();

const workstream = z
  .object({
    outcome: z.string().optional(),
    currentOwner: z.string().optional(),
    proposedDelegate: z.string().optional(),
    currentStatus: z.string().optional(),
    nextMilestone: z.string().optional(),
    successCriteria: z.string().optional(),
    escalationCriteria: z.string().optional(),
    definitionOfDone: z.string().optional(),
    seniorIcRole: z.string().optional(),
    delegateRole: z.string().optional(),
    readiness: z.enum(READINESS_STATES).optional(),
    decisionBoundary: z.enum(DECISION_BOUNDARIES).optional(),
    smart: smart.optional(),
  })
  .partial();

const optionalNodeFields = {
  note: z.string().optional(),
  owner: z.string().optional(),
  status: z.string().optional(),
  reviewDate: z.string().optional(),
  dueDate: z.string().optional(),
  url: z.string().optional(),
  repoPath: z.string().optional(),
  externalRef: z.string().optional(),
  riskLevel: level.optional(),
  confidence: level.optional(),
  tags: z.array(z.string()).optional(),
};

export const createNodeSchema = z.object({
  type: z.enum(NODE_TYPES),
  title: z.string().min(1, "title is required"),
  workstream: workstream.optional(),
  ...optionalNodeFields,
});

// Updates may set fields to null to clear them.
const nullable = <T extends z.ZodTypeAny>(s: T) => s.nullable();

export const updateNodeSchema = z.object({
  type: z.enum(NODE_TYPES).optional(),
  title: z.string().min(1).optional(),
  workstream: workstream.optional(),
  note: nullable(z.string()).optional(),
  owner: nullable(z.string()).optional(),
  status: nullable(z.string()).optional(),
  reviewDate: nullable(z.string()).optional(),
  dueDate: nullable(z.string()).optional(),
  url: nullable(z.string()).optional(),
  repoPath: nullable(z.string()).optional(),
  externalRef: nullable(z.string()).optional(),
  riskLevel: nullable(level).optional(),
  confidence: nullable(level).optional(),
  tags: nullable(z.array(z.string())).optional(),
});

export const createEdgeSchema = z.object({
  type: z.enum(EDGE_TYPES),
  source: z.string().min(1),
  target: z.string().min(1),
  note: z.string().optional(),
  status: z.string().optional(),
  confidence: level.optional(),
});

export const updateEdgeSchema = z.object({
  type: z.enum(EDGE_TYPES).optional(),
  note: nullable(z.string()).optional(),
  status: nullable(z.string()).optional(),
  confidence: nullable(level).optional(),
});

export const llmRequestSchema = z.object({
  question: z.string().min(1),
  focusNodeIds: z.array(z.string()).optional(),
  viewId: z.string().optional(),
});
