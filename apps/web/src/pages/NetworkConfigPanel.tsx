import { useEffect, useState, type ReactNode } from "react";
import { fetchScrapeConfig, saveScrapeConfig, testNetworkConnection } from "../api";
import { SettingRow } from "../components/SettingRow";
import { COPY } from "../lib/messages";
import type { NotifyFn } from "../lib/notify";
import type { ScrapeConfig } from "../types";

type Props = {
  notify: NotifyFn;
};

type TestTarget = "direct" | "proxy" | "flare";

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

export function NetworkConfigPanel({ notify }: Props) {
  const [config, setConfig] = useState<ScrapeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<TestTarget | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchScrapeConfig();
      setConfig(data.config);
    } catch (e) {
      notify("error", e, "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function patch(next: Partial<ScrapeConfig>) {
    if (!config) return;
    setConfig({ ...config, ...next });
  }

  async function save() {
    if (!config) return;
    setSaving(true);
    try {
      const { config: saved } = await saveScrapeConfig(config);
      setConfig(saved);
      notify("ok", "网络配置已保存");
    } catch (e) {
      notify("error", e, "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function runTest(target: TestTarget) {
    if (!config) return;
    setTesting(target);
    try {
      const result = await testNetworkConnection({
        target,
        proxyUrl: config.proxyUrl,
        flareSolverrUrl: config.flareSolverrUrl,
        timeoutSec: config.requestTimeoutSec,
      });
      notify(result.ok ? "ok" : "warn", `${result.message}（${result.ms}ms）`, COPY.testConnection);
    } catch (e) {
      notify("error", e, COPY.testConnection);
    } finally {
      setTesting(null);
    }
  }

  if (loading || !config) {
    return <div className="empty-block">加载网络配置…</div>;
  }

  const busy = testing !== null;
  const proxyReady = Boolean(config.proxyUrl.trim());
  const flareReady = Boolean(config.flareSolverrUrl.trim());

  return (
    <div className="network-settings">
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
            <SettingRow label="请求超时" hint="网络请求超时后自动取消（秒）">
              <input
                className="org-input-sm"
                type="number"
                min={3}
                max={120}
                value={config.requestTimeoutSec}
                onChange={(e) => patch({ requestTimeoutSec: Number(e.target.value) || 30 })}
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
      <div className="page-save-row">
        <button type="button" className="btn primary" disabled={saving} onClick={() => void save()}>
          {saving ? "保存中…" : COPY.save}
        </button>
      </div>
    </div>
  );
}
