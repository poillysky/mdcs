import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchScrapeConfig, fetchWatermarkStyles, saveScrapeConfig } from "../../../api";
import { useCachedQuery } from "../../../hooks/useCachedQuery";
import { useCacheDiscard } from "../../../hooks/settingsDiscard";
import {
  useDirtyBaseline,
  useReportSaveActions,
  type SettingsSaveActions,
} from "../../../hooks/useDirtyBaseline";
import { SCRAPE_CONFIG_KEY, WATERMARK_STYLES_KEY } from "../../../lib/queryCacheKeys";
import type { ScrapeConfig } from "../../../types";
import {
  DEFAULT_WATERMARK,
  asCorner,
  type WatermarkSettingsPanelProps,
  type Wm,
} from "../types";

export type { SettingsSaveActions as WatermarkSaveActions };

function withWatermarkDefaults(cfg: ScrapeConfig): ScrapeConfig {
  return {
    ...cfg,
    watermark: { ...DEFAULT_WATERMARK, ...cfg.watermark },
  };
}

function watermarkSnapshot(cfg: ScrapeConfig): Wm {
  return {
    ...DEFAULT_WATERMARK,
    ...cfg.watermark,
    position: asCorner(cfg.watermark?.position),
  };
}

export function useWatermarkConfig({
  notify,
  embedded = false,
  value,
  onChange,
  onActionsChange,
}: WatermarkSettingsPanelProps) {
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
      return { ...res, config: withWatermarkDefaults(res.config) };
    },
    enabled: !controlled,
    onError: (e) => notify("error", e, "加载水印配置失败"),
  });
  const { data: stylesData } = useCachedQuery({
    key: WATERMARK_STYLES_KEY,
    fetcher: fetchWatermarkStyles,
  });
  const [saving, setSaving] = useState(false);

  const config = controlled
    ? value
      ? withWatermarkDefaults(value)
      : null
    : data?.config
      ? withWatermarkDefaults(data.config)
      : null;
  const loading = controlled ? false : queryLoading;
  const styleOptions = stylesData?.styles?.length ? stylesData.styles : ["default"];

  const w: Wm = useMemo(
    () => (config ? watermarkSnapshot(config) : { ...DEFAULT_WATERMARK }),
    [config],
  );

  const snapshot = config && !controlled ? watermarkSnapshot(config) : null;
  const { dirty, markClean } = useDirtyBaseline({ current: snapshot, enabled: !controlled });

  function commit(next: ScrapeConfig) {
    if (controlled) {
      onChange?.(next);
      return;
    }
    setData((prev) => (prev ? { ...prev, config: next } : prev));
  }

  function patch(partial: Partial<Wm>) {
    if (!config) return;
    commit({
      ...config,
      watermark: { ...DEFAULT_WATERMARK, ...config.watermark, ...partial },
    });
  }

  const save = useCallback(async () => {
    if (!config) return;
    if (controlled) {
      commit(config);
      return;
    }
    setSaving(true);
    try {
      const { config: saved } = await saveScrapeConfig(config);
      const normalized = withWatermarkDefaults(saved);
      setData((prev) => (prev ? { ...prev, config: normalized } : prev));
      markClean(watermarkSnapshot(normalized));
      notify("ok", "水印配置已保存");
    } catch (e) {
      notify("error", e, "保存失败");
    } finally {
      setSaving(false);
    }
  }, [config, controlled, markClean, notify, setData]);

  const discard = useCacheDiscard(SCRAPE_CONFIG_KEY, reload);

  useReportSaveActions(!embedded, dirty, saving, save, onActionsChange, discard);

  return {
    loading,
    refreshing,
    config,
    w,
    styleSelectOptions: styleOptions,
    embedded,
    saving,
    dirty,
    notify,
    patch,
    save,
  };
}
