import { useEffect, useState } from "react";
import { fetchOpsConfig, saveOpsConfig } from "../api";
import { SettingRow } from "../components/SettingRow";
import type { NotifyFn } from "../lib/notify";
import type { KindRow, OpsConfig } from "../types";
import { KindPathsPanel } from "./KindPathsPanel";

type Props = {
  kinds: KindRow[];
  kindsLoading?: boolean;
  onChanged: () => void;
  notify: NotifyFn;
};

export function MonitorSettingsPanel({ kinds, kindsLoading, onChanged, notify }: Props) {
  const [config, setConfig] = useState<OpsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const data = await fetchOpsConfig();
        setConfig(data.config);
      } catch (e) {
        notify("error", e, "加载监控配置失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [notify]);

  function patchMonitor(partial: Partial<OpsConfig["monitor"]>) {
    if (!config) return;
    setConfig({ ...config, monitor: { ...config.monitor, ...partial } });
  }

  async function save() {
    if (!config) return;
    setSaving(true);
    try {
      const payload = {
        ...config,
        qb: config.qb ?? { enabled: false, jobMode: "full", kinds: [], categories: [] },
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
      const { config: saved } = await saveOpsConfig(payload);
      setConfig(saved);
      notify("ok", "监控配置已保存并立即生效");
    } catch (e) {
      notify("error", e, "保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !config) {
    return <div className="empty-block">加载监控配置…</div>;
  }

  const m = config.monitor;
  const monitorOff = !m.enabled;

  return (
    <div className="monitor-settings">
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
            <SettingRow label="轮询间隔（秒）" hint="建议 30–120">
              <input
                className="org-input-sm"
                type="number"
                min={10}
                max={600}
                disabled={monitorOff}
                value={m.intervalSec}
                onChange={(e) => patchMonitor({ intervalSec: Number(e.target.value) || 30 })}
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

      <div className="page-save-row">
        <button type="button" className="btn primary" disabled={saving} onClick={() => void save()}>
          {saving ? "保存中…" : "保存监控配置"}
        </button>
      </div>
    </div>
  );
}
