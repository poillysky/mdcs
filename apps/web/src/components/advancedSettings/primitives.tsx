import { useState, type ReactNode } from "react";

export function TagListEditor({
  values,
  onChange,
  placeholder,
  disabled,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    if (disabled) return;
    const parts = draft
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const set = new Set(values);
    for (const p of parts) set.add(p);
    onChange([...set]);
    setDraft("");
  }

  return (
    <div className={`org-tags${disabled ? " disabled" : ""}`}>
      <div className="chip-grid org-tags-list">
        {values.length ? (
          values.map((v) => (
            <button
              key={v}
              type="button"
              className="chip active"
              title="点击移除"
              disabled={disabled}
              onClick={() => onChange(values.filter((x) => x !== v))}
            >
              {v} ×
            </button>
          ))
        ) : (
          <span className="org-tags-empty">暂无条目</span>
        )}
      </div>
      <div className="org-tags-add">
        <input
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder ?? "输入后回车添加"}
        />
        <button type="button" className="btn sm" disabled={disabled} onClick={add}>
          添加
        </button>
      </div>
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="switch">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span />
    </label>
  );
}

export function Panel({
  title,
  children,
  danger,
  off,
  headExtra,
}: {
  title: string;
  children: ReactNode;
  danger?: boolean;
  off?: boolean;
  headExtra?: ReactNode;
}) {
  return (
    <section
      className={`mon-panel${danger ? " mon-panel--danger" : ""}${off ? " is-off" : ""}`}
    >
      <header className="mon-panel-head">
        <h3 className="mon-panel-title">{title}</h3>
        {headExtra}
      </header>
      <div className="mon-panel-body">{children}</div>
    </section>
  );
}

export function GlobalToggleRow({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="advanced-job-row">
      <span>使用全局配置</span>
      <span className="switch">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      </span>
    </label>
  );
}

export function GlobalConfigHint({ children }: { children: ReactNode }) {
  return <p className="set-section-sub">{children}</p>;
}
