import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchKinds, updateOrganizeConfig } from "../api";
import { ORGANIZE_MODES } from "../components/advancedSettings/organizeModes";
import { FolderPicker } from "../components/FolderPicker";
import { SettingRow } from "../components/SettingRow";
import { PanelSkeleton } from "../components/ui/PanelSkeleton";
import { readCachedQuery, useCachedQuery } from "../hooks/useCachedQuery";
import { useCacheDiscard } from "../hooks/settingsDiscard";
import type { SettingsSaveActions } from "../hooks/useDirtyBaseline";
import { KINDS_KEY } from "../lib/queryCacheKeys";
import type { NotifyFn } from "../lib/notify";
import type { OrganizeConfig } from "../types";

type KindsResponse = Awaited<ReturnType<typeof fetchKinds>>;

export type OrganizeSaveActions = SettingsSaveActions;

type Props = {
  notify: NotifyFn;
  onActionsChange: (actions: OrganizeSaveActions | null) => void;
};

function cloneOrganize(org: OrganizeConfig): OrganizeConfig {
  return {
    ...org,
    videoExtensions: [...org.videoExtensions],
    filenameBlacklist: [...org.filenameBlacklist],
    junkFilters: [...org.junkFilters],
    crackKeywords: [...org.crackKeywords],
    cleanup: {
      ...org.cleanup,
      extraWhitelistExt: [...org.cleanup.extraWhitelistExt],
    },
  };
}

function initialOrganize(): OrganizeConfig | null {
  const hit = readCachedQuery<KindsResponse>(KINDS_KEY)?.organize;
  return hit ? cloneOrganize(hit) : null;
}

function TagListEditor({
  values,
  onChange,
  placeholder,
  disabled,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    if (disabled) return;
    const parts = draft
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const set = new Set(values);
    for (const p of parts) set.add(p);
    onChange([...set]);
    setDraft("");
  }

  return (
    <div className={`org-tags${disabled ? " disabled" : ""}`}>
      <div className="chip-grid org-tags-list">
        {values.length ? (
          values.map((v) => (
            <button
              key={v}
              type="button"
              className="chip active"
              title="点击移除"
              disabled={disabled}
              onClick={() => onChange(values.filter((x) => x !== v))}
            >
              {v} ×
            </button>
          ))
        ) : (
          <span className="org-tags-empty">暂无条目</span>
        )}
      </div>
      <div className="org-tags-add">
        <input
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder ?? "输入后回车添加"}
        />
        <button type="button" className="btn sm" disabled={disabled} onClick={add}>
          添加
        </button>
      </div>
    </div>
  );
}

export function OrganizeSettingsPanel({ notify, onActionsChange }: Props) {
  const {
    data: kindsData,
    loading,
    refreshing,
    setData: setKindsData,
    reload,
  } = useCachedQuery({
    key: KINDS_KEY,
    fetcher: fetchKinds,
    onError: (e) => notify("error", e, "加载整理配置失败"),
  });
  const [config, setConfig] = useState<OrganizeConfig | null>(initialOrganize);
  const [baseline, setBaseline] = useState<OrganizeConfig | null>(initialOrganize);
  const [saving, setSaving] = useState(false);
  const dirtyRef = useRef(false);

  const dirty = useMemo(() => {
    if (!config || !baseline) return false;
    return JSON.stringify(config) !== JSON.stringify(baseline);
  }, [config, baseline]);

  dirtyRef.current = dirty;

  useEffect(() => {
    if (!kindsData?.organize) return;
    const next = cloneOrganize(kindsData.organize);
    if (!dirtyRef.current) {
      setConfig(next);
      setBaseline(next);
      return;
    }
    setConfig((prev) => prev ?? next);
    setBaseline((prev) => prev ?? next);
  }, [kindsData]);

  const save = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    try {
      const { organize } = await updateOrganizeConfig(config);
      const saved = cloneOrganize(organize);
      setConfig(saved);
      setBaseline(saved);
      setKindsData((prev) => (prev ? { ...prev, organize: saved } : prev));
      notify("ok", "整理规则已保存");
    } catch (e) {
      notify("error", e, "保存失败");
    } finally {
      setSaving(false);
    }
  }, [config, notify, setKindsData]);

  const resetLocal = useCallback(() => {
    dirtyRef.current = false;
    setBaseline(null);
    setConfig(null);
  }, []);
  const discard = useCacheDiscard(KINDS_KEY, reload, resetLocal);

  useEffect(() => {
    onActionsChange({ dirty, saving, save, discard });
    return () => onActionsChange(null);
  }, [dirty, saving, save, discard, onActionsChange]);

  function patch(partial: Partial<OrganizeConfig>) {
    setConfig((prev) => (prev ? { ...prev, ...partial } : prev));
  }

  function patchOnConflict(onConflict: string) {
    patch({
      onConflict,
      overwriteVideoSubtitle: onConflict === "overwrite",
    });
  }

  function patchOverwriteVideoSubtitle(checked: boolean) {
    setConfig((prev) => {
      if (!prev) return prev;
      const onConflict =
        checked ? "overwrite" : prev.onConflict === "overwrite" ? "skip" : prev.onConflict;
      return { ...prev, overwriteVideoSubtitle: checked, onConflict };
    });
  }

  function patchCleanup(partial: Partial<OrganizeConfig["cleanup"]>) {
    setConfig((prev) =>
      prev ? { ...prev, cleanup: { ...prev.cleanup, ...partial } } : prev,
    );
  }

  if (loading && !config) {
    return <PanelSkeleton label="加载整理配置…" lines={6} />;
  }

  if (!config) {
    return <PanelSkeleton label="整理配置不可用" lines={4} />;
  }

  const cleanupOff = !config.cleanup.enabled;
  const modeHint = ORGANIZE_MODES.find((m) => m.value === config.defaultMode)?.hint;

  return (
    <div className={`organize-settings${refreshing ? " is-refreshing" : ""}`}>
      <section className="mon-panel">
        <header className="mon-panel-head">
          <h3 className="mon-panel-title">整理模式</h3>
        </header>
        <div className="mon-panel-body">
          <SettingRow label="整理方式" hint={modeHint}>
            <select
              className="org-select"
              aria-label="整理方式"
              value={config.defaultMode}
              onChange={(e) => patch({ defaultMode: e.target.value })}
            >
              {ORGANIZE_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </SettingRow>
          <SettingRow
            label="硬链/软链失败降级"
            hint="跨盘或权限失败时：复制继续，或直接失败"
          >
            <select
              className="org-select"
              aria-label="失败降级"
              value={config.defaultFallback}
              onChange={(e) => patch({ defaultFallback: e.target.value })}
            >
              <option value="copy">降级为复制</option>
              <option value="fail">直接失败</option>
            </select>
          </SettingRow>
          <SettingRow
            label="冲突策略"
            hint="目标路径已有同名视频/字幕时的处理方式"
          >
            <select
              className="org-select"
              aria-label="冲突策略"
              value={config.onConflict}
              onChange={(e) => patchOnConflict(e.target.value)}
            >
              <option value="skip">跳过</option>
              <option value="overwrite">覆盖</option>
              <option value="rename">重命名</option>
            </select>
          </SettingRow>
        </div>
      </section>

      <section className="mon-panel">
        <header className="mon-panel-head">
          <h3 className="mon-panel-title">路径与覆盖</h3>
        </header>
        <div className="mon-panel-body">
          <SettingRow
            label="元数据目录"
            hint="视频以外文件放到另外的目录；留空则与视频同目录"
            layout="stack"
          >
            <FolderPicker
              value={config.metadataDir}
              onChange={(relative) => patch({ metadataDir: relative })}
              onError={(msg) => notify("error", msg, "读取目录失败")}
            />
          </SettingRow>
          <SettingRow
            label="刮削出错时删除元数据目录"
            hint="开启后，刮削失败时删除已创建的封面/缓存与独立元数据子目录"
          >
            <label className="switch">
              <input
                type="checkbox"
                checked={config.deleteMetadataOnFail}
                onChange={(e) => patch({ deleteMetadataOnFail: e.target.checked })}
              />
              <span />
            </label>
          </SettingRow>
          <SettingRow
            label="整理成功后清理封面缓存"
            hint="片库已有海报/缩略图时删除 data/covers 缓存，释放磁盘空间"
          >
            <label className="switch">
              <input
                type="checkbox"
                checked={config.purgeCoverCacheAfterDone !== false}
                onChange={(e) => patch({ purgeCoverCacheAfterDone: e.target.checked })}
              />
              <span />
            </label>
          </SettingRow>
          <SettingRow
            label="覆盖目标目录视频和字幕"
            hint="快捷开关：开启等同冲突策略「覆盖」，关闭则回退为「跳过」（不影响「重命名」）"
          >
            <label className="switch">
              <input
                type="checkbox"
                checked={config.onConflict === "overwrite"}
                onChange={(e) => patchOverwriteVideoSubtitle(e.target.checked)}
              />
              <span />
            </label>
          </SettingRow>
          <SettingRow label="覆盖目标目录图片" hint="目标已有海报/图片时是否覆盖">
            <label className="switch">
              <input
                type="checkbox"
                checked={config.overwriteImages}
                onChange={(e) => patch({ overwriteImages: e.target.checked })}
              />
              <span />
            </label>
          </SettingRow>
        </div>
      </section>

      <section className="mon-panel">
        <header className="mon-panel-head">
          <h3 className="mon-panel-title">扫描与识别过滤</h3>
        </header>
        <div className="mon-panel-body">
          <SettingRow label="文件大小过滤 (MB)" hint="小于此体积忽略；影响目录监控与扫描">
            <input
              className="org-input-sm"
              type="number"
              min={0}
              value={config.minFileSizeMb}
              onChange={(e) => patch({ minFileSizeMb: Number(e.target.value) || 0 })}
            />
          </SettingRow>
          <SettingRow label="文件类型白名单" hint="仅列表内后缀视为视频" layout="stack">
            <TagListEditor
              values={config.videoExtensions}
              onChange={(videoExtensions) => patch({ videoExtensions })}
              placeholder="如 mp4"
            />
          </SettingRow>
          <SettingRow label="文件名黑名单" hint="文件名含条目则忽略" layout="stack">
            <TagListEditor
              values={config.filenameBlacklist}
              onChange={(filenameBlacklist) => patch({ filenameBlacklist })}
            />
          </SettingRow>
          <SettingRow
            label="文件名垃圾信息过滤"
            hint='解析番号时剔除；正则以 "r:" 开头'
            layout="stack"
          >
            <TagListEditor
              values={config.junkFilters}
              onChange={(junkFilters) => patch({ junkFilters })}
              placeholder="如 1080p 或 r:pattern"
            />
          </SettingRow>
          <SettingRow label="破解关键词" hint="匹配文件名与路径，不区分大小写" layout="stack">
            <TagListEditor
              values={config.crackKeywords}
              onChange={(crackKeywords) => patch({ crackKeywords })}
            />
          </SettingRow>
        </div>
      </section>

      <section className={`mon-panel mon-panel--danger${cleanupOff ? " is-off" : ""}`}>
        <header className="mon-panel-head">
          <h3 className="mon-panel-title">自动清理源目录</h3>
          <label className="switch">
            <input
              type="checkbox"
              checked={config.cleanup.enabled}
              onChange={(e) => patchCleanup({ enabled: e.target.checked })}
            />
            <span />
          </label>
        </header>
        <div className="mon-panel-body">
          <SettingRow label="白名单保护" hint="视频与补充白名单类型不会被清理">
            <label className="switch">
              <input
                type="checkbox"
                checked={config.cleanup.whitelistProtect}
                disabled={cleanupOff}
                onChange={(e) => patchCleanup({ whitelistProtect: e.target.checked })}
              />
              <span />
            </label>
          </SettingRow>
          <SettingRow label="删除小文件" hint="按上方体积规则">
            <label className="switch">
              <input
                type="checkbox"
                checked={config.cleanup.deleteSmallFiles}
                disabled={cleanupOff}
                onChange={(e) => patchCleanup({ deleteSmallFiles: e.target.checked })}
              />
              <span />
            </label>
          </SettingRow>
          <SettingRow label="删除非白名单类型">
            <label className="switch">
              <input
                type="checkbox"
                checked={config.cleanup.deleteNonWhitelist}
                disabled={cleanupOff}
                onChange={(e) => patchCleanup({ deleteNonWhitelist: e.target.checked })}
              />
              <span />
            </label>
          </SettingRow>
          <SettingRow label="删除黑名单命中">
            <label className="switch">
              <input
                type="checkbox"
                checked={config.cleanup.deleteBlacklist}
                disabled={cleanupOff}
                onChange={(e) => patchCleanup({ deleteBlacklist: e.target.checked })}
              />
              <span />
            </label>
          </SettingRow>
          <SettingRow label="补充白名单后缀" hint="白名单保护开启时额外保留" layout="stack">
            <TagListEditor
              values={config.cleanup.extraWhitelistExt}
              onChange={(extraWhitelistExt) => patchCleanup({ extraWhitelistExt })}
              placeholder="如 nfo, jpg"
              disabled={cleanupOff}
            />
          </SettingRow>
        </div>
      </section>
    </div>
  );
}
