import { useCallback, useMemo, useState } from "react";
import { saveScrapeConfig } from "../api";
import {
  SourcesSubpage,
  SourcesSubpageActions,
  SourcesSubpageLoading,
  SourcesSubpagePanel,
} from "../components/SourcesSubpageLayout";
import { SettingRow } from "../components/SettingRow";
import {
  useDirtyBaseline,
  useReportSaveActions,
  type SettingsSaveActions,
} from "../hooks/useDirtyBaseline";
import { useCacheDiscard } from "../hooks/settingsDiscard";
import { useSharedScrapeConfig } from "../hooks/useSharedScrapeConfig";
import { SCRAPE_CONFIG_KEY } from "../lib/queryCacheKeys";
import type { NotifyFn } from "../lib/notify";
import type { ScrapeConfig } from "../types";

type Props = {
  notify: NotifyFn;
  embedded?: boolean;
  value?: ScrapeConfig;
  onChange?: (next: ScrapeConfig) => void;
  onActionsChange?: (actions: SettingsSaveActions | null) => void;
};

export function RetrySettingsPanel({
  notify,
  embedded = false,
  value,
  onChange,
  onActionsChange,
}: Props) {
  const controlled = embedded && Boolean(value) && Boolean(onChange);
  const { config, loading, refreshing, setConfig, reload } = useSharedScrapeConfig({
    controlled,
    value,
    onError: (e) => notify("error", e, "加载重试配置失败"),
  });
  const [saving, setSaving] = useState(false);

  const snap = useMemo(
    () => (config && !controlled ? { providerRetryDefault: config.providerRetryDefault ?? 0 } : null),
    [config, controlled],
  );
  const { dirty, markClean } = useDirtyBaseline({ current: snap, enabled: !controlled });
  const discard = useCacheDiscard(SCRAPE_CONFIG_KEY, reload);

  function commit(next: ScrapeConfig) {
    setConfig(next);
    if (controlled) onChange?.(next);
  }

  const save = useCallback(async () => {
    if (!config) return;
    if (controlled) {
      onChange?.(config);
      return;
    }
    setSaving(true);
    try {
      const retry = Math.max(0, Math.floor(config.providerRetryDefault ?? 0));
      const { config: saved } = await saveScrapeConfig({ ...config, providerRetryDefault: retry });
      setConfig(saved);
      markClean({ providerRetryDefault: saved.providerRetryDefault ?? 0 });
      notify("ok", "重试设置已保存");
    } catch (e) {
      notify("error", e, "保存失败");
    } finally {
      setSaving(false);
    }
  }, [config, controlled, markClean, notify, onChange, setConfig]);

  useReportSaveActions(!embedded, dirty, saving, save, onActionsChange, discard);

  if (loading && !config) {
    return <SourcesSubpageLoading label="加载重试配置…" />;
  }
  if (!config) {
    return <SourcesSubpageLoading label="配置不可用" />;
  }

  const retry = config.providerRetryDefault ?? 0;

  return (
    <SourcesSubpage className={refreshing ? "is-refreshing" : undefined}>
      <SourcesSubpagePanel
        title="重试设置（全局）"
        description="当数据源未开启覆盖时，使用该重试次数作为默认值"
        bodyClassName=" mon-panel-body--pad"
      >
        <div className="sources-form-card">
          <SettingRow
            label="全局默认失败重试次数"
            hint="不含首次请求；单源可在卡片详情中覆盖"
            layout="stack"
          >
            <input
              className="org-input sources-number-input"
              type="number"
              min={0}
              max={10}
              step={1}
              value={retry}
              onChange={(e) => {
                const next = Math.max(0, Math.floor(Number(e.target.value) || 0));
                commit({ ...config, providerRetryDefault: next });
              }}
            />
          </SettingRow>
        </div>
      </SourcesSubpagePanel>
      {embedded ? (
        <SourcesSubpageActions>
          <button type="button" className="btn primary" disabled={saving} onClick={() => void save()}>
            {saving ? "保存中…" : "保存配置"}
          </button>
        </SourcesSubpageActions>
      ) : null}
    </SourcesSubpage>
  );
}
