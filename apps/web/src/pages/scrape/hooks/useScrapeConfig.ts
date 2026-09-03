import { useCallback, useState } from "react";
import { fetchScrapeConfig, saveScrapeConfig } from "../../../api";
import { useCachedQuery } from "../../../hooks/useCachedQuery";
import { useCacheDiscard } from "../../../hooks/settingsDiscard";
import { useReportSaveActions } from "../../../hooks/useDirtyBaseline";
import { SCRAPE_CONFIG_KEY } from "../../../lib/queryCacheKeys";
import type { ProviderCatalogRow, ScrapeConfig } from "../../../types";
import type { ScrapeConfigPanelProps } from "../types";

export function useScrapeConfig({
  notify,
  embedded = false,
  value,
  catalog: catalogProp,
  onChange,
  onActionsChange,
}: ScrapeConfigPanelProps) {
  const controlled = embedded && Boolean(value) && Boolean(onChange);
  const {
    data,
    loading: queryLoading,
    refreshing,
    setData,
    reload,
  } = useCachedQuery({
    key: SCRAPE_CONFIG_KEY,
    fetcher: fetchScrapeConfig,
    enabled: !controlled,
    onError: (e) => notify("error", e, "加载失败"),
  });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const config = controlled ? (value ?? null) : (data?.config ?? null);
  const catalog = controlled ? (catalogProp ?? []) : (data?.catalog ?? []);
  const loading = controlled ? false : queryLoading;

  function commit(next: ScrapeConfig, nextCatalog?: ProviderCatalogRow[]) {
    if (controlled) {
      onChange?.(next, nextCatalog ?? catalog);
      return;
    }
    setData((prev) => {
      if (prev) {
        return { ...prev, config: next, catalog: nextCatalog ?? prev.catalog ?? [] };
      }
      return {
        config: next,
        catalog: nextCatalog ?? [],
        providers: [],
      };
    });
  }

  function patch(next: Partial<ScrapeConfig>) {
    if (!config) return;
    commit({ ...config, ...next });
  }

  function blockSourceFromField(field: string, sourceId: string) {
    if (!config) return;
    const list = config.fieldPriority[field] ?? [];
    commit({
      ...config,
      fieldPriority: { ...config.fieldPriority, [field]: list.filter((s) => s !== sourceId) },
    });
  }

  function setFieldPriorityList(field: string, raw: string) {
    if (!config) return;
    const next = raw
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    commit({
      ...config,
      fieldPriority: { ...config.fieldPriority, [field]: next },
    });
  }

  async function save(okMsg: string, nextConfig?: ScrapeConfig) {
    const payload = nextConfig ?? config;
    if (!payload) return;
    if (controlled) {
      commit(payload);
      return;
    }
    setSaving(true);
    try {
      const { config: saved, catalog: nextCatalog } = await saveScrapeConfig(payload);
      setData((prev) =>
        prev
          ? { ...prev, config: saved, catalog: nextCatalog ?? prev.catalog ?? [] }
          : { config: saved, catalog: nextCatalog ?? [], providers: [] },
      );
      notify("ok", okMsg);
    } catch (e) {
      notify("error", e, "保存失败");
    } finally {
      setSaving(false);
    }
  }

  // Provider Tab 改即存：dirty 恒为 false；discard 仍可在跨 Tab 放弃时刷新缓存
  const saveNoop = useCallback(async () => {}, []);
  const discard = useCacheDiscard(SCRAPE_CONFIG_KEY, reload);
  useReportSaveActions(!embedded && !controlled, false, saving, saveNoop, onActionsChange, discard);

  return {
    controlled,
    config,
    catalog,
    loading,
    refreshing,
    saving,
    editId,
    setEditId,
    commit,
    patch,
    blockSourceFromField,
    setFieldPriorityList,
    save,
  };
}
