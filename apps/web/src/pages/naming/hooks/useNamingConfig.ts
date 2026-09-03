import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchScrapeConfig, saveScrapeConfig } from "../../../api";
import { useCachedQuery } from "../../../hooks/useCachedQuery";
import { useCacheDiscard } from "../../../hooks/settingsDiscard";
import { SCRAPE_CONFIG_KEY } from "../../../lib/queryCacheKeys";
import type { ScrapeConfig } from "../../../types";
import {
  mergeNaming,
  namingSnapshot,
  prepareConfigForSave,
  withMergedNaming,
} from "../configHelpers";
import { DEFAULT_NAMING, type Naming, type NamingSaveActions, type Props } from "../types";

export type { NamingSaveActions };

export function useNamingConfig({
  notify,
  embedded = false,
  value,
  onChange,
  onActionsChange,
}: Props) {
  const controlled = embedded && Boolean(value) && Boolean(onChange);
  const {
    data,
    loading: queryLoading,
    refreshing,
    setData,
    reload,
  } = useCachedQuery({
    key: SCRAPE_CONFIG_KEY,
    fetcher: async () => {
      const res = await fetchScrapeConfig();
      return { ...res, config: withMergedNaming(res.config) };
    },
    enabled: !controlled,
    onError: (e) => notify("error", e, "加载命名配置失败"),
  });
  const [baseline, setBaseline] = useState<Naming | null>(null);
  const [saving, setSaving] = useState(false);
  const dirtyRef = useRef(false);

  const config = controlled
    ? value
      ? withMergedNaming(value)
      : null
    : data?.config
      ? withMergedNaming(data.config)
      : null;
  const loading = controlled ? false : queryLoading;
  const naming = config ? ({ ...DEFAULT_NAMING, ...config.naming } as Naming) : null;

  const dirty = useMemo(() => {
    if (!config || !baseline || controlled) return false;
    return JSON.stringify(namingSnapshot(config)) !== JSON.stringify(baseline);
  }, [config, baseline, controlled]);

  dirtyRef.current = dirty;

  useEffect(() => {
    if (!config || controlled) return;
    const next = namingSnapshot(config);
    if (!dirtyRef.current) {
      setBaseline(next);
    } else {
      setBaseline((prev) => prev ?? next);
    }
  }, [config, controlled]);

  function commit(next: ScrapeConfig) {
    if (controlled) {
      onChange?.(next);
      return;
    }
    setData((prev) => (prev ? { ...prev, config: next } : prev));
  }

  function patchNaming(partial: Partial<Naming>) {
    if (!config) return;
    commit({ ...config, naming: { ...DEFAULT_NAMING, ...config.naming, ...partial } });
  }

  const save = useCallback(async () => {
    if (!config) return;
    const payload = prepareConfigForSave(config);
    if (controlled) {
      commit(payload);
      return;
    }
    setSaving(true);
    try {
      const { config: saved } = await saveScrapeConfig(payload);
      const normalized = withMergedNaming(saved);
      setData((prev) => (prev ? { ...prev, config: normalized } : prev));
      setBaseline(namingSnapshot(normalized));
      notify("ok", "命名配置已保存");
    } catch (e) {
      notify("error", e, "保存失败");
    } finally {
      setSaving(false);
    }
  }, [config, controlled, commit, notify, setData]);

  const resetLocal = useCallback(() => {
    dirtyRef.current = false;
    setBaseline(null);
  }, []);
  const discard = useCacheDiscard(SCRAPE_CONFIG_KEY, reload, resetLocal);

  useEffect(() => {
    if (embedded || !onActionsChange) return;
    onActionsChange({ dirty, saving, save, discard });
    return () => onActionsChange(null);
  }, [dirty, saving, save, discard, embedded, onActionsChange]);

  return {
    config,
    naming,
    loading,
    refreshing,
    saving,
    dirty,
    embedded,
    commit,
    patchNaming,
    save,
  };
}
