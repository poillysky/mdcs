import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveOpsConfig } from "../api";
import { SettingRow } from "../components/SettingRow";
import { PanelSkeleton } from "../components/ui/PanelSkeleton";
import { useSharedOpsConfig } from "../hooks/useSharedOpsConfig";
import { useCacheDiscard } from "../hooks/settingsDiscard";
import type { SettingsSaveActions } from "../hooks/useDirtyBaseline";
import type { NotifyFn } from "../lib/notify";
import { OPS_CONFIG_KEY } from "../lib/queryCacheKeys";
import type { KindRow, OpsConfig } from "../types";
import { KindPathsPanel } from "./KindPathsPanel";

export type MonitorSaveActions = SettingsSaveActions;

type Props = {
  kinds: KindRow[];
  kindsLoading?: boolean;
  onChanged: () => void;
  onActionsChange: (actions: MonitorSaveActions | null) => void;
  notify: NotifyFn;
};

function cloneMonitor(m: OpsConfig["monitor"]): OpsConfig["monitor"] {
  return {
    ...m,
    entries: m.entries.map((e) => ({ ...e, kinds: [...e.kinds] })),
  };
}

function withOpsDefaults(config: OpsConfig): OpsConfig {
  return {
    ...config,
    presets: config.presets ?? [],
    actors: config.actors ?? {
      source: "local" as const,
      embyUrl: "",
      embyApiKey: "",
      embyUserId: "",
      libraryIds: [],
      autoScrapeEnabled: false,
      autoScrapeRecentDays: 0,
      refreshLibraryAfterScrape: false,
      scrapeMetadata: true,
      scrapeImages: true,
      metadataOverwrite: "missing" as const,
    },
  };
}

export function MonitorSettingsPanel({
  kinds,
  kindsLoading,
  onChanged,
  onActionsChange,
  notify,
}: Props) {
  const { config, loading, refreshing, setConfig, reload } = useSharedOpsConfig({
    onError: (e) => notify("error", e, "加载监控配置失败"),
  });
  const [baselineMonitor, setBaselineMonitor] = useState<OpsConfig["monitor"] | null>(() =>
    config ? cloneMonitor(config.monitor) : null,
  );
  const [saving, setSaving] = useState(false);
  const dirtyRef = useRef(false);

  const dirty = useMemo(() => {
    if (!config || !baselineMonitor) return false;
    return JSON.stringify(config.monitor) !== JSON.stringify(baselineMonitor);
  }, [config, baselineMonitor]);

  dirtyRef.current = dirty;

  useEffect(() => {
    if (!config) return;
    const next = cloneMonitor(config.monitor);
    if (!dirtyRef.current) {
      setBaselineMonitor(next);
    } else {
      setBaselineMonitor((prev) => prev ?? next);
    }
  }, [config]);

  function patchMonitor(partial: Partial<OpsConfig["monitor"]>) {
    if (!config) return;
    setConfig({ ...config, monitor: { ...config.monitor, ...partial } });
  }

  const save = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    try {
      const { config: saved } = await saveOpsConfig(withOpsDefaults(config));
      setConfig(saved);
      setBaselineMonitor(cloneMonitor(saved.monitor));
      notify("ok", "监控配置已保存并立即生效");
    } catch (e) {
      notify("error", e, "保存失败");
    } finally {
      setSaving(false);
    }
  }, [config, notify, setConfig]);

  const resetLocal = useCallback(() => {
    dirtyRef.current = false;
    setBaselineMonitor(null);
  }, []);
  const discard = useCacheDiscard(OPS_CONFIG_KEY, reload, resetLocal);

  useEffect(() => {
    onActionsChange({ dirty, saving, save, discard });
    return () => onActionsChange(null);
  }, [dirty, saving, save, discard, onActionsChange]);

  if (loading && !config) {
    return <PanelSkeleton label="加载监控配置…" lines={5} />;
  }

  if (!config) {
    return <PanelSkeleton label="监控配置不可用" lines={4} />;
  }

  const m = config.monitor;
  const monitorOff = !m.enabled;

  return (
    <div className={`monitor-settings${refreshing ? " is-refreshing" : ""}`}>
      <section className={`mon-panel${monitorOff ? " is-off" : ""}`}>
        <header className="mon-panel-head">
          <h3 className="mon-panel-title">目录监控</h3>
          <label className="switch" title="启用目录监控">
            <input
              type="checkbox"
              checked={m.enabled}
              onChange={(e) => patchMonitor({ enabled: e.target.checked })}
            />
            <span />
          </label>
        </header>

        <div className="mon-panel-body">
          <SettingRow
            label="监控模式"
            hint={
              m.mode === "compat"
                ? "约按间隔轮询，适合 SMB/NFS"
                : "文件系统事件，仅本机原生目录"
            }
          >
            <select
              className="org-select"
              value={m.mode}
              disabled={monitorOff}
              onChange={(e) =>
                patchMonitor({ mode: e.target.value as OpsConfig["monitor"]["mode"] })
              }
            >
              <option value="compat">兼容模式</option>
              <option value="performance">性能模式</option>
            </select>
          </SettingRow>
          {m.mode === "compat" ? (
            <SettingRow label="轮询间隔（秒）" hint="建议 30–120，范围 10–600">
              <input
                className="org-input-sm"
                type="number"
                min={10}
                max={600}
                disabled={monitorOff}
                value={m.intervalSec}
                onChange={(e) => {
                  const n = Math.max(
                    10,
                    Math.min(600, Math.floor(Number(e.target.value) || 30)),
                  );
                  patchMonitor({ intervalSec: n });
                }}
              />
            </SettingRow>
          ) : (
            <SettingRow label="事件监听" hint="网络盘失效时请改回兼容模式">
              <span className="mon-inline-note">FS 事件已启用</span>
            </SettingRow>
          )}
        </div>
      </section>

      <KindPathsPanel
        kinds={kinds}
        loading={kindsLoading}
        onChanged={onChanged}
        notify={notify}
      />

    </div>
  );
}
