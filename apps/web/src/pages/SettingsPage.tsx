import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "../components/ui/EmptyState";
import {
  SETTINGS_TABS,
  parseSettingsTab,
  settingsTabPath,
  type SettingsTabId,
} from "../lib/settingsTabs";
import type { KindRow } from "../types";
import type { NotifyFn } from "../lib/notify";
import { NetworkConfigPanel } from "./NetworkConfigPanel";
import {
  OrganizeSettingsPanel,
  type OrganizeSaveActions,
} from "./OrganizeSettingsPanel";
import { SystemSettingsPanel } from "./SystemSettingsPanel";
import { NamingSettingsPanel } from "./NamingSettingsPanel";
import { NfoSettingsPanel } from "./NfoSettingsPanel";
import { DownloadSettingsPanel } from "./DownloadSettingsPanel";
import { MetadataSettingsPanel } from "./MetadataSettingsPanel";
import { WatermarkSettingsPanel } from "./WatermarkSettingsPanel";
import { MonitorSettingsPanel } from "./MonitorSettingsPanel";
import { WebhookSettingsPanel } from "./WebhookSettingsPanel";
import { ActorsSettingsPanel } from "./ActorsSettingsPanel";

type Props = {
  path: string;
  kinds: KindRow[];
  loading: boolean;
  onNavigate: (path: string) => void;
  onChanged: () => void;
  notify: NotifyFn;
};

export function SettingsPage({
  path,
  kinds,
  loading,
  onNavigate,
  onChanged,
  notify,
}: Props) {
  const activeTab = parseSettingsTab(path);
  const [organizeActions, setOrganizeActions] = useState<OrganizeSaveActions | null>(null);

  useEffect(() => {
    if (path === "/settings") {
      onNavigate(settingsTabPath("organize"));
    }
  }, [path, onNavigate]);

  const handleOrganizeActions = useCallback((actions: OrganizeSaveActions | null) => {
    setOrganizeActions(actions);
  }, []);

  function switchTab(id: SettingsTabId) {
    const def = SETTINGS_TABS.find((t) => t.id === id);
    if (!def?.enabled) return;
    if (organizeActions?.dirty && activeTab === "organize" && id !== "organize") {
      if (!window.confirm("整理 Tab 有未保存的修改，确定离开？")) return;
    }
    onNavigate(settingsTabPath(id));
  }

  const tabDef = SETTINGS_TABS.find((t) => t.id === activeTab);

  function renderPanel() {
    switch (activeTab) {
      case "organize":
        return (
          <OrganizeSettingsPanel notify={notify} onActionsChange={handleOrganizeActions} />
        );
      case "network":
        return <NetworkConfigPanel notify={notify} />;
      case "system":
        return <SystemSettingsPanel notify={notify} />;
      case "naming":
        return <NamingSettingsPanel notify={notify} />;
      case "nfo":
        return <NfoSettingsPanel notify={notify} />;
      case "download":
        return <DownloadSettingsPanel notify={notify} />;
      case "metadata":
        return <MetadataSettingsPanel notify={notify} />;
      case "watermark":
        return <WatermarkSettingsPanel notify={notify} />;
      case "monitor":
        return (
          <MonitorSettingsPanel
            kinds={kinds}
            kindsLoading={loading}
            onChanged={onChanged}
            notify={notify}
          />
        );
      case "webhook":
        return <WebhookSettingsPanel kinds={kinds} notify={notify} />;
      case "actors":
        return <ActorsSettingsPanel notify={notify} />;
      default:
        return (
          <EmptyState
            title={`${tabDef?.label ?? "设置"}尚未开放`}
            description="该 Tab 将在后续里程碑实现，请先使用整理与网络配置。"
          />
        );
    }
  }

  return (
    <>
      <div className="settings-tabs" role="tablist" aria-label="设置分类">
        {SETTINGS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`settings-tab${activeTab === tab.id ? " active" : ""}${tab.enabled ? "" : " disabled"}`}
            disabled={!tab.enabled}
            title={tab.enabled ? undefined : "后续步骤实现"}
            onClick={() => switchTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="settings-panel">{renderPanel()}</div>
    </>
  );
}
