import type { ReactNode } from "react";

export function Section({
  title,
  hint,
  variant,
  children,
}: {
  title: string;
  hint?: string;
  variant?: "pos";
  children: ReactNode;
}) {
  return (
    <div className={`wm-section${variant ? ` wm-section--${variant}` : ""}`}>
      <div className="wm-section-head">
        <div className="wm-section-title">{title}</div>
        {hint ? <p className="wm-section-sub">{hint}</p> : null}
      </div>
      <div className="wm-section-body">{children}</div>
    </div>
  );
}

export function ChipToggle({
  checked,
  label,
  tone,
  onChange,
}: {
  checked: boolean;
  label: string;
  tone?: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`wm-chip${checked ? " is-on" : ""}`}
      data-tone={tone || undefined}
      onClick={() => onChange(!checked)}
    >
      <span className="wm-chip-dot" aria-hidden />
      <span className="wm-chip-label">{label}</span>
    </button>
  );
}
