import type { GraphNode, ViewResult } from "@threadmap/shared";
import type { Meta } from "../lib/api.js";

interface Props {
  meta: Meta;
  activeId?: string;
  result: ViewResult | null;
  loading: boolean;
  onRun: (id: string) => void;
  onClear: () => void;
  onPick: (nodeId: string) => void;
}

function NodeRow({ node, onPick }: { node: GraphNode; onPick: (id: string) => void }) {
  const ws = node.workstream;
  return (
    <div className="list-item" onClick={() => onPick(node.id)}>
      <div className="title">{node.title}</div>
      <div className="meta">
        <span>{node.type}</span>
        {ws?.readiness && <span>· {ws.readiness}</span>}
        {(node.owner || ws?.currentOwner) && <span>· {node.owner ?? ws?.currentOwner}</span>}
        {node.reviewDate && <span>· review {node.reviewDate.slice(0, 10)}</span>}
        {node.riskLevel && <span>· risk {node.riskLevel}</span>}
      </div>
    </div>
  );
}

export function ViewsPanel({ meta, activeId, result, loading, onRun, onClear, onPick }: Props) {
  return (
    <>
      <div className="section">
        <div className="row tight" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Views</h2>
          {activeId && (
            <button className="ghost small" onClick={onClear}>
              clear
            </button>
          )}
        </div>
        {meta.views.map((v) => (
          <div key={v.id} className={`view-item ${activeId === v.id ? "active" : ""}`} onClick={() => onRun(v.id)}>
            <div>
              {v.name}
              <small>{v.description}</small>
            </div>
          </div>
        ))}
      </div>

      {activeId && (
        <div className="section">
          <h2>{result?.view.name ?? "Results"}</h2>
          {loading && <div className="small muted">Running…</div>}
          {!loading && result && (
            <>
              {result.items && result.items.length === 0 && <div className="small muted">Nothing here — nice.</div>}
              {result.items?.map((n) => (
                <NodeRow key={n.id} node={n} onPick={onPick} />
              ))}
              {result.groups?.map((g) => (
                <div key={g.key}>
                  <div className="group-key">{g.key}</div>
                  {g.items.map((n) => (
                    <NodeRow key={n.id + g.key} node={n} onPick={onPick} />
                  ))}
                </div>
              ))}
              {result.graph && (
                <div className="small muted">
                  {result.graph.nodes.length} nodes, {result.graph.edges.length} edges highlighted on the canvas.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
