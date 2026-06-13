import { forwardRef, useState } from "react";
import type { NodeType } from "@threadmap/shared";
import type { Meta } from "../lib/api.js";

interface Props {
  meta: Meta;
  onCreate: (type: NodeType, title: string) => void;
}

/** Fast capture: pick a type, type a title, hit Enter. Keyboard-first. */
export const CaptureBar = forwardRef<HTMLInputElement, Props>(function CaptureBar({ meta, onCreate }, ref) {
  const [type, setType] = useState<NodeType>("Workstream");
  const [title, setTitle] = useState("");

  const submit = () => {
    const t = title.trim();
    if (!t) return;
    onCreate(type, t);
    setTitle("");
  };

  return (
    <div className="section capture">
      <h2>Capture</h2>
      <div className="row">
        <select value={type} onChange={(e) => setType(e.target.value as NodeType)} style={{ flex: "0 0 130px" }} title="Node type">
          {meta.nodeTypes.map((t) => (
            <option key={t} value={t}>
              {meta.nodeTypeMeta[t].label}
            </option>
          ))}
        </select>
        <input
          ref={ref}
          value={title}
          placeholder="Title…  (Enter to add)"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
      </div>
      <div className="hint">{meta.nodeTypeMeta[type].description}</div>
    </div>
  );
});
