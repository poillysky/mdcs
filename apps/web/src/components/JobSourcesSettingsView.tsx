import { useMemo, useState } from "react";
import { SOURCES_TABS, type SourcesTabId } from "../lib/sourcesTabs";
import {
  applyJobSources,
  scrapeToJobSources,
  type JobSourcesOptions,
} from "../lib/jobOptions";
import type { NotifyFn } from "../lib/notify";
import type { ProviderCatalogRow, ScrapeConfig } from "../types";
import { PrioritySettingsPanel } from "../pages/PrioritySettingsPanel";
import { RecognitionSettingsPanel } from "../pages/RecognitionSettingsPanel";
import { RetrySettingsPanel } from "../pages/RetrySettingsPanel";
import { ScrapeConfigPanel } from "../pages/ScrapeConfigPanel";

type Props = {
  scrape: ScrapeConfig;
  catalog: ProviderCatalogRow[];
  value?: JobSourcesOptions;
  onChange: (next: JobSourcesOptions) => void;
  notify: NotifyFn;
};

function catalogWithDisabled(
  catalog: ProviderCatalogRow[],
  disabledProviders: string[] | undefined,
): ProviderCatalogRow[] {
  const disabled = new Set(disabledProviders ?? []);
  return catalog.map((row) => ({
    ...row,
    enabled: !disabled.has(row.id),
  }));
}

export function JobSourcesSettingsView({
  scrape,
  catalog,
  value,
  onChange,
  notify,
}: Props) {
  const [subTab, setSubTab] = useState<SourcesTabId>("providers");

  const draft = useMemo(() => applyJobSources(scrape, value), [scrape, value]);
  const draftCatalog = useMemo(
    () => catalogWithDisabled(catalog, draft.disabledProviders),
    [catalog, draft.disabledProviders],
  );

  function commitScrape(next: ScrapeConfig, nextCatalog?: ProviderCatalogRow[]) {
    const sources = scrapeToJobSources(next);
    if (nextCatalog) {
      sources.disabledProviders = nextCatalog.filter((r) => !r.enabled).map((r) => r.id);
    }
    onChange(sources);
  }

  return (
    <div className="advanced-job-sources">
      <div className="settings-tabs sources-tabs" role="tablist" aria-label="数据源分类">
        {SOURCES_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={subTab === tab.id}
            className={`settings-tab${subTab === tab.id ? " active" : ""}`}
            onClick={() => setSubTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="settings-panel sources-panel advanced-job-sources-panel">
        {subTab === "recognition" ? (
          <RecognitionSettingsPanel
            notify={notify}
            embedded
            value={draft}
            onChange={(next) => commitScrape(next)}
          />
        ) : subTab === "retry" ? (
          <RetrySettingsPanel
            notify={notify}
            embedded
            value={draft}
            onChange={(next) => commitScrape(next)}
          />
        ) : subTab === "fields" ? (
          <PrioritySettingsPanel
            notify={notify}
            embedded
            value={draft}
            catalog={draftCatalog}
            onChange={(next) => commitScrape(next)}
          />
        ) : (
          <ScrapeConfigPanel
            notify={notify}
            variant="providers"
            embedded
            value={draft}
            catalog={draftCatalog}
            onChange={(next, nextCatalog) => commitScrape(next, nextCatalog)}
          />
        )}
      </div>
    </div>
  );
}
