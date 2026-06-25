import { useEffect, useRef } from "react";

export interface MenuItem {
  label: string;
  color?: string;
  onClick: () => void;
  danger?: boolean;
}

interface Props {
  x: number;
  y: number;
  heading?: string;
  items: MenuItem[];
  onClose: () => void;
}

/** A plain right-click menu. Closes on outside click, scroll, or Escape. */
export function ContextMenu({ x, y, heading, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  // Keep the menu on-screen.
  const left = Math.min(x, window.innerWidth - 180);
  const top = Math.min(y, window.innerHeight - (items.length * 28 + 30));

  return (
    <div className="ctx-menu" style={{ left, top }} ref={ref}>
      {heading && <div className="head">{heading}</div>}
      {items.map((it, i) => (
        <div
          key={i}
          className={`item ${it.danger ? "danger" : ""}`}
          onMouseDown={(e) => {
            e.preventDefault();
            it.onClick();
            onClose();
          }}
        >
          {it.color && <span className="swatch" style={{ background: it.color }} />}
          {it.label}
        </div>
      ))}
    </div>
  );
}
