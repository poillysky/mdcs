import { useMemo, useState, type ReactNode } from "react";
import { SOURCES_TABS, type SourcesTabId } from "../lib/sourcesTabs";
import type { NotifyFn } from "../lib/notify";
import type { ProviderCatalogRow, ScrapeConfig } from "../types";
import { RecognitionSettingsPanel } from "../pages/RecognitionSettingsPanel";
import { RetrySettingsPanel } from "../pages/RetrySettingsPanel";
import { ScrapeConfigPanel } from "../pages/ScrapeConfigPanel";
import { SourceChainDropdown } from "./SourceChainDropdown";
import { SourcesHideSwitch, SourcesSubpage, SourcesSubpagePanel } from "./SourcesSubpageLayout";

const FIELD_DEFS: Array<{ id: string; label: string }> = [
  { id: "title", label: "标题 (Title)" },
  { id: "publishNumber", label: "发行码 (PublishNumber)" },
  { id: "titleZh", label: "中文标题 (TitleZh)" },
  { id: "originaltitle", label: "原标题 (OriginalTitle)" },
  { id: "outline", label: "简介 (Outline)" },
  { id: "plot", label: "剧情 (Plot)" },
  { id: "originalPlot", label: "原简介 (OriginalPlot)" },
  { id: "actors", label: "演员 (Actors)" },
  { id: "cover", label: "封面 (Cover)" },
  { id: "poster", label: "海报 (Poster)" },
  { id: "extrafanart", label: "剧照 (ExtraFanart)" },
  { id: "tags", label: "标签 (Tags)" },
  { id: "genres", label: "类型 (Genres)" },
  { id: "premiered", label: "发布日期 (Release)" },
  { id: "runtime", label: "影片时长 (Runtime)" },
  { id: "score", label: "用户评分 (UserRating)" },
  { id: "directors", label: "导演 (Director)" },
  { id: "series", label: "系列 (Series)" },
  { id: "studio", label: "厂商 (Studio)" },
  { id: "publisher", label: "出品 (Publisher)" },
  { id: "votes", label: "想看人数 (UserVotes)" },
];

function fieldLabel(id: string): string {
  return FIELD_DEFS.find((f) => f.id === id)?.label ?? id;
}

function allFieldIds(fieldPriority?: Record<string, string[]>): string[] {
  const ids = new Set<string>(FIELD_DEFS.map((f) => f.id));
  for (const key of Object.keys(fieldPriority ?? {})) ids.add(key);
  return [...ids];
}

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

function PriorityBlock({
  title,
  hint,
  headExtra,
  children,
}: {
  title: string;
  hint: string;
  headExtra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="prio-block">
      <div className="prio-block-head">
        <div className="prio-block-head-top">
          <h3 className="prio-block-title">{title}</h3>
          {headExtra}
        </div>
        <p className="prio-block-desc">{hint}</p>
      </div>
      <div className="prio-compact-list">{children}</div>
    </div>
  );
}

export type KindSourcesProfile = {
  metaSources: string[];
  coverSources: string[];
  fieldPriority?: Record<string, string[]>;
};

type Props = {
  kindLabel: string;
  scrape: ScrapeConfig;
  catalog: ProviderCatalogRow[];
  profile: KindSourcesProfile;
  onScrapeChange: (next: ScrapeConfig, catalog?: ProviderCatalogRow[]) => void;
  onProfileChange: (patch: Partial<KindSourcesProfile>) => void;
  notify: NotifyFn;
};

export function KindSourcesSettingsView({
  kindLabel,
  scrape,
  catalog,
  profile,
  onScrapeChange,
  onProfileChange,
  notify,
}: Props) {
  const [subTab, setSubTab] = useState<SourcesTabId>("providers");
  const [hideEmptyFields, setHideEmptyFields] = useState(true);

  const draftCatalog = useMemo(
    () => catalogWithDisabled(catalog, scrape.disabledProviders),
    [catalog, scrape.disabledProviders],
  );

  const fieldIds = useMemo(() => allFieldIds(profile.fieldPriority), [profile.fieldPriority]);
  const visibleFieldIds = fieldIds.filter((field) => {
    if (!hideEmptyFields) return true;
    return (profile.fieldPriority?.[field]?.length ?? 0) > 0;
  });

  function commitScrape(next: ScrapeConfig, nextCatalog?: ProviderCatalogRow[]) {
    onScrapeChange(next, nextCatalog);
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
            value={scrape}
            onChange={(next) => commitScrape(next)}
          />
        ) : subTab === "retry" ? (
          <RetrySettingsPanel
            notify={notify}
            embedded
            value={scrape}
            onChange={(next) => commitScrape(next)}
          />
        ) : subTab === "fields" ? (
          <SourcesSubpage>
            <SourcesSubpagePanel bodyClassName=" prio-compact-body">
              <PriorityBlock
                title="优先级设置（分区）"
                hint="为本分区配置元数据与封面源链；关闭「使用全局配置」后仅对本分区生效"
              >
                <SourceChainDropdown
                  label={`${kindLabel} · 元数据源链`}
                  values={profile.metaSources}
                  catalog={catalog}
                  onChange={(metaSources) => onProfileChange({ metaSources })}
                  emptyText="暂无源，请选择"
                />
                <SourceChainDropdown
                  label={`${kindLabel} · 封面源链`}
                  values={profile.coverSources}
                  catalog={catalog}
                  onChange={(coverSources) => onProfileChange({ coverSources })}
                  emptyText="暂无源，请选择"
                />
              </PriorityBlock>

              <div className="prio-block-divider" role="separator" />

              <PriorityBlock
                title="优先级设置（字段）"
                hint="覆盖全局字段优先级；留空则继承侧栏「数据源 → 优先级配置」"
                headExtra={
                  <SourcesHideSwitch checked={hideEmptyFields} onChange={setHideEmptyFields} />
                }
              >
                {visibleFieldIds.map((field) => (
                  <SourceChainDropdown
                    key={field}
                    label={fieldLabel(field)}
                    values={profile.fieldPriority?.[field] ?? []}
                    catalog={catalog}
                    onChange={(sources) => {
                      const next = { ...(profile.fieldPriority ?? {}) };
                      if (sources.length) next[field] = sources;
                      else delete next[field];
                      onProfileChange({ fieldPriority: next });
                    }}
                    emptyText="未配置（继承全局源链）"
                  />
                ))}
              </PriorityBlock>
            </SourcesSubpagePanel>
          </SourcesSubpage>
        ) : (
          <ScrapeConfigPanel
            notify={notify}
            variant="providers"
            embedded
            value={scrape}
            catalog={draftCatalog}
            onChange={(next, nextCatalog) => commitScrape(next, nextCatalog)}
          />
        )}
      </div>
    </div>
  );
}
