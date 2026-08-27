import { useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchScrapeConfig, saveScrapeConfig } from "../api";
import {
  SourcesHideSwitch,
  SourcesSubpage,
  SourcesSubpageActions,
  SourcesSubpageLoading,
  SourcesSubpagePanel,
} from "../components/SourcesSubpageLayout";
import { SourceChainDropdown } from "../components/SourceChainDropdown";
import type { NotifyFn } from "../lib/notify";
import type { ProviderCatalogRow, ScrapeConfig } from "../types";
type Props = {
  notify: NotifyFn;
  embedded?: boolean;
  value?: ScrapeConfig;
  catalog?: ProviderCatalogRow[];
  onChange?: (next: ScrapeConfig) => void;
};

type KindKey =
  | "japan_censored"
  | "japan_gravure"
  | "japan_uncensored"
  | "japan_amateur"
  | "fc2"
  | "china"
  | "western";

const GLOBAL_KIND_ITEMS: Array<{ id: KindKey; label: string }> = [
  { id: "japan_censored", label: "有码番号" },
  { id: "japan_gravure", label: "写真番号" },
  { id: "japan_uncensored", label: "无码番号" },
  { id: "japan_amateur", label: "素人番号" },
  { id: "fc2", label: "FC2 番号" },
  { id: "china", label: "国产番号" },
  { id: "western", label: "欧美影片" },
];

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

const DEFAULT_FIELD_PRIORITY: Record<string, string[]> = {
  cover: ["javbus", "jav321", "libredmm"],
  publishNumber: ["dmm", "jav321", "libredmm", "avbase"],
  titleZh: ["avsex", "iqqtv", "airav_io", "sevenmmtv"],
  outline: ["avsex", "iqqtv", "airav_io", "jav321"],
  plot: ["avsex", "iqqtv", "airav_io", "jav321"],
  originalPlot: ["dmm", "iqqtv", "jav321", "libredmm", "airav_io"],
  studio: ["javbus", "jav321", "libredmm"],
  actors: ["javbus", "jav321", "libredmm"],
  tags: ["javbus", "freejavbt", "airav_io"],
  series: ["javbus", "freejavbt", "jav321"],
};

const DEFAULT_KIND_META: Record<KindKey, string[]> = {
  japan_censored: ["javbus", "jav321", "libredmm", "freejavbt", "airav_io", "iqqtv", "avsex", "sevenmmtv"],
  japan_gravure: ["javbus", "jav321", "libredmm", "freejavbt", "airav_io", "iqqtv", "avsex", "sevenmmtv"],
  japan_uncensored: ["carib", "javbus", "jav321", "freejavbt", "iqqtv", "avsex", "sevenmmtv", "airav_io"],
  japan_amateur: ["javbus", "jav321", "libredmm", "freejavbt", "airav_io", "iqqtv", "avsex", "sevenmmtv"],
  fc2: ["fc2", "fd2ppv", "javdb"],
  china: ["madouqu", "madou", "xiao_huang_shu"],
  western: ["airav_io", "javdb", "miss_av"],
};

function fieldLabel(id: string): string {
  return FIELD_DEFS.find((f) => f.id === id)?.label ?? id;
}

function allFieldIds(config: ScrapeConfig): string[] {  const ids = new Set<string>(FIELD_DEFS.map((f) => f.id));
  for (const key of Object.keys(config.fieldPriority || {})) ids.add(key);
  for (const key of Object.keys(config.fieldBlockedSources || {})) ids.add(key);
  return [...ids];
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

export function PrioritySettingsPanel({
  notify,
  embedded = false,
  value,
  catalog: catalogProp,
  onChange,
}: Props) {
  const controlled = embedded && Boolean(value) && Boolean(onChange);
  const [config, setConfig] = useState<ScrapeConfig | null>(value ?? null);
  const [catalog, setCatalog] = useState<ProviderCatalogRow[]>(catalogProp ?? []);
  const [loading, setLoading] = useState(!controlled);
  const [saving, setSaving] = useState(false);
  const [hideEmptyFields, setHideEmptyFields] = useState(true);
  const [hideEmptyBlocks, setHideEmptyBlocks] = useState(true);

  useEffect(() => {
    if (!controlled) return;
    setConfig(
      value
        ? { ...value, fieldBlockedSources: value.fieldBlockedSources ?? {} }
        : null,
    );
    setCatalog(catalogProp ?? []);
    setLoading(false);
  }, [controlled, value, catalogProp]);

  useEffect(() => {
    if (controlled) return;
    void (async () => {
      setLoading(true);
      try {
        const data = await fetchScrapeConfig();
        setConfig({
          ...data.config,
          fieldBlockedSources: data.config.fieldBlockedSources ?? {},
        });
        setCatalog(data.catalog ?? []);
      } catch (e) {
        notify("error", e, "加载优先级配置失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [controlled, notify]);

  const fieldIds = useMemo(() => (config ? allFieldIds(config) : []), [config]);

  function commit(next: ScrapeConfig) {
    setConfig(next);
    if (controlled) onChange?.(next);
  }

  function patchKindMeta(kindId: KindKey, metaSources: string[]) {
    if (!config) return;
    const prev = config.kindProfiles[kindId] ?? {
      metaSources: [],
      coverSources: [],
      directoryTemplate: "",
      posterCrop: "right",
    };
    commit({
      ...config,
      kindProfiles: {
        ...config.kindProfiles,
        [kindId]: { ...prev, metaSources },
      },
    });
  }

  function patchFieldPriority(field: string, sources: string[]) {
    if (!config) return;
    const next = { ...config.fieldPriority };
    if (sources.length) next[field] = sources;
    else delete next[field];
    commit({ ...config, fieldPriority: next });
  }

  function patchFieldBlocked(field: string, blocked: string[]) {
    if (!config) return;
    const next = { ...(config.fieldBlockedSources ?? {}) };
    if (blocked.length) next[field] = blocked;
    else delete next[field];
    commit({ ...config, fieldBlockedSources: next });
  }

  function resetDefaults() {
    if (!config) return;
    if (!window.confirm("确定重置全局优先级、字段优先级与屏蔽列表为默认值？")) return;
    const kindProfiles = { ...config.kindProfiles };
    for (const item of GLOBAL_KIND_ITEMS) {
      const prev = kindProfiles[item.id] ?? {
        metaSources: [],
        coverSources: [],
        directoryTemplate: "",
        posterCrop: "right",
      };
      kindProfiles[item.id] = {
        ...prev,
        metaSources: [...DEFAULT_KIND_META[item.id]],
      };
    }
    commit({
      ...config,
      kindProfiles,
      fieldPriority: { ...DEFAULT_FIELD_PRIORITY },
      fieldBlockedSources: {},
    });
    notify("ok", controlled ? "已恢复默认优先级" : "已恢复默认优先级（请保存生效）");
  }

  async function save() {
    if (!config) return;
    if (controlled) {
      onChange?.(config);
      return;
    }
    setSaving(true);
    try {
      const { config: saved, catalog: nextCatalog } = await saveScrapeConfig({
        ...config,
        fieldBlockedSources: config.fieldBlockedSources ?? {},
      });
      setConfig({
        ...saved,
        fieldBlockedSources: saved.fieldBlockedSources ?? {},
      });
      if (nextCatalog) setCatalog(nextCatalog);
      notify("ok", "优先级配置已保存");
    } catch (e) {
      notify("error", e, "保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <SourcesSubpageLoading label="加载优先级配置…" />;
  }
  if (!config) {
    return <SourcesSubpageLoading label="配置不可用" />;
  }

  const blocked = config.fieldBlockedSources ?? {};
  const visibleFieldIds = fieldIds.filter((field) => {
    if (!hideEmptyFields) return true;
    return (config.fieldPriority[field]?.length ?? 0) > 0;
  });
  const visibleBlockIds = fieldIds.filter((field) => {
    if (!hideEmptyBlocks) return true;
    return (blocked[field]?.length ?? 0) > 0;
  });

  return (
    <SourcesSubpage>
      <SourcesSubpagePanel bodyClassName=" prio-compact-body">
        <PriorityBlock
          title="优先级设置（全局）"
          hint="将番号类型与刮削源匹配。这些源与下方字段优先级源会合并参与刮削；多源聚合时按链内从左到右选取"
        >
          {GLOBAL_KIND_ITEMS.map((item) => (
            <SourceChainDropdown
              key={item.id}
              label={item.label}
              values={config.kindProfiles[item.id]?.metaSources ?? []}
              catalog={catalog}
              onChange={(metaSources) => patchKindMeta(item.id, metaSources)}
              emptyText="暂无源，请选择"
            />
          ))}        </PriorityBlock>

        <div className="prio-block-divider" role="separator" />

        <PriorityBlock
          title="优先级设置（字段）"
          hint="为各个元数据字段配置刮削优先级。当字段优先级中的刮削源未获取到数据时，会使用全局优先级中的刮削源进行补充"
          headExtra={
            <SourcesHideSwitch checked={hideEmptyFields} onChange={setHideEmptyFields} />
          }
        >
          {visibleFieldIds.map((field) => (
            <SourceChainDropdown
              key={field}
              label={fieldLabel(field)}
              values={config.fieldPriority[field] ?? []}
              catalog={catalog}
              onChange={(sources) => patchFieldPriority(field, sources)}
              emptyText="未配置（继承全局源链）"
            />
          ))}        </PriorityBlock>

        <div className="prio-block-divider" role="separator" />

        <PriorityBlock
          title="屏蔽刮削源（字段）"
          hint="忽略配置刮削源返回的对应字段结果"
          headExtra={<SourcesHideSwitch checked={hideEmptyBlocks} onChange={setHideEmptyBlocks} />}
        >
          {visibleBlockIds.map((field) => (
            <SourceChainDropdown
              key={field}
              label={fieldLabel(field)}
              values={blocked[field] ?? []}
              catalog={catalog}
              onChange={(next) => patchFieldBlocked(field, next)}
              emptyText="未屏蔽"
            />
          ))}        </PriorityBlock>
      </SourcesSubpagePanel>

      {!embedded ? (
        <SourcesSubpageActions>
          <button type="button" className="btn ghost" disabled={saving} onClick={resetDefaults}>
            重置优先级
          </button>
          <button type="button" className="btn primary" disabled={saving} onClick={() => void save()}>
            {saving ? "保存中…" : "保存修改"}
          </button>
        </SourcesSubpageActions>
      ) : (
        <SourcesSubpageActions>
          <button type="button" className="btn ghost" onClick={resetDefaults}>
            重置优先级
          </button>
        </SourcesSubpageActions>
      )}
    </SourcesSubpage>
  );
}
