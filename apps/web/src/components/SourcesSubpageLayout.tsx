import type { ReactNode } from "react";
import { PanelSkeleton } from "./ui/PanelSkeleton";

export function SourcesSubpage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`sources-subpage${className ? ` ${className}` : ""}`}>{children}</div>;
}

export function SourcesSubpagePanel({
  title,
  description,
  note,
  headExtra,
  children,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  note?: string;
  headExtra?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
}) {
  const showHead = Boolean(title || description || headExtra);
  return (
    <section className="mon-panel sources-subpage-panel">
      {showHead ? (
        <header className="mon-panel-head sources-subpage-head">
          <div className="sources-subpage-head-main">
            {title ? <h3 className="mon-panel-title">{title}</h3> : null}
            {description ? <p className="mon-panel-desc">{description}</p> : null}
          </div>
          {headExtra}
        </header>
      ) : null}
      {note ? <p className="mon-panel-lead warn">{note}</p> : null}
      <div className={`mon-panel-body${bodyClassName ? ` ${bodyClassName}` : ""}`}>{children}</div>
    </section>
  );
}

export function SourcesSubpageActions({ children }: { children: ReactNode }) {
  return <div className="sources-subpage-actions">{children}</div>;
}

export function SourcesSubpageLoading({ label }: { label: string }) {
  return <PanelSkeleton label={label} lines={6} className="panel-skeleton sources-subpage-skeleton" />;
}

export function SourcesHideSwitch({
  checked,
  onChange,
  label = "隐藏未配置字段",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}) {
  return (
    <label className="sources-hide-switch">
      <input
        type="checkbox"
        className="sources-hide-switch-input"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="sources-hide-switch-track" aria-hidden />
      <span className="sources-hide-switch-text">{label}</span>
    </label>
  );
}
