import { PageHeader } from "../components/ui/PageHeader";
import { ArrowPathIcon } from "@heroicons/react/20/solid";
import { useEffect, useMemo, useState } from "react";
import { fetchScrapeConfig, probeProviders as probeProvidersApi, saveScrapeConfig } from "../api";
import { ProviderSettingsModal } from "../components/ProviderSettingsModal";
import type { NotifyFn } from "../lib/notify";
import type { ProviderCatalogRow, ProviderSiteConfig, ScrapeConfig } from "../types";

type Props = {
  notify: NotifyFn;
  /**
   * project = 刮削开关与并发（设置内）
   * providers = 仅 Provider 目录
   * fields = 仅字段优先级
   * sources = 两者同页（兼容旧入口，尽量不用）
   */
  variant?: "project" | "sources" | "providers" | "fields";
};

const FIELD_LABELS: Record<string, string> = {
  cover: "封面",
  titleZh: "中文标题",
  outline: "简介",
  plot: "剧情简介",
  originalPlot: "原简介",
  studio: "片商",
  actors: "演员",
  tags: "标签",
  series: "系列",
  title: "标题",
  originaltitle: "原标题",
  poster: "海报",
};

const PROVIDER_UI_GROUPS: Array<{ id: ProviderCatalogRow["group"]; label: string }> = [
  { id: "av", label: "有码 AV" },
  { id: "uncensored", label: "无码 AV" },
  { id: "fc2", label: "FC2" },
  { id: "chinese", label: "国产" },
  { id: "western", label: "欧美" },
];

type ProbeStatus = "ok" | "fail" | "unknown";

function displayProviderName(id: string, label: string): string {
  // 对齐参考图：Airav_io / Avsox 风格
  if (!id.includes("_") && label) return label.replace(/\s+/g, "");
  return id
    .split("_")
    .map((part, i) => (i === 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join("_");
}

function formatAgo(ts: number | null): string {
  if (!ts) return "尚未测试";
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec} 秒前`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr} 小时前`;
  return `${Math.floor(hr / 24)} 天前`;
}

/** 同组卡片顺序：代理 → 自适应 → 过盾（与 server catalogTypes 一致） */
function providerAccessRank(access: string): number {
  if (access === "proxy_adaptive") return 1;
  if (access === "proxy_flare") return 2;
  return 0;
}

function sortProviderRows(rows: ProviderCatalogRow[]): ProviderCatalogRow[] {
  return [...rows].sort((a, b) => {
    const accessDiff = providerAccessRank(a.access) - providerAccessRank(b.access);
    if (accessDiff !== 0) return accessDiff;
    if (a.implemented !== b.implemented) return a.implemented ? -1 : 1;
    return a.label.localeCompare(b.label, "zh-CN");
  });
}

function emptySite(): ProviderSiteConfig {
  return {
    baseUrl: "",
    cookie: "",
    userAgent: "",
    cooldownSec: 0,
    overrideRetry: false,
    retry: 0,
    proxyUrl: "",
  };
}

function Switch({
  checked,
  onChange,
  stopPropagation,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  stopPropagation?: boolean;
}) {
  return (
    <label
      className="switch"
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          e.stopPropagation();
          onChange(e.target.checked);
        }}
      />
      <span />
    </label>
  );
}

export function ScrapeConfigPanel({ notify, variant = "sources" }: Props) {
  const [config, setConfig] = useState<ScrapeConfig | null>(null);
  const [catalog, setCatalog] = useState<ProviderCatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [probing, setProbing] = useState(false);
  const [probingId, setProbingId] = useState<string | null>(null);
  const [probeStatus, setProbeStatus] = useState<Record<string, ProbeStatus>>({});
  const [lastProbeAt, setLastProbeAt] = useState<number | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [, setTick] = useState(0);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchScrapeConfig();
      setConfig(data.config);
      setCatalog(data.catalog ?? []);
    } catch (e) {
      notify("error", e, "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!lastProbeAt) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, [lastProbeAt]);

  function patch(next: Partial<ScrapeConfig>) {
    if (!config) return;
    setConfig({ ...config, ...next });
  }

  function setFieldPriorityList(field: string, raw: string) {
    const sources = raw
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    patch({
      fieldPriority: {
        ...config!.fieldPriority,
        [field]: sources,
      },
    });
  }

  function blockSourceFromField(field: string, sourceId: string) {
    const list = config?.fieldPriority[field] ?? [];
    patch({
      fieldPriority: {
        ...config!.fieldPriority,
        [field]: list.filter((s) => s !== sourceId),
      },
    });
  }

  async function save(okMsg: string, nextConfig?: ScrapeConfig) {
    const payload = nextConfig ?? config;
    if (!payload) return;
    setSaving(true);
    try {
      const { config: saved, catalog: nextCatalog } = await saveScrapeConfig(payload);
      setConfig(saved);
      if (nextCatalog) setCatalog(nextCatalog);
      notify("ok", okMsg);
    } catch (e) {
      notify("error", e, "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function probeAll() {
    setProbing(true);
    try {
      const data = await probeProvidersApi({ onlyImplemented: false });
      const next: Record<string, ProbeStatus> = { ...probeStatus };
      for (const row of data.results ?? []) {
        next[row.id] = row.ok ? "ok" : "fail";
      }
      setProbeStatus(next);
      setLastProbeAt(Date.now());
      notify("ok", "测试完成");
    } catch (e) {
      notify("error", e, "测试失败");
    } finally {
      setProbing(false);
    }
  }

  async function probeOne(id: string, label: string) {
    if (probing || probingId) return;
    setProbingId(id);
    try {
      const data = await probeProvidersApi({ id });
      const row = data.results?.[0];
      const ok = Boolean(row?.ok);
      setProbeStatus((prev) => ({ ...prev, [id]: ok ? "ok" : "fail" }));
      setLastProbeAt(Date.now());
      const detail = row?.message ? `：${row.message}` : "";
      if (ok) notify("ok", `${label} 可达${detail}`);
      else notify("error", `${label} 不可达${detail}`);
    } catch (e) {
      setProbeStatus((prev) => ({ ...prev, [id]: "fail" }));
      setLastProbeAt(Date.now());
      notify("error", e, `${label} 测试失败`);
    } finally {
      setProbingId(null);
    }
  }

  const editingRow = useMemo(
    () => (editId ? catalog.find((r) => r.id === editId) : undefined),
    [catalog, editId],
  );

  if (loading || !config) {
    return <div className="empty-block">加载刮削配置…</div>;
  }

  const showProject = variant === "project";
  const showProviders = variant === "providers" || variant === "sources";
  const showFields = variant === "fields" || variant === "sources";
  const showSourcesShell = showProviders || showFields;
  const siteMap = config.providerSettings ?? {};
  const globalRetry = config.providerRetryDefault ?? 0;

  return (
    <div className={`scrape-panel${showSourcesShell ? " scrape-panel-sources" : ""}`}>
      {variant === "fields" ? (
        <PageHeader
          title="字段配置"
          description="按字段指定刮削源顺序；非空列表严格按该顺序，空列表表示继承。"
        />
      ) : null}
      {variant === "sources" ? (
        <PageHeader
          title="数据源"
          description="全局 Provider 开关与字段优先级。各分区源链请在「监控 → 分区弹窗 → 数据源」配置。"
        />
      ) : null}

      <div className="scrape-config">
        {showProject ? (
          <section className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-head">
              <h2>刮削开关与并发</h2>
            </div>
            <div className="panel-body">
              <label className="switch block">
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => patch({ enabled: e.target.checked })}
                />
                <span>启用在线刮削</span>
              </label>
              <div className="form-grid two">
                <label>
                  <span>快速并发（不过盾）</span>
                  <input
                    type="number"
                    min={1}
                    max={16}
                    value={config.exportFastConcurrency}
                    onChange={(e) =>
                      patch({ exportFastConcurrency: Number(e.target.value) || 1 })
                    }
                  />
                </label>
                <label>
                  <span>慢速并发（Flare）</span>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={config.exportSlowConcurrency}
                    onChange={(e) =>
                      patch({ exportSlowConcurrency: Number(e.target.value) || 1 })
                    }
                  />
                </label>
              </div>
              <p className="muted" style={{ margin: "0 0 12px", fontSize: 12 }}>
                快通道并行请求代理源；过盾源（proxy_flare）在快源不够时才进入慢通道。
              </p>
              <label className="field">
                <span>封面策略</span>
                <select
                  value={config.coverDownloadStrategy}
                  onChange={(e) => patch({ coverDownloadStrategy: e.target.value })}
                >
                  <option value="priority">按优先级</option>
                  <option value="size">按尺寸</option>
                </select>
              </label>
              <button
                type="button"
                className="btn primary"
                disabled={saving}
                onClick={() => void save("刮削配置已保存")}
              >
                {saving ? "保存中…" : "保存刮削配置"}
              </button>
            </div>
          </section>
        ) : null}

        {showProviders ? (
          <section className="src-mgmt">
            <header className="src-mgmt-head">
              <div>
                <h1>数据源管理</h1>
                <p>可点击卡片进行详细设置</p>
              </div>
              <div className="src-mgmt-actions">
                <span className="src-mgmt-ago">状态更新时间: {formatAgo(lastProbeAt)}</span>
                <button
                  type="button"
                  className="btn src-mgmt-test"
                  disabled={probing || Boolean(probingId)}
                  onClick={() => void probeAll()}
                >
                  <ArrowPathIcon className="src-mgmt-test-icon" aria-hidden />
                  {probing ? "测试中…" : "测试全部"}
                </button>
              </div>
            </header>

            <div className="src-groups">
              {PROVIDER_UI_GROUPS.map((g) => {
                const rows = sortProviderRows(catalog.filter((r) => r.group === g.id));
                if (!rows.length) return null;
                return (
                  <section key={g.id} className="src-group">
                    <h2 className="src-group-title">{g.label}</h2>
                    <div className="src-card-grid">
                      {rows.map((row) => {
                        const site = siteMap[row.id];
                        const url = (site?.baseUrl || row.defaultUrl || "").trim() || "—";
                        const status = probeStatus[row.id] ?? "unknown";
                        const cd = site?.cooldownSec ?? row.defaultCooldownSec ?? 0;
                        const name = displayProviderName(row.id, row.label);
                        const isProbingThis = probingId === row.id;
                        const accessLabel =
                          row.access === "proxy_flare"
                            ? "过盾"
                            : row.access === "proxy_adaptive"
                              ? "自适应"
                              : "代理";
                        const href = url !== "—" ? url : "";
                        return (
                          <div
                            key={row.id}
                            role="button"
                            tabIndex={0}
                            className={`src-card${row.enabled ? "" : " is-off"}${row.implemented ? "" : " is-stub"}`}
                            onClick={() => setEditId(row.id)}
                            onKeyDown={(e) => {
                              if (e.key !== "Enter" && e.key !== " ") return;
                              e.preventDefault();
                              setEditId(row.id);
                            }}
                          >
                            <div className="src-card-top">
                              <div className="src-card-title">
                                <strong>{name}</strong>
                                {!row.implemented ? (
                                  <span className="src-tag src-tag--stub" title="刮削未实现">
                                    stub
                                  </span>
                                ) : null}
                                <span
                                  className={`src-dot src-dot--${status}`}
                                  title={
                                    status === "ok"
                                      ? "可达"
                                      : status === "fail"
                                        ? "失败"
                                        : "未测试"
                                  }
                                />
                              </div>
                              <Switch
                                checked={row.enabled}
                                stopPropagation
                                onChange={(enabled) => {
                                  const set = new Set(config.disabledProviders ?? []);
                                  if (enabled) set.delete(row.id);
                                  else set.add(row.id);
                                  const disabledProviders = [...set];
                                  setConfig({ ...config, disabledProviders });
                                  setCatalog((prev) =>
                                    prev.map((r) => (r.id === row.id ? { ...r, enabled } : r)),
                                  );
                                  void save("Provider 开关已保存", {
                                    ...config,
                                    disabledProviders,
                                  });
                                }}
                              />
                            </div>
                            {href ? (
                              <a
                                className="src-card-url"
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={href}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {url}
                              </a>
                            ) : (
                              <p className="src-card-url">—</p>
                            )}
                            <div className="src-card-foot">
                              <span className="src-card-access muted">{accessLabel}</span>
                              {cd > 0 ? <span className="src-card-cd">CD: {cd}s</span> : <span />}
                              <span
                                role="button"
                                tabIndex={0}
                                className={`src-card-probe${isProbingThis ? " is-busy" : ""}`}
                                title="测试联通性"
                                aria-label={`测试 ${name} 联通性`}
                                aria-disabled={probing || Boolean(probingId)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  if (probing || probingId) return;
                                  void probeOne(row.id, name);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key !== "Enter" && e.key !== " ") return;
                                  e.stopPropagation();
                                  e.preventDefault();
                                  if (probing || probingId) return;
                                  void probeOne(row.id, name);
                                }}
                              >
                                <ArrowPathIcon
                                  className={`src-card-probe-icon${isProbingThis ? " is-spin" : ""}`}
                                  aria-hidden
                                />
                                {isProbingThis ? "测试中" : "测通"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </section>
        ) : null}

        {showFields ? (
          <section className="panel" style={{ marginTop: showProviders ? 20 : 0 }}>
            <div className="panel-head">
              <h2>字段优先级</h2>
            </div>
            <div className="priority-grid">
              {Object.entries(config.fieldPriority).map(([field, sources]) => (
                <div key={field} className="priority-row">
                  <span className="priority-field" title={field}>
                    {FIELD_LABELS[field] ?? field}
                  </span>
                  <div className="chip-row">
                    {sources.map((s, i) => (
                      <button
                        key={`${field}-${s}`}
                        type="button"
                        className="tag sm"
                        title="点击从该字段链中屏蔽/移除"
                        onClick={() => blockSourceFromField(field, s)}
                      >
                        {i + 1}. {s} ×
                      </button>
                    ))}
                  </div>
                  <input
                    className="priority-edit"
                    value={sources.join(", ")}
                    onChange={(e) => setFieldPriorityList(field, e.target.value)}
                    placeholder="源 id，逗号分隔；空=继承"
                  />
                </div>
              ))}
            </div>
            <p className="hint" style={{ padding: "0 16px 12px" }}>
              点击标签可从链中移除（屏蔽该源）。空列表表示继承全局/分区源链。
            </p>
            <div style={{ padding: "0 16px 16px" }}>
              <button
                type="button"
                className="btn primary"
                disabled={saving}
                onClick={() => void save("字段优先级已保存")}
              >
                {saving ? "保存中…" : "保存字段优先级"}
              </button>
            </div>
          </section>
        ) : null}
      </div>

      {editingRow ? (
        <ProviderSettingsModal
          open
          title={editingRow.label}
          defaultUrl={editingRow.defaultUrl || ""}
          value={siteMap[editingRow.id]}
          defaultCooldownSec={editingRow.defaultCooldownSec ?? 0}
          globalRetryDefault={globalRetry}
          needsApiKey={Boolean(editingRow.needsApiKey)}
          apiKey={editingRow.id === "theporndb" ? config.theporndbApiKey ?? "" : ""}
          onClose={() => setEditId(null)}
          onSave={(next, extras) => {
            const empty =
              !next.baseUrl &&
              !next.cookie &&
              !next.userAgent &&
              next.cooldownSec <= 0 &&
              !next.overrideRetry &&
              next.retry <= 0 &&
              !next.proxyUrl;
            const providerSettings = { ...(config.providerSettings ?? {}) };
            if (empty) delete providerSettings[editingRow.id];
            else providerSettings[editingRow.id] = { ...emptySite(), ...next };
            const patch: ScrapeConfig = { ...config, providerSettings };
            if (editingRow.id === "theporndb") {
              patch.theporndbApiKey = extras?.apiKey ?? "";
            }
            void save("数据源设置已保存", patch);
          }}
        />
      ) : null}
    </div>
  );
}
