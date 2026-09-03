import { useEffect, useRef, useState } from "react";
import { EmptyState } from "../components/ui/EmptyState";
import type { SettingsSaveActions } from "../hooks/useDirtyBaseline";
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
import { NamingSettingsPanel, type NamingSaveActions } from "./NamingSettingsPanel";
import { NfoSettingsPanel } from "./NfoSettingsPanel";
import {
  DownloadSettingsPanel,
  type DownloadSaveActions,
} from "./DownloadSettingsPanel";
import { MetadataSettingsPanel } from "./MetadataSettingsPanel";
import { WatermarkSettingsPanel } from "./WatermarkSettingsPanel";
import {
  MonitorSettingsPanel,
  type MonitorSaveActions,
} from "./MonitorSettingsPanel";
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

type AnySaveActions =
  | OrganizeSaveActions
  | DownloadSaveActions
  | NamingSaveActions
  | MonitorSaveActions
  | SettingsSaveActions;

const TAB_LABEL: Partial<Record<SettingsTabId, string>> = {
  organize: "整理",
  download: "下载",
  naming: "命名",
  watermark: "水印",
  network: "网络",
  metadata: "元数据",
  nfo: "NFO",
  actors: "演员",
  system: "系统",
  webhook: "Webhook",
  monitor: "监控",
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
  const [tabActions, setTabActions] = useState<Partial<Record<SettingsTabId, AnySaveActions | null>>>(
    {},
  );
  const handlersRef = useRef<
    Partial<Record<SettingsTabId, (actions: AnySaveActions | null) => void>>
  >({});

  useEffect(() => {
    if (path === "/settings") {
      onNavigate(settingsTabPath("organize"));
    }
  }, [path, onNavigate]);

  function bindActions(id: SettingsTabId) {
    const cached = handlersRef.current[id];
    if (cached) return cached;
    const handler = (actions: AnySaveActions | null) => {
      setTabActions((prev) => {
        const old = prev[id];
        if (
          old &&
          actions &&
          old.dirty === actions.dirty &&
          old.saving === actions.saving &&
          old.save === actions.save &&
          old.discard === actions.discard
        ) {
          return prev;
        }
        if (!old && !actions) return prev;
        return { ...prev, [id]: actions };
      });
    };
    handlersRef.current[id] = handler;
    return handler;
  }

  async function switchTab(id: SettingsTabId) {
    const def = SETTINGS_TABS.find((t) => t.id === id);
    if (!def?.enabled) return;
    const cur = tabActions[activeTab];
    if (cur?.dirty && id !== activeTab) {
      const label = TAB_LABEL[activeTab] ?? activeTab;
      if (!window.confirm(`${label} Tab 有未保存的修改，确定离开？`)) return;
      if (cur.discard) await cur.discard();
    }
    onNavigate(settingsTabPath(id));
  }

  const activeActions = tabActions[activeTab];
  const activeLabel = TAB_LABEL[activeTab] ?? "设置";

  const tabDef = SETTINGS_TABS.find((t) => t.id === activeTab);

  function renderPanel() {
    switch (activeTab) {
      case "organize":
        return (
          <OrganizeSettingsPanel notify={notify} onActionsChange={bindActions("organize")} />
        );
      case "network":
        return <NetworkConfigPanel notify={notify} onActionsChange={bindActions("network")} />;
      case "system":
        return <SystemSettingsPanel notify={notify} onActionsChange={bindActions("system")} />;
      case "naming":
        return (
          <NamingSettingsPanel notify={notify} onActionsChange={bindActions("naming")} />
        );
      case "nfo":
        return <NfoSettingsPanel notify={notify} onActionsChange={bindActions("nfo")} />;
      case "download":
        return (
          <DownloadSettingsPanel notify={notify} onActionsChange={bindActions("download")} />
        );
      case "metadata":
        return (
          <MetadataSettingsPanel notify={notify} onActionsChange={bindActions("metadata")} />
        );
      case "watermark":
        return (
          <WatermarkSettingsPanel notify={notify} onActionsChange={bindActions("watermark")} />
        );
      case "monitor":
        return (
          <MonitorSettingsPanel
            kinds={kinds}
            kindsLoading={loading}
            onChanged={onChanged}
            onActionsChange={bindActions("monitor")}
            notify={notify}
          />
        );
      case "webhook":
        return (
          <WebhookSettingsPanel
            kinds={kinds}
            notify={notify}
            onActionsChange={bindActions("webhook")}
          />
        );
      case "actors":
        return <ActorsSettingsPanel notify={notify} onActionsChange={bindActions("actors")} />;
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

      {activeActions ? (
        <div className="settings-save-bar" role="toolbar" aria-label="设置保存">
          {activeActions.dirty ? (
            <span className="settings-save-hint">有未保存的修改</span>
          ) : (
            <span className="settings-save-hint muted">已与服务器同步</span>
          )}
          <button
            type="button"
            className="btn primary"
            disabled={!activeActions.dirty || activeActions.saving}
            onClick={() => void activeActions.save()}
          >
            {activeActions.saving ? "保存中…" : `保存${activeLabel}配置`}
          </button>
        </div>
      ) : null}

      <div className="settings-panel">{renderPanel()}</div>
    </>
  );
}
