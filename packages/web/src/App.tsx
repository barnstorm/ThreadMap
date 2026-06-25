import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type Graph,
  type GraphNode,
  type NodeType,
  type ProposedEdit,
  type ViewResult,
  suggestEdgeTypes,
} from "@threadmap/shared";
import { api, type Meta } from "./lib/api.js";
import { CaptureBar } from "./components/CaptureBar.js";
import { ContextMenu, type MenuItem } from "./components/ContextMenu.js";
import { GraphCanvas, type CanvasPos } from "./components/GraphCanvas.js";
import { Inspector } from "./components/Inspector.js";
import { Sidecar } from "./components/Sidecar.js";
import { ViewsPanel } from "./components/ViewsPanel.js";

const EMPTY: Graph = { nodes: [], edges: [] };

export function App() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [health, setHealth] = useState<{ ok: boolean; neo4j: string } | null>(null);
  const [graph, setGraph] = useState<Graph>(EMPTY);
  const [selNode, setSelNode] = useState<string | undefined>();
  const [selEdge, setSelEdge] = useState<string | undefined>();
  const [tab, setTab] = useState<"inspector" | "sidecar">("inspector");

  const [viewId, setViewId] = useState<string | undefined>();
  const [viewResult, setViewResult] = useState<ViewResult | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [highlight, setHighlight] = useState<Set<string> | undefined>();

  const [connectSource, setConnectSource] = useState<string | null>(null);
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; kind: "bg" | "node"; modelPos?: CanvasPos; nodeId?: string } | null>(null);
  const placementsRef = useRef<Map<string, CanvasPos>>(new Map());

  const captureRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const nodesById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);

  const refreshGraph = useCallback(async () => {
    try {
      setGraph(await api.graph());
    } catch {
      /* surfaced via health banner */
    }
  }, []);

  useEffect(() => {
    api.meta().then(setMeta).catch(() => undefined);
    api.health().then(setHealth).catch(() => setHealth({ ok: false, neo4j: "unreachable" }));
    refreshGraph();
  }, [refreshGraph]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (e.key === "Escape") {
        setSelNode(undefined);
        setSelEdge(undefined);
        setConnectSource(null);
        setPendingTarget(null);
        (e.target as HTMLElement)?.blur?.();
        return;
      }
      if (typing) return;
      if (e.key === "c") {
        e.preventDefault();
        captureRef.current?.focus();
      } else if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const createNode = async (type: NodeType, title: string) => {
    const node = await api.createNode({ type, title });
    await refreshGraph();
    selectNode(node.id);
  };

  const createNodeAt = async (type: NodeType, modelPos: CanvasPos) => {
    const node = await api.createNode({ type, title: `New ${type}` });
    placementsRef.current.set(node.id, modelPos);
    await refreshGraph();
    selectNode(node.id);
  };

  const selectNode = (id: string) => {
    if (connectSource && id !== connectSource) {
      setPendingTarget(id);
      return;
    }
    setSelEdge(undefined);
    setSelNode(id);
    setTab("inspector");
  };

  const updateNode = async (id: string, changes: Record<string, unknown>) => {
    await api.updateNode(id, changes);
    await refreshGraph();
  };
  const deleteNode = async (id: string) => {
    await api.deleteNode(id);
    if (selNode === id) setSelNode(undefined);
    await refreshGraph();
  };
  const updateEdge = async (id: string, changes: Record<string, unknown>) => {
    await api.updateEdge(id, changes);
    await refreshGraph();
  };
  const deleteEdge = async (id: string) => {
    await api.deleteEdge(id);
    if (selEdge === id) setSelEdge(undefined);
    await refreshGraph();
  };

  const confirmEdge = async (type: string) => {
    if (!connectSource || !pendingTarget) return;
    await api.createEdge({ type: type as never, source: connectSource, target: pendingTarget });
    setConnectSource(null);
    setPendingTarget(null);
    await refreshGraph();
  };

  const runView = async (id: string) => {
    setViewId(id);
    setViewLoading(true);
    setViewResult(null);
    try {
      const res = await api.runView(id);
      setViewResult(res);
      const ids = new Set<string>();
      res.items?.forEach((n) => ids.add(n.id));
      res.groups?.forEach((g) => g.items.forEach((n) => ids.add(n.id)));
      res.graph?.nodes.forEach((n) => ids.add(n.id));
      setHighlight(ids.size ? ids : undefined);
    } catch {
      setViewResult(null);
    } finally {
      setViewLoading(false);
    }
  };
  const clearView = () => {
    setViewId(undefined);
    setViewResult(null);
    setHighlight(undefined);
  };

  const applyEdit = async (edit: ProposedEdit) => {
    if (edit.kind === "createNode") await api.createNode(edit.node);
    else if (edit.kind === "updateNode") await api.updateNode(edit.nodeId, edit.changes);
    else if (edit.kind === "createEdge") await api.createEdge(edit.edge);
    else if (edit.kind === "updateEdge") await api.updateEdge(edit.edgeId, edit.changes);
    await refreshGraph();
  };

  const onSearch = async (q: string) => {
    if (!q.trim()) return;
    const matches = await api.listNodes({ q: q.trim() });
    setHighlight(matches.length ? new Set(matches.map((n) => n.id)) : undefined);
    if (matches[0]) selectNode(matches[0].id);
  };

  if (!meta) {
    return <div className="empty" style={{ paddingTop: 80 }}>Loading ThreadMap… (is the server running on :4000?)</div>;
  }

  const selectedNode: GraphNode | undefined = selNode ? nodesById.get(selNode) : undefined;
  const selectedEdge = selEdge ? graph.edges.find((e) => e.id === selEdge) : undefined;
  const suggested = pendingTarget
    ? suggestEdgeTypes(nodesById.get(connectSource ?? "")?.type, nodesById.get(pendingTarget)?.type)
    : [];

  return (
    <div className="app">
      <div className="topbar">
        <h1>ThreadMap</h1>
        <span className="badge">manual-first delegation mind map</span>
        <div className="spacer" />
        <input
          ref={searchRef}
          placeholder="/ search title…"
          style={{ width: 200 }}
          onKeyDown={(e) => e.key === "Enter" && onSearch((e.target as HTMLInputElement).value)}
        />
        <span className="small muted" title={health?.neo4j}>
          <span className={`dot ${health?.ok ? "ok" : "bad"}`} />
          {health?.ok ? "Neo4j" : "Neo4j offline"}
        </span>
      </div>

      <div className="main">
        <div className="left">
          <CaptureBar ref={captureRef} meta={meta} onCreate={createNode} />
          <ViewsPanel meta={meta} activeId={viewId} result={viewResult} loading={viewLoading} onRun={runView} onClear={clearView} onPick={selectNode} />
        </div>

        <div className="center">
          {!health?.ok && (
            <div className="banner" style={{ position: "absolute", top: 10, left: 10, right: 10, zIndex: 5 }}>
              Neo4j is offline. ThreadMap is BYO-Neo4j — start a local container (<span className="kbd">npm run neo4j:up</span>) or point the server at your instance, then reload.
            </div>
          )}
          {connectSource && (
            <div className="connect-banner">
              {pendingTarget ? (
                <span className="row tight" style={{ gap: 8 }}>
                  {nodesById.get(connectSource)?.title} →
                  <select id="edge-type" defaultValue={suggested[0]} style={{ width: 200 }}>
                    {suggested.map((t) => (
                      <option key={t} value={t}>
                        {t} — {meta.edgeTypeMeta[t]?.label}
                      </option>
                    ))}
                  </select>
                  {nodesById.get(pendingTarget)?.title}
                  <button className="primary small" onClick={() => confirmEdge((document.getElementById("edge-type") as HTMLSelectElement).value)}>
                    Link
                  </button>
                  <button className="ghost small" onClick={() => { setConnectSource(null); setPendingTarget(null); }}>
                    ✕
                  </button>
                </span>
              ) : (
                <>Click a target node to link from <b>{nodesById.get(connectSource)?.title}</b> · <span className="kbd">Esc</span> cancels</>
              )}
            </div>
          )}
          <GraphCanvas
            graph={graph}
            nodeTypeMeta={meta.nodeTypeMeta}
            selectedId={selNode}
            highlightIds={highlight}
            placements={placementsRef.current}
            onSelectNode={selectNode}
            onSelectEdge={(id) => { setSelNode(undefined); setSelEdge(id); setTab("inspector"); }}
            onBackground={() => { setSelNode(undefined); setSelEdge(undefined); }}
            onBackgroundContext={(modelPos, screen) => setCtxMenu({ kind: "bg", x: screen.x, y: screen.y, modelPos })}
            onNodeContext={(id, screen) => setCtxMenu({ kind: "node", x: screen.x, y: screen.y, nodeId: id })}
          />
        </div>

        <div className="right">
          <div className="section">
            <div className="tabs">
              <button className={tab === "inspector" ? "active" : ""} onClick={() => setTab("inspector")}>
                Inspector
              </button>
              <button className={tab === "sidecar" ? "active" : ""} onClick={() => setTab("sidecar")}>
                LLM (optional)
              </button>
            </div>
          </div>
          {tab === "inspector" ? (
            <Inspector
              meta={meta}
              node={selectedNode}
              edge={selectedEdge}
              edgeEndpoints={selectedEdge ? { source: nodesById.get(selectedEdge.source), target: nodesById.get(selectedEdge.target) } : undefined}
              onUpdateNode={updateNode}
              onDeleteNode={deleteNode}
              onUpdateEdge={updateEdge}
              onDeleteEdge={deleteEdge}
              onStartConnect={(id) => { setConnectSource(id); setPendingTarget(null); }}
            />
          ) : (
            <div className="section">
              <Sidecar onApply={applyEdit} />
            </div>
          )}
        </div>
      </div>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          heading={ctxMenu.kind === "bg" ? "Add node" : nodesById.get(ctxMenu.nodeId ?? "")?.title}
          items={
            ctxMenu.kind === "bg"
              ? meta.nodeTypes.map<MenuItem>((t) => ({
                  label: meta.nodeTypeMeta[t].label,
                  color: meta.nodeTypeMeta[t].color,
                  onClick: () => ctxMenu.modelPos && createNodeAt(t, ctxMenu.modelPos),
                }))
              : [
                  { label: "↳ Draw edge from here", onClick: () => { setConnectSource(ctxMenu.nodeId!); setPendingTarget(null); } },
                  { label: "Open in inspector", onClick: () => selectNode(ctxMenu.nodeId!) },
                  { label: "Delete", danger: true, onClick: () => deleteNode(ctxMenu.nodeId!) },
                ]
          }
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}
