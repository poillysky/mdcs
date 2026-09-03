import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  fetchEmbyLibraries,
  saveOpsConfig,
  syncEmbyActors,
  testEmbyActorsConnection,
} from "../api";
import { SettingRow } from "../components/SettingRow";
import { PanelSkeleton } from "../components/ui/PanelSkeleton";
import {
  useDirtyBaseline,
  useReportSaveActions,
  type SettingsSaveActions,
} from "../hooks/useDirtyBaseline";
import { useSharedOpsConfig } from "../hooks/useSharedOpsConfig";
import { useCacheDiscard } from "../hooks/settingsDiscard";
import { OPS_CONFIG_KEY } from "../lib/queryCacheKeys";
import type { NotifyFn } from "../lib/notify";
import type { OpsConfig } from "../types";

export type ActorsSaveActions = SettingsSaveActions;

type Props = {
  notify: NotifyFn;
  onActionsChange?: (actions: ActorsSaveActions | null) => void;
};
type ActorsCfg = OpsConfig["actors"];

const DEFAULT_ACTORS: ActorsCfg = {
  source: "local",
  embyUrl: "",
  embyApiKey: "",
  embyUserId: "",
  libraryIds: [],
  autoScrapeEnabled: false,
  autoScrapeRecentDays: 0,
  refreshLibraryAfterScrape: false,
  scrapeMetadata: true,
  scrapeImages: true,
  metadataOverwrite: "missing",
};

function mergeActors(partial?: Partial<ActorsCfg> | null): ActorsCfg {
  return {
    ...DEFAULT_ACTORS,
    ...partial,
    libraryIds: partial?.libraryIds ?? DEFAULT_ACTORS.libraryIds,
  };
}

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

function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  );
}

function withMergedActors(cfg: OpsConfig): OpsConfig {
  return { ...cfg, actors: mergeActors(cfg.actors) };
}

export function ActorsSettingsPanel({ notify, onActionsChange }: Props) {
  const { config, loading, refreshing, setConfig, reload } = useSharedOpsConfig({
    transform: withMergedActors,
    onError: (e) => notify("error", e, "加载演员配置失败"),
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [libraries, setLibraries] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingLibs, setLoadingLibs] = useState(false);

  const actorsSnap = useMemo(
    () => (config ? mergeActors(config.actors) : null),
    [config],
  );
  const { dirty, markClean } = useDirtyBaseline({ current: actorsSnap });

  function patchActors(partial: Partial<ActorsCfg>) {
    if (!config) return;
    setConfig({ ...config, actors: mergeActors({ ...config.actors, ...partial }) });
  }

  const save = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    try {
      const payload = { ...config, actors: mergeActors(config.actors) };
      const { config: saved } = await saveOpsConfig(payload);
      const merged = { ...saved, actors: mergeActors(saved.actors) };
      setConfig(merged);
      markClean(mergeActors(merged.actors));
      notify("ok", "演员配置已保存");
    } catch (e) {
      notify("error", e, "保存失败");
    } finally {
      setSaving(false);
    }
  }, [config, markClean, notify, setConfig]);

  const discard = useCacheDiscard(OPS_CONFIG_KEY, reload);

  useReportSaveActions(true, dirty, saving, save, onActionsChange, discard);

  async function loadLibraries(a: ActorsCfg) {
    if (!a.embyUrl.trim() || !a.embyApiKey.trim()) return;
    setLoadingLibs(true);
    try {
      const data = await fetchEmbyLibraries({
        embyUrl: a.embyUrl,
        embyApiKey: a.embyApiKey,
        embyUserId: a.embyUserId,
      });
      setLibraries(data.libraries);
    } catch {
      setLibraries([]);
    } finally {
      setLoadingLibs(false);
    }
  }

  async function testConn() {
    if (!config) return;
    const a = mergeActors(config.actors);
    setTesting(true);
    try {
      const info = await testEmbyActorsConnection({
        embyUrl: a.embyUrl,
        embyApiKey: a.embyApiKey,
        embyUserId: a.embyUserId,
      });
      notify("ok", `已连接 ${info.serverName}${info.version ? ` (${info.version})` : ""}`);
      await loadLibraries(a);
    } catch (e) {
      notify("error", e, "Emby 连接失败");
    } finally {
      setTesting(false);
    }
  }

  async function runSync() {
    if (!config) return;
    const a = mergeActors(config.actors);
    setSyncing(true);
    try {
      const result = await syncEmbyActors(a);
      notify(
        "ok",
        `同步完成：元数据 ${result.updatedMeta} / 图片 ${result.updatedImage} / 本地导入 ${result.fromLocal ?? 0} / 跳过 ${result.skipped} / 失败 ${result.failed}（共 ${result.total}）`,
      );
      if (result.errors?.length) {
        notify("error", result.errors.slice(0, 3).join("；"), "部分失败");
      }
    } catch (e) {
      notify("error", e, "同步失败");
    } finally {
      setSyncing(false);
    }
  }

  if (loading && !config) {
    return <PanelSkeleton label="加载演员配置…" lines={6} />;
  }

  if (!config) {
    return <PanelSkeleton label="演员配置不可用" lines={4} />;
  }

  const a = mergeActors(config.actors);
  const librarySelectValue = a.libraryIds.length === 1 ? a.libraryIds[0]! : "";
  const connReady = Boolean(a.embyUrl.trim() && a.embyApiKey.trim());
  const busy = testing || syncing;

  return (
    <div className={`actors-settings${refreshing ? " is-refreshing" : ""}`}>
      <section className="mon-panel settings-form">
        <header className="mon-panel-head">
          <h3 className="mon-panel-title">演员</h3>
        </header>
        <div className="mon-panel-body">
          <Section title="Emby 连接" hint="从 Emby 拉取演员名单，补全后写回（真同步）">
            <SettingRow label="服务器地址" hint="以 http:// 或 https:// 开头" layout="stack">
              <input
                className="org-input"
                value={a.embyUrl}
                onChange={(e) => patchActors({ embyUrl: e.target.value, source: "emby" })}
                placeholder="http://192.168.1.10:8096"
                spellCheck={false}
                autoComplete="off"
              />
            </SettingRow>
            <SettingRow label="API Key" hint="Emby 设置 → 高级 → API 密钥" layout="stack">
              <div className="actors-key-row">
                <input
                  className="org-input"
                  type={showKey ? "text" : "password"}
                  value={a.embyApiKey}
                  onChange={(e) => patchActors({ embyApiKey: e.target.value, source: "emby" })}
                  placeholder="Emby API Key"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="btn actors-key-toggle"
                  onClick={() => setShowKey((v) => !v)}
                >
                  {showKey ? "隐藏" : "显示"}
                </button>
              </div>
            </SettingRow>
            <SettingRow
              label="User Id"
              hint="网页打开用户页，从地址栏 users/ 后复制"
              layout="stack"
            >
              <input
                className="org-input"
                value={a.embyUserId}
                onChange={(e) => patchActors({ embyUserId: e.target.value })}
                placeholder="可选，部分接口需要"
                spellCheck={false}
                autoComplete="off"
              />
            </SettingRow>
          </Section>

          <Section title="同步范围" hint="限定媒体库与自动刮削策略">
            <SettingRow label="媒体库" hint="空为全部；聚焦下拉会拉取列表">
              <select
                className="org-select"
                value={librarySelectValue}
                disabled={loadingLibs}
                onFocus={() => void loadLibraries(a)}
                onChange={(e) => {
                  const v = e.target.value;
                  patchActors({ libraryIds: v ? [v] : [] });
                }}
              >
                <option value="">{loadingLibs ? "加载中…" : "全部"}</option>
                {libraries.map((lib) => (
                  <option key={lib.id} value={lib.id}>
                    {lib.name}
                  </option>
                ))}
              </select>
            </SettingRow>
            <SettingRow label="定期自动刮削" hint="约每 6 小时检查新入库影片演员">
              <Switch
                checked={a.autoScrapeEnabled}
                onChange={(v) => patchActors({ autoScrapeEnabled: v, source: "emby" })}
              />
            </SettingRow>
            <SettingRow label="入库天数" hint="只处理最近 N 天添加的项目；0 不限">
              <input
                className="org-input-sm"
                type="number"
                min={0}
                max={3650}
                value={a.autoScrapeRecentDays}
                onChange={(e) =>
                  patchActors({
                    autoScrapeRecentDays: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                  })
                }
              />
            </SettingRow>
            <SettingRow label="刮削后刷新媒体库" hint="写回完成后触发 Emby Library Refresh">
              <Switch
                checked={a.refreshLibraryAfterScrape}
                onChange={(v) => patchActors({ refreshLibraryAfterScrape: v })}
              />
            </SettingRow>
          </Section>

          <Section title="刮削选项" hint="写回 Emby 的内容与覆盖策略">
            <SettingRow label="元数据" hint="演员名、外链等轻量字段">
              <Switch
                checked={a.scrapeMetadata}
                onChange={(v) => patchActors({ scrapeMetadata: v })}
              />
            </SettingRow>
            <SettingRow label="图片" hint="从 Gfriends 匹配头像并上传">
              <Switch
                checked={a.scrapeImages}
                onChange={(v) => patchActors({ scrapeImages: v })}
              />
            </SettingRow>
            <SettingRow label="元数据覆盖模式" hint="已有字段时的处理方式">
              <select
                className="org-select"
                value={a.metadataOverwrite}
                onChange={(e) =>
                  patchActors({
                    metadataOverwrite: e.target.value === "all" ? "all" : "missing",
                  })
                }
              >
                <option value="missing">仅刮削缺失</option>
                <option value="all">覆盖已有</option>
              </select>
            </SettingRow>
          </Section>

          <Section title="操作" hint="先测连通，再手动同步">
            <div className="net-test-grid net-test-grid--2">
              <button
                type="button"
                className={`net-test-card${testing ? " is-busy" : ""}${!connReady ? " is-disabled" : ""}`}
                disabled={busy || !connReady}
                onClick={() => void testConn()}
              >
                <span className="net-test-name">测试连接</span>
                <span className="net-test-desc">
                  {testing ? "测试中…" : connReady ? "校验地址与 API Key" : "请先填写地址与 Key"}
                </span>
              </button>
              <button
                type="button"
                className={`net-test-card${syncing ? " is-busy" : ""}${!connReady ? " is-disabled" : ""}`}
                disabled={busy || !connReady}
                onClick={() => void runSync()}
              >
                <span className="net-test-name">立即同步</span>
                <span className="net-test-desc">
                  {syncing ? "同步中…" : connReady ? "拉取、补全并写回 Emby" : "请先填写地址与 Key"}
                </span>
              </button>
            </div>
          </Section>
        </div>
      </section>
    </div>
  );
}
