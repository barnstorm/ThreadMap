import { useEffect, useState } from "react";
import type { EdgeType, GraphEdge, GraphNode, Level, ReadinessReport, WorkstreamFields } from "@threadmap/shared";
import { api, type Meta } from "../lib/api.js";

interface Props {
  meta: Meta;
  node?: GraphNode;
  edge?: GraphEdge;
  edgeEndpoints?: { source?: GraphNode; target?: GraphNode };
  onUpdateNode: (id: string, changes: Record<string, unknown>) => void;
  onDeleteNode: (id: string) => void;
  onUpdateEdge: (id: string, changes: Record<string, unknown>) => void;
  onDeleteEdge: (id: string) => void;
  onStartConnect: (id: string) => void;
}

function Field({ label, value, onSave, area }: { label: string; value?: string; onSave: (v: string | null) => void; area?: boolean }) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => setV(value ?? ""), [value]);
  const commit = () => {
    const next = v.trim();
    if (next === (value ?? "")) return;
    onSave(next === "" ? null : next);
  };
  return (
    <div className="full">
      <label>{label}</label>
      {area ? (
        <textarea value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} />
      ) : (
        <input value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} />
      )}
    </div>
  );
}

export function Inspector(props: Props) {
  const { meta, node, edge } = props;
  if (edge) return <EdgeInspector {...props} edge={edge} />;
  if (node) return <NodeInspector {...props} node={node} />;
  return (
    <div className="empty">
      Select a node or edge, or capture something new.
      <div style={{ marginTop: 12 }} className="small">
        <span className="kbd">c</span> capture · <span className="kbd">/</span> search · <span className="kbd">Esc</span> deselect
      </div>
    </div>
  );
}

function NodeInspector({ meta, node, onUpdateNode, onDeleteNode, onStartConnect }: Props & { node: GraphNode }) {
  const tm = meta.nodeTypeMeta[node.type];
  const set = (k: string, v: unknown) => onUpdateNode(node.id, { [k]: v });
  const setWs = (k: keyof WorkstreamFields, v: unknown) => onUpdateNode(node.id, { workstream: { [k]: v } });

  const [readiness, setReadiness] = useState<ReadinessReport | null>(null);
  useEffect(() => {
    setReadiness(null);
    if (node.type === "Workstream") api.readiness(node.id).then(setReadiness).catch(() => setReadiness(null));
  }, [node.id, node.type, node.updatedAt]);

  return (
    <div className="inspector">
      <div className="section">
        <div className="row tight" style={{ justifyContent: "space-between" }}>
          <span className="chip">
            <span className="swatch" style={{ background: tm.color }} /> {tm.label}
          </span>
          <button className="danger ghost" onClick={() => onDeleteNode(node.id)} title="Delete node">
            Delete
          </button>
        </div>
        <Field label="Title" value={node.title} onSave={(v) => set("title", v ?? node.title)} />
        <Field label="Note" value={node.note} onSave={(v) => set("note", v)} area />
      </div>

      <div className="section">
        <h2>Attributes</h2>
        <div className="field-grid">
          <div>
            <label>Owner</label>
            <input defaultValue={node.owner ?? ""} onBlur={(e) => set("owner", e.target.value.trim() || null)} />
          </div>
          <div>
            <label>Status</label>
            <input defaultValue={node.status ?? ""} onBlur={(e) => set("status", e.target.value.trim() || null)} />
          </div>
          <div>
            <label>Review date</label>
            <input type="date" defaultValue={node.reviewDate?.slice(0, 10) ?? ""} onBlur={(e) => set("reviewDate", e.target.value || null)} />
          </div>
          <div>
            <label>Due date</label>
            <input type="date" defaultValue={node.dueDate?.slice(0, 10) ?? ""} onBlur={(e) => set("dueDate", e.target.value || null)} />
          </div>
          <div>
            <label>Risk level</label>
            <LevelSelect value={node.riskLevel} levels={meta.levels} onChange={(v) => set("riskLevel", v)} />
          </div>
          <div>
            <label>Confidence</label>
            <LevelSelect value={node.confidence} levels={meta.levels} onChange={(v) => set("confidence", v)} />
          </div>
        </div>
        <Field label="URL" value={node.url} onSave={(v) => set("url", v)} />
        <Field label="Repo path" value={node.repoPath} onSave={(v) => set("repoPath", v)} />
        <Field label="External ref" value={node.externalRef} onSave={(v) => set("externalRef", v)} />
        <button className="ghost" style={{ marginTop: 8, width: "100%" }} onClick={() => onStartConnect(node.id)}>
          ↳ Draw edge from here
        </button>
      </div>

      {node.type === "Workstream" && (
        <WorkstreamPanel meta={meta} node={node} setWs={setWs} readiness={readiness} />
      )}
    </div>
  );
}

function WorkstreamPanel({
  meta,
  node,
  setWs,
  readiness,
}: {
  meta: Meta;
  node: GraphNode;
  setWs: (k: keyof WorkstreamFields, v: unknown) => void;
  readiness: ReadinessReport | null;
}) {
  const ws = node.workstream ?? {};
  return (
    <>
      <div className="section">
        <h2>Delegation</h2>
        <label>Readiness</label>
        <select value={ws.readiness ?? ""} onChange={(e) => setWs("readiness", e.target.value || null)}>
          <option value="">— unset —</option>
          {meta.readinessStates.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {ws.readiness && <div className="hint">{meta.readinessMeta[ws.readiness]?.description}</div>}

        <label>Decision boundary</label>
        <select value={ws.decisionBoundary ?? ""} onChange={(e) => setWs("decisionBoundary", e.target.value || null)}>
          <option value="">— unset —</option>
          {meta.decisionBoundaries.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {ws.decisionBoundary && <div className="hint">{meta.decisionBoundaryMeta[ws.decisionBoundary]}</div>}

        <WsField label="Outcome" k="outcome" ws={ws} setWs={setWs} area />
        <div className="field-grid">
          <WsInline label="Current owner" k="currentOwner" ws={ws} setWs={setWs} />
          <WsInline label="Proposed delegate" k="proposedDelegate" ws={ws} setWs={setWs} />
          <WsInline label="Current status" k="currentStatus" ws={ws} setWs={setWs} />
          <WsInline label="Next milestone" k="nextMilestone" ws={ws} setWs={setWs} />
          <WsInline label="Senior IC role" k="seniorIcRole" ws={ws} setWs={setWs} />
          <WsInline label="Delegate role" k="delegateRole" ws={ws} setWs={setWs} />
        </div>
        <WsField label="Success criteria" k="successCriteria" ws={ws} setWs={setWs} area />
        <WsField label="Escalation criteria" k="escalationCriteria" ws={ws} setWs={setWs} area />
        <WsField label="Definition of done" k="definitionOfDone" ws={ws} setWs={setWs} area />
      </div>

      <div className="section">
        <h2>SMART</h2>
        {meta.smartFields.map((f) => (
          <div key={f.key}>
            <label title={f.prompt}>{f.label}</label>
            <input
              defaultValue={(ws.smart as Record<string, string> | undefined)?.[f.key] ?? ""}
              placeholder={f.prompt}
              onBlur={(e) => setWs("smart", { [f.key]: e.target.value.trim() || null })}
            />
          </div>
        ))}
      </div>

      {readiness && (
        <div className="section">
          <h2>Delegation readiness</h2>
          <div className="bar">
            <span style={{ width: `${(readiness.metCount / readiness.total) * 100}%`, background: readiness.ready ? "var(--good)" : "var(--warn)" }} />
          </div>
          <div className="small muted">
            {readiness.metCount}/{readiness.total} met{readiness.ready ? " — delegation-ready" : ""}
          </div>
          <div className="readiness">
            {readiness.requirements.map((r) => (
              <div key={r.key} className={`req ${r.met ? "met" : "unmet"}`}>
                <span className="mark">{r.met ? "✓" : "○"}</span>
                {r.label}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="section">
        <h2>Cognitive load</h2>
        <div className="small muted">Monitor: {meta.monitorSignals.join(", ")}.</div>
        <div className="small muted" style={{ marginTop: 4 }}>
          Don't think about: {meta.doNotThinkAbout.join(", ")}.
        </div>
      </div>
    </>
  );
}

function WsInline({ label, k, ws, setWs }: { label: string; k: keyof WorkstreamFields; ws: WorkstreamFields; setWs: (k: keyof WorkstreamFields, v: unknown) => void }) {
  return (
    <div>
      <label>{label}</label>
      <input defaultValue={(ws[k] as string) ?? ""} onBlur={(e) => setWs(k, e.target.value.trim() || null)} />
    </div>
  );
}

function WsField({ label, k, ws, setWs, area }: { label: string; k: keyof WorkstreamFields; ws: WorkstreamFields; setWs: (k: keyof WorkstreamFields, v: unknown) => void; area?: boolean }) {
  return (
    <div className="full">
      <label>{label}</label>
      {area ? (
        <textarea defaultValue={(ws[k] as string) ?? ""} onBlur={(e) => setWs(k, e.target.value.trim() || null)} />
      ) : (
        <input defaultValue={(ws[k] as string) ?? ""} onBlur={(e) => setWs(k, e.target.value.trim() || null)} />
      )}
    </div>
  );
}

function LevelSelect({ value, levels, onChange }: { value?: string; levels: string[]; onChange: (v: Level | null) => void }) {
  return (
    <select value={value ?? ""} onChange={(e) => onChange((e.target.value || null) as Level | null)}>
      <option value="">—</option>
      {levels.map((l) => (
        <option key={l} value={l}>
          {l}
        </option>
      ))}
    </select>
  );
}

function EdgeInspector({ meta, edge, edgeEndpoints, onUpdateEdge, onDeleteEdge }: Props & { edge: GraphEdge }) {
  return (
    <div className="inspector">
      <div className="section">
        <div className="row tight" style={{ justifyContent: "space-between" }}>
          <span className="chip">edge</span>
          <button className="danger ghost" onClick={() => onDeleteEdge(edge.id)}>
            Delete
          </button>
        </div>
        <div className="small muted" style={{ margin: "6px 0" }}>
          {edgeEndpoints?.source?.title ?? edge.source} → {edgeEndpoints?.target?.title ?? edge.target}
        </div>
        <label>Relationship</label>
        <select value={edge.type} onChange={(e) => onUpdateEdge(edge.id, { type: e.target.value as EdgeType })}>
          {meta.edgeTypes.map((t) => (
            <option key={t} value={t}>
              {t} — {meta.edgeTypeMeta[t]?.label}
            </option>
          ))}
        </select>
        {meta.edgeTypeMeta[edge.type] && <div className="hint">{meta.edgeTypeMeta[edge.type]?.description}</div>}
        <Field label="Note" value={edge.note} onSave={(v) => onUpdateEdge(edge.id, { note: v })} area />
        <Field label="Status" value={edge.status} onSave={(v) => onUpdateEdge(edge.id, { status: v })} />
      </div>
    </div>
  );
}
