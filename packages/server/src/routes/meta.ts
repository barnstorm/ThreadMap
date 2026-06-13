import type { FastifyInstance } from "fastify";
import {
  DECISION_BOUNDARIES,
  DECISION_BOUNDARY_META,
  DO_NOT_THINK_ABOUT,
  EDGE_TYPE_META,
  EDGE_TYPES,
  LEVELS,
  MONITOR_SIGNALS,
  NODE_TYPE_META,
  NODE_TYPES,
  READINESS_META,
  READINESS_STATES,
  SIDECAR_QUESTIONS,
  SMART_FIELDS,
  VIEWS,
} from "@threadmap/shared";

/** Exposes the closed schema so the web app can be fully data-driven. */
export async function metaRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/meta", async () => ({
    nodeTypes: NODE_TYPES,
    nodeTypeMeta: NODE_TYPE_META,
    edgeTypes: EDGE_TYPES,
    edgeTypeMeta: EDGE_TYPE_META,
    levels: LEVELS,
    readinessStates: READINESS_STATES,
    readinessMeta: READINESS_META,
    decisionBoundaries: DECISION_BOUNDARIES,
    decisionBoundaryMeta: DECISION_BOUNDARY_META,
    smartFields: SMART_FIELDS,
    monitorSignals: MONITOR_SIGNALS,
    doNotThinkAbout: DO_NOT_THINK_ABOUT,
    views: VIEWS,
    sidecarQuestions: SIDECAR_QUESTIONS,
  }));
}
