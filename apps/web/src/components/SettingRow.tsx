import type { ReactNode } from "react";

type Props = {
  label: string;
  hint?: string;
  children: ReactNode;
  danger?: boolean;
  layout?: "inline" | "stack";
};

/** 设置页通用行：左标签/说明，右控件；stack 用于标签列表、路径等宽内容 */
export function SettingRow({ label, hint, children, danger, layout = "inline" }: Props) {
  return (
    <div
      className={`org-row${hint ? " has-hint" : ""}${layout === "stack" ? " is-stack" : ""}${
        danger ? " danger" : ""
      }`}
    >
      <div className="org-row-text">
        <div className="org-row-label">{label}</div>
        {hint ? <div className="org-row-hint">{hint}</div> : null}
      </div>
      <div className="org-row-control">{children}</div>
    </div>
  );
}
