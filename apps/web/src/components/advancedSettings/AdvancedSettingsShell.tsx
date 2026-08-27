import type { ReactNode } from "react";
import { Modal } from "../Modal";
import { JOB_ADVANCED_TABS, type JobOptionsTab } from "../../lib/jobOptions";

type TabItem = { id: JobOptionsTab; label: string };

type Props = {
  open: boolean;
  title: string;
  subtitle?: string;
  className: string;
  tabs?: TabItem[];
  tab: JobOptionsTab;
  onTabChange: (tab: JobOptionsTab) => void;
  useGlobal: boolean;
  onUseGlobalChange: (useGlobal: boolean) => void;
  globalLabel?: string;
  onClose: () => void;
  footer: ReactNode;
  loading?: boolean;
  children: ReactNode;
};

export function AdvancedSettingsShell({
  open,
  title,
  subtitle,
  className,
  tabs = [...JOB_ADVANCED_TABS],
  tab,
  onTabChange,
  useGlobal,
  onUseGlobalChange,
  globalLabel = "使用全局配置",
  onClose,
  footer,
  loading,
  children,
}: Props) {
  return (
    <Modal
      open={open}
      variant="sheet"
      padded
      className={className}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={footer}
    >
      <div className="kind-settings advanced-job-modal">
        <div className="advanced-job-tabs" role="tablist" aria-label="设置分类">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={`advanced-job-tab${tab === item.id ? " is-active" : ""}`}
              onClick={() => onTabChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label className="advanced-job-row">
          <span>{globalLabel}</span>
          <span className="switch">
            <input
              type="checkbox"
              checked={useGlobal}
              onChange={(e) => onUseGlobalChange(e.target.checked)}
            />
          </span>
        </label>

        <div className="kind-settings-body advanced-job-panel">
          {loading ? <div className="empty-block">加载配置…</div> : children}
        </div>
      </div>
    </Modal>
  );
}
