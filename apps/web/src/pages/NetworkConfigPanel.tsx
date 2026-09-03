import { useCallback, useState, type ReactNode } from "react";
import { fetchScrapeConfig, saveScrapeConfig, testNetworkConnection } from "../api";
import { SettingRow } from "../components/SettingRow";
import { PanelSkeleton } from "../components/ui/PanelSkeleton";
import { useCachedQuery } from "../hooks/useCachedQuery";
import { useCacheDiscard } from "../hooks/settingsDiscard";
import {
  useDirtyBaseline,
  useReportSaveActions,
  type SettingsSaveActions,
} from "../hooks/useDirtyBaseline";
import { COPY } from "../lib/messages";
import { SCRAPE_CONFIG_KEY } from "../lib/queryCacheKeys";
import type { NotifyFn } from "../lib/notify";
import type { ScrapeConfig } from "../types";

export type NetworkSaveActions = SettingsSaveActions;

type Props = {
  notify: NotifyFn;
  onActionsChange?: (actions: NetworkSaveActions | null) => void;
};

type TestTarget = "direct" | "proxy" | "flare";

type NetworkSnapshot = {
  proxyUrl: string;
  flareSolverrUrl: string;
  requestTimeoutSec: number;
};

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="set-section">
      <div className="set-section-head">
        <div className="set-section-title">{title}</div>
        {hint ? <p className="set-section-sub">{hint}</p> : null}
      </div>
      <div className="set-section-body">{children}</div>
    </div>
  );
}

function networkSnapshot(cfg: ScrapeConfig): NetworkSnapshot {
  return {
    proxyUrl: cfg.proxyUrl || "",
    flareSolverrUrl: cfg.flareSolverrUrl || "",
    requestTimeoutSec: Math.max(5, Math.min(120, Number(cfg.requestTimeoutSec) || 30)),
  };
}

export function NetworkConfigPanel({ notify, onActionsChange }: Props) {
  const { data, loading, refreshing, setData, reload } = useCachedQuery({
    key: SCRAPE_CONFIG_KEY,
    fetcher: fetchScrapeConfig,
    onError: (e) => notify("error", e, "加载失败"),
  });
  const config = data?.config ?? null;
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<TestTarget | null>(null);
  const snapshot = config ? networkSnapshot(config) : null;
  const { dirty, markClean } = useDirtyBaseline({ current: snapshot });

  function patch(next: Partial<ScrapeConfig>) {
    if (!data) return;
    setData({ ...data, config: { ...data.config, ...next } });
  }

  const save = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    try {
      const payload = {
        ...config,
        requestTimeoutSec: Math.max(5, Math.min(120, Number(config.requestTimeoutSec) || 30)),
      };
      const { config: saved } = await saveScrapeConfig(payload);
      setData((prev) => (prev ? { ...prev, config: saved } : prev));
      markClean(networkSnapshot(saved));
      notify("ok", "网络配置已保存");
    } catch (e) {
      notify("error", e, "保存失败");
    } finally {
      setSaving(false);
    }
  }, [config, markClean, notify, setData]);

  const discard = useCacheDiscard(SCRAPE_CONFIG_KEY, reload);

  useReportSaveActions(true, dirty, saving, save, onActionsChange, discard);

  async function runTest(target: TestTarget) {
    if (!config) return;
    setTesting(target);
    try {
      const result = await testNetworkConnection({
        target,
        proxyUrl: config.proxyUrl,
        flareSolverrUrl: config.flareSolverrUrl,
        timeoutSec: Math.max(5, Math.min(120, Number(config.requestTimeoutSec) || 30)),
      });
      notify(result.ok ? "ok" : "warn", `${result.message}（${result.ms}ms）`, COPY.testConnection);
    } catch (e) {
      notify("error", e, COPY.testConnection);
    } finally {
      setTesting(null);
    }
  }

  if (loading && !config) {
    return <PanelSkeleton label="加载网络配置…" lines={6} />;
  }

  if (!config) {
    return <PanelSkeleton label="网络配置不可用" lines={4} />;
  }

  const busy = testing !== null;
  const proxyReady = Boolean(config.proxyUrl.trim());
  const flareReady = Boolean(config.flareSolverrUrl.trim());

  return (
    <div className={`network-settings${refreshing ? " is-refreshing" : ""}`}>
      <section className="mon-panel settings-form">
        <header className="mon-panel-head">
          <h3 className="mon-panel-title">网络</h3>
        </header>
        <div className="mon-panel-body">
          <Section title="连接">
            <SettingRow label="代理地址" hint="支持 http 与 socks5" layout="stack">
              <input
                className="org-input"
                placeholder="http://127.0.0.1:7890"
                value={config.proxyUrl}
                onChange={(e) => patch({ proxyUrl: e.target.value })}
                spellCheck={false}
                autoComplete="off"
              />
            </SettingRow>
            <SettingRow
              label="FlareSolverr"
              hint="受 Cloudflare 保护的站点自动过盾"
              layout="stack"
            >
              <input
                className="org-input"
                placeholder="http://127.0.0.1:8191/v1"
                value={config.flareSolverrUrl}
                onChange={(e) => patch({ flareSolverrUrl: e.target.value })}
                spellCheck={false}
                autoComplete="off"
              />
            </SettingRow>
            <SettingRow label="请求超时" hint="网络请求超时后自动取消（秒，最少 5）">
              <input
                className="org-input-sm"
                type="number"
                min={5}
                max={120}
                value={config.requestTimeoutSec}
                onChange={(e) =>
                  patch({
                    requestTimeoutSec: Math.max(5, Math.min(120, Number(e.target.value) || 30)),
                  })
                }
              />
            </SettingRow>
          </Section>

          <Section title="连通性">
            <div className="net-test-grid">
              <button
                type="button"
                className={`net-test-card${testing === "direct" ? " is-busy" : ""}`}
                disabled={busy}
                onClick={() => void runTest("direct")}
              >
                <span className="net-test-name">直连</span>
                <span className="net-test-desc">
                  {testing === "direct" ? "测试中…" : "不经代理访问"}
                </span>
              </button>
              <button
                type="button"
                className={`net-test-card${testing === "proxy" ? " is-busy" : ""}${
                  !proxyReady ? " is-disabled" : ""
                }`}
                disabled={busy || !proxyReady}
                onClick={() => void runTest("proxy")}
              >
                <span className="net-test-name">代理</span>
                <span className="net-test-desc">
                  {testing === "proxy" ? "测试中…" : proxyReady ? "经当前代理转发" : "请先填写代理"}
                </span>
              </button>
              <button
                type="button"
                className={`net-test-card${testing === "flare" ? " is-busy" : ""}${
                  !flareReady ? " is-disabled" : ""
                }`}
                disabled={busy || !flareReady}
                onClick={() => void runTest("flare")}
              >
                <span className="net-test-name">FlareSolverr</span>
                <span className="net-test-desc">
                  {testing === "flare" ? "测试中…" : flareReady ? "探测过盾服务" : "请先填写地址"}
                </span>
              </button>
            </div>
          </Section>
        </div>
      </section>
    </div>
  );
}
