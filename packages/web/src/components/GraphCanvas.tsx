import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import { useEffect, useRef } from "react";
import type { Graph, NodeType, NodeTypeMeta } from "@threadmap/shared";

export interface CanvasPos {
  x: number;
  y: number;
}

interface Props {
  graph: Graph;
  nodeTypeMeta: Record<NodeType, NodeTypeMeta>;
  selectedId?: string;
  highlightIds?: Set<string>;
  /** Exact model positions to place specific nodes at (e.g. right-click create). */
  placements?: Map<string, CanvasPos>;
  onSelectNode: (id: string) => void;
  onSelectEdge: (id: string) => void;
  onBackground: () => void;
  onBackgroundContext: (modelPos: CanvasPos, screen: { x: number; y: number }) => void;
  onNodeContext: (id: string, screen: { x: number; y: number }) => void;
}

export function GraphCanvas(props: Props) {
  const { graph, nodeTypeMeta, selectedId, highlightIds, placements } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const posRef = useRef<Map<string, CanvasPos>>(new Map());
  // Latest callbacks, so the once-bound cytoscape handlers never go stale.
  const handlers = useRef(props);
  handlers.current = props;

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.addEventListener("contextmenu", (e) => e.preventDefault());
    const cy = cytoscape({
      container: containerRef.current,
      minZoom: 0.2,
      maxZoom: 2.5,
      wheelSensitivity: 0.2,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "data(color)",
            label: "data(label)",
            color: "#e6e9ef",
            "font-size": 10,
            "text-wrap": "wrap",
            "text-max-width": "120px",
            "text-valign": "bottom",
            "text-margin-y": 4,
            width: 26,
            height: 26,
            "border-width": 2,
            "border-color": "#0f1115",
          },
        },
        { selector: "node.dim", style: { opacity: 0.25 } },
        { selector: "node.selected", style: { "border-color": "#ffffff", "border-width": 3 } },
        {
          selector: "edge",
          style: {
            label: "data(label)",
            "font-size": 8,
            color: "#9aa3b2",
            width: 1.5,
            "line-color": "#3a3f4b",
            "target-arrow-color": "#3a3f4b",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            "text-rotation": "autorotate",
          },
        },
        { selector: "edge.dim", style: { opacity: 0.15 } },
        { selector: "edge.selected", style: { "line-color": "#6366f1", "target-arrow-color": "#6366f1", width: 2.5 } },
      ],
    });
    cy.on("tap", "node", (e) => handlers.current.onSelectNode(e.target.id()));
    cy.on("tap", "edge", (e) => handlers.current.onSelectEdge(e.target.id()));
    cy.on("tap", (e) => {
      if (e.target === cy) handlers.current.onBackground();
    });
    cy.on("cxttap", (e) => {
      const oe = e.originalEvent as MouseEvent | undefined;
      const screen = { x: oe?.clientX ?? 0, y: oe?.clientY ?? 0 };
      if (e.target === cy) handlers.current.onBackgroundContext(e.position, screen);
    });
    cy.on("cxttap", "node", (e) => {
      const oe = e.originalEvent as MouseEvent | undefined;
      handlers.current.onNodeContext(e.target.id(), { x: oe?.clientX ?? 0, y: oe?.clientY ?? 0 });
    });
    cy.on("dragfree", "node", (e) => {
      posRef.current.set(e.target.id(), e.target.position());
    });
    cyRef.current = cy;
    return () => cy.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync elements when the graph changes, honoring explicit placements.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const els: ElementDefinition[] = [];
    for (const n of graph.nodes) {
      els.push({
        data: { id: n.id, label: `${n.title}\n(${nodeTypeMeta[n.type]?.label ?? n.type})`, color: nodeTypeMeta[n.type]?.color ?? "#6366f1" },
        position: posRef.current.get(n.id),
      });
    }
    for (const e of graph.edges) els.push({ data: { id: e.id, source: e.source, target: e.target, label: e.type } });
    cy.json({ elements: els });

    // Place any node we have an explicit position for (right-click create).
    cy.nodes().forEach((n) => {
      if (posRef.current.has(n.id())) return;
      const p = placements?.get(n.id());
      if (p) {
        n.position(p);
        posRef.current.set(n.id(), p);
      }
    });

    const unplaced = cy.nodes().filter((n) => !posRef.current.has(n.id()));
    if (unplaced.length === 0) return;
    if (unplaced.length === cy.nodes().length) {
      // Fresh graph: lay everything out.
      cy.layout({ name: "cose", animate: false, fit: true, randomize: true }).run();
    } else {
      // A few new nodes: lay out only those, leaving existing positions stable.
      unplaced.layout({ name: "cose", animate: false, fit: false, randomize: true }).run();
    }
    cy.nodes().forEach((n) => {
      posRef.current.set(n.id(), n.position());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, nodeTypeMeta]);

  // Selection + highlight styling.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.batch(() => {
      cy.elements().removeClass("selected dim");
      if (highlightIds && highlightIds.size > 0) {
        cy.nodes().forEach((n) => {
          if (!highlightIds.has(n.id())) n.addClass("dim");
        });
        cy.edges().forEach((e) => {
          if (!highlightIds.has(e.source().id()) || !highlightIds.has(e.target().id())) e.addClass("dim");
        });
      }
      if (selectedId) cy.getElementById(selectedId).addClass("selected");
    });
  }, [selectedId, highlightIds, graph]);

  return <div id="cy" ref={containerRef} />;
}
