import { useEffect, useRef, useState } from "react";
import type { SettingsSaveActions } from "../hooks/useDirtyBaseline";
import {
  parseSourcesTab,
  SOURCES_TABS,
  sourcesTabPath,
  type SourcesTabId,
} from "../lib/sourcesTabs";
import type { NotifyFn } from "../lib/notify";
import { PrioritySettingsPanel } from "./PrioritySettingsPanel";
import { RecognitionSettingsPanel } from "./RecognitionSettingsPanel";
import { RetrySettingsPanel } from "./RetrySettingsPanel";
import { ScrapeConfigPanel } from "./ScrapeConfigPanel";

type Props = {
  path: string;
  onNavigate: (path: string) => void;
  notify: NotifyFn;
};

const TAB_LABEL: Record<SourcesTabId, string> = {
  providers: "数据源",
  retry: "重试",
  recognition: "识别",
  fields: "优先级",
};

export function SourcesPage({ path, onNavigate, notify }: Props) {
  const activeTab = parseSourcesTab(path);
  const [tabActions, setTabActions] = useState<
    Partial<Record<SourcesTabId, SettingsSaveActions | null>>
  >({});
  const handlersRef = useRef<
    Partial<Record<SourcesTabId, (actions: SettingsSaveActions | null) => void>>
  >({});

  useEffect(() => {
    if (path === "/sources/providers") {
      onNavigate("/sources");
    }
  }, [path, onNavigate]);

  function bindActions(id: SourcesTabId) {
    const cached = handlersRef.current[id];
    if (cached) return cached;
    const handler = (actions: SettingsSaveActions | null) => {
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

  async function switchTab(id: SourcesTabId) {
    if (id === activeTab) return;
    const cur = tabActions[activeTab];
    if (cur?.dirty) {
      const label = TAB_LABEL[activeTab];
      if (!window.confirm(`${label} Tab 有未保存的修改，确定离开？`)) return;
      if (cur.discard) await cur.discard();
    }
    onNavigate(sourcesTabPath(id));
  }

  const activeActions = tabActions[activeTab];
  const activeLabel = TAB_LABEL[activeTab];

  return (
    <>
      <div className="settings-tabs sources-tabs" role="tablist" aria-label="数据源分类">
        {SOURCES_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`settings-tab${activeTab === tab.id ? " active" : ""}`}
            onClick={() => void switchTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeActions ? (
        <div className="settings-save-bar" role="toolbar" aria-label="数据源保存">
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

      <div className="settings-panel sources-panel">
        {activeTab === "recognition" ? (
          <RecognitionSettingsPanel
            notify={notify}
            onActionsChange={bindActions("recognition")}
          />
        ) : activeTab === "retry" ? (
          <RetrySettingsPanel notify={notify} onActionsChange={bindActions("retry")} />
        ) : activeTab === "fields" ? (
          <PrioritySettingsPanel notify={notify} onActionsChange={bindActions("fields")} />
        ) : (
          <ScrapeConfigPanel
            notify={notify}
            variant="providers"
            onActionsChange={bindActions("providers")}
          />
        )}
      </div>
    </>
  );
}
