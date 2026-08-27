import { useRef, useState, type ReactNode } from "react";
import { generateNamingTemplate, hasLlmConfigured } from "../../lib/llmNaming";
import type { NotifyFn } from "../../lib/notify";

export function TemplateInput({
  value,
  onChange,
  fieldHint,
  notify,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  fieldHint: string;
  notify: NotifyFn;
  placeholder?: string;
}) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const llmOk = hasLlmConfigured();

  function looksLikeTemplate(text: string): boolean {
    return /\{\{\s*[\w|]|\{%\s*\w+|\{[a-zA-Z_]\w*\}/.test(text);
  }

  async function onAi() {
    if (!llmOk) {
      notify("warn", "请先在「系统」设置中配置 LLM");
      return;
    }
    const raw = value.trim();
    if (!raw) {
      notify("warn", "请先在输入框填写自然语言描述，再点 ✦");
      inputRef.current?.focus();
      return;
    }
    if (looksLikeTemplate(raw)) {
      notify(
        "warn",
        "当前是模板内容。请先清空输入框，改写自然语言描述后再点 ✦",
      );
      inputRef.current?.focus();
      inputRef.current?.select();
      return;
    }
    setBusy(true);
    try {
      const tpl = await generateNamingTemplate(raw, fieldHint);
      onChange(tpl);
      notify("ok", "已生成模板，请确认后保存");
      inputRef.current?.focus();
    } catch (e) {
      notify("error", e, "AI 生成失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="naming-tpl-row">
      <input
        ref={inputRef}
        className="org-input naming-mono"
        value={value}
        placeholder={placeholder || "模板，或清空后输入自然语言再点 ✦"}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
      <button
        type="button"
        className="btn sm naming-ai-btn"
        title={
          llmOk
            ? "读取输入框中的自然语言并生成模板"
            : "请先在系统设置配置 LLM"
        }
        disabled={!llmOk || busy}
        onClick={() => void onAi()}
      >
        {busy ? "…" : "✦"}
      </button>
    </div>
  );
}

export function MapGrid({
  items,
  values,
  onChange,
}: {
  items: readonly (readonly [string, string])[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="naming-map-grid">
      {items.map(([key, label]) => (
        <label key={key} className="naming-map-cell">
          <span className="naming-map-label">{label}</span>
          <input
            className="org-input"
            value={values[key] || ""}
            onChange={(e) => onChange(key, e.target.value)}
          />
        </label>
      ))}
    </div>
  );
}

export function Panel({
  id,
  title,
  badge,
  children,
  lead,
}: {
  id?: string;
  title: string;
  badge?: string;
  children: ReactNode;
  lead?: ReactNode;
}) {
  return (
    <section className="mon-panel naming-panel" id={id}>
      <header className="mon-panel-head">
        <h3 className="mon-panel-title">{title}</h3>
        {badge ? <span className="naming-badge">{badge}</span> : null}
      </header>
      <div className="mon-panel-body">
        {lead ? <div className="mon-panel-lead">{lead}</div> : null}
        {children}
      </div>
    </section>
  );
}

