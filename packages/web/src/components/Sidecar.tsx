import { useEffect, useState } from "react";
import type { LlmAnswer, ProposedEdit } from "@threadmap/shared";
import { api } from "../lib/api.js";

interface Props {
  onApply: (edit: ProposedEdit) => Promise<void>;
}

/** Optional, read-only LLM interface. Renders disabled state when no key is set. */
export function Sidecar({ onApply }: Props) {
  const [status, setStatus] = useState<{ enabled: boolean; model: string; questions: { id: string; label: string }[] } | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<LlmAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.llmStatus().then(setStatus).catch(() => setStatus({ enabled: false, model: "", questions: [] }));
  }, []);

  const ask = async (q: string) => {
    setQuestion(q);
    setBusy(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await api.ask({ question: q });
      setAnswer(res.answer);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!status) return <div className="small muted">Loading sidecar…</div>;

  if (!status.enabled) {
    return (
      <div>
        <div className="banner">
          The LLM sidecar is <b>optional and off</b>. ThreadMap works fully without it. Set <span className="kbd">ANTHROPIC_API_KEY</span> to enable
          read-only graph interrogation. It never mutates the graph — it only proposes edits for your approval.
        </div>
      </div>
    );
  }

  return (
    <div className="sidecar">
      <div className="small muted">Read-only · proposes edits only · model {status.model}</div>
      <div className="row" style={{ marginTop: 8 }}>
        <input
          value={question}
          placeholder="Ask about the graph…"
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && question.trim() && ask(question.trim())}
        />
        <button className="primary" style={{ flex: "0 0 auto" }} disabled={busy || !question.trim()} onClick={() => ask(question.trim())}>
          Ask
        </button>
      </div>
      <div style={{ marginTop: 8 }}>
        {status.questions.map((q) => (
          <button key={q.id} className="ghost small" style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 4 }} onClick={() => ask(q.label)}>
            {q.label}
          </button>
        ))}
      </div>

      {busy && <div className="small muted" style={{ marginTop: 10 }}>Thinking…</div>}
      {error && <div className="banner" style={{ borderColor: "var(--bad)" }}>{error}</div>}

      {answer && (
        <div>
          {answer.summary && <div className="small" style={{ marginTop: 10 }}>{answer.summary}</div>}
          <AnswerList title="Facts from graph" items={answer.factsFromGraph} />
          <AnswerList title="Facts from references" items={answer.factsFromReferences} />
          <AnswerList title="Inferences" items={answer.inferences} />
          <AnswerList title="Unknowns" items={answer.unknowns} />
          {answer.proposedEdits.length > 0 && (
            <div className="answer-section">
              <h3>Proposed edits (approval required)</h3>
              {answer.proposedEdits.map((edit, i) => (
                <ProposedEditCard key={i} edit={edit} onApply={onApply} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AnswerList({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="answer-section">
      <h3>{title}</h3>
      <ul style={{ margin: 0, paddingLeft: 16 }}>
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

function describe(edit: ProposedEdit): string {
  switch (edit.kind) {
    case "createNode":
      return `Create ${edit.node.type}: "${edit.node.title}"`;
    case "updateNode":
      return `Update node ${edit.nodeId}`;
    case "createEdge":
      return `Create edge ${edit.edge.type}: ${edit.edge.source} → ${edit.edge.target}`;
    case "updateEdge":
      return `Update edge ${edit.edgeId}`;
  }
}

function ProposedEditCard({ edit, onApply }: { edit: ProposedEdit; onApply: (e: ProposedEdit) => Promise<void> }) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="edit-card">
      <div className="small">
        <b>{describe(edit)}</b>
      </div>
      <div className="small muted" style={{ margin: "4px 0" }}>
        {edit.rationale}
      </div>
      <button
        className="primary small"
        disabled={done || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onApply(edit);
            setDone(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        {done ? "Approved ✓" : busy ? "Applying…" : "Approve & apply"}
      </button>
    </div>
  );
}
