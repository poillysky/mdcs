import { useEffect } from "react";
import {
  parseSourcesTab,
  SOURCES_TABS,
  sourcesTabPath,
  type SourcesTabId,
} from "../lib/sourcesTabs";
import type { NotifyFn } from "../lib/notify";
import { ScrapeConfigPanel } from "./ScrapeConfigPanel";

type Props = {
  path: string;
  onNavigate: (path: string) => void;
  notify: NotifyFn;
};

export function SourcesPage({ path, onNavigate, notify }: Props) {
  const activeTab = parseSourcesTab(path);

  useEffect(() => {
    if (path === "/sources/providers") {
      onNavigate("/sources");
    }
  }, [path, onNavigate]);

  function switchTab(id: SourcesTabId) {
    onNavigate(sourcesTabPath(id));
  }

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
            onClick={() => switchTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="settings-panel sources-panel">
        <ScrapeConfigPanel
          notify={notify}
          variant={activeTab === "fields" ? "fields" : "providers"}
        />
      </div>
    </>
  );
}
