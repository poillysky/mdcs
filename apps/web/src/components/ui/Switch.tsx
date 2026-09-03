import type { ReactNode } from "react";

export function Switch({
  checked,
  onChange,
  disabled,
  stopPropagation,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  /** Scrape provider cards need this to avoid opening the card */
  stopPropagation?: boolean;
}) {
  return (
    <label
      className="switch"
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
    >
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

export function StatusPill({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return <span className={className}>{children}</span>;
}

export function IconButton({
  title,
  disabled,
  danger,
  onClick,
  children,
}: {
  title: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`records-icon-btn${danger ? " records-icon-btn--danger" : ""}`}
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
