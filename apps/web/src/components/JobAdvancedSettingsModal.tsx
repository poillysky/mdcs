import { useEffect, useState, type ReactNode } from "react";
import { fetchKinds, fetchScrapeConfig } from "../api";
import { FolderPicker } from "./FolderPicker";
import { JobSourcesSettingsView } from "./JobSourcesSettingsView";
import { Modal } from "./Modal";
import { SettingRow } from "./SettingRow";
import {
  JOB_ADVANCED_TABS,
  defaultJobOptions,
  isUsingGlobal,
  seedJobSources,
  type JobDownloadOptions,
  type JobMetadataOptions,
  type JobNamingOptions,
  type JobNfoOptions,
  type JobOptions,
  type JobOptionsTab,
  type JobOrganizeCleanupOptions,
  type JobOrganizeOptions,
  type JobSourcesOptions,
  type JobWatermarkOptions,
} from "../lib/jobOptions";
import type { NotifyFn } from "../lib/notify";
import type { OrganizeConfig, ProviderCatalogRow, ScrapeConfig } from "../types";

type Props = {
  open: boolean;
  value: JobOptions;
  onChange: (next: JobOptions) => void;
  onClose: () => void;
  notify: NotifyFn;
  onSavePreset?: () => void;
  onExportPresets?: () => void;
  onImportPresets?: () => void;
};

const ORGANIZE_MODES = [
  { value: "hardlink", label: "硬链接", hint: "同盘零拷贝，不支持跨盘" },
  { value: "softlink", label: "软链接", hint: "仅生成链接，播放器需能寻址源文件" },
  { value: "inplace", label: "原地整理", hint: "源目录内出结果，忽略输出目录" },
  { value: "copy", label: "复制", hint: "保留源文件，占用双倍空间" },
  { value: "move", label: "移动", hint: "删除源文件，请谨慎使用" },
] as const;

function TagListEditor({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function add() {
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
    <div className="org-tags">
      <div className="chip-grid org-tags-list">
        {values.length ? (
          values.map((v) => (
            <button
              key={v}
              type="button"
              className="chip active"
              title="点击移除"
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
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder ?? "输入后回车添加"}
        />
        <button type="button" className="btn sm" onClick={add}>
          添加
        </button>
      </div>
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

function Panel({
  title,
  children,
  danger,
  off,
  headExtra,
}: {
  title: string;
  children: ReactNode;
  danger?: boolean;
  off?: boolean;
  headExtra?: ReactNode;
}) {
  return (
    <section
      className={`mon-panel${danger ? " mon-panel--danger" : ""}${off ? " is-off" : ""}`}
    >
      <header className="mon-panel-head">
        <h3 className="mon-panel-title">{title}</h3>
        {headExtra}
      </header>
      <div className="mon-panel-body">{children}</div>
    </section>
  );
}

function seedOrganize(org: OrganizeConfig, current?: JobOrganizeOptions): JobOrganizeOptions {
  const cleanupSrc = org.cleanup;
  return {
    organizeMode: current?.organizeMode ?? org.defaultMode ?? "hardlink",
    organizeFallback: current?.organizeFallback ?? org.defaultFallback ?? "copy",
    libraryRoot: current?.libraryRoot,
    metadataDir: current?.metadataDir ?? org.metadataDir ?? "",
    deleteMetadataOnFail: current?.deleteMetadataOnFail ?? org.deleteMetadataOnFail ?? false,
    overwriteVideoSubtitle: current?.overwriteVideoSubtitle ?? org.overwriteVideoSubtitle ?? true,
    overwriteImages: current?.overwriteImages ?? org.overwriteImages ?? true,
    onConflict: current?.onConflict ?? org.onConflict ?? "overwrite",
    minFileSizeMb: current?.minFileSizeMb ?? org.minFileSizeMb ?? 100,
    videoExtensions: current?.videoExtensions ?? [...(org.videoExtensions ?? [])],
    filenameBlacklist: current?.filenameBlacklist ?? [...(org.filenameBlacklist ?? [])],
    junkFilters: current?.junkFilters ?? [...(org.junkFilters ?? [])],
    crackKeywords: current?.crackKeywords ?? [...(org.crackKeywords ?? [])],
    cleanup: {
      enabled: current?.cleanup?.enabled ?? cleanupSrc?.enabled ?? false,
      whitelistProtect: current?.cleanup?.whitelistProtect ?? cleanupSrc?.whitelistProtect ?? true,
      deleteSmallFiles: current?.cleanup?.deleteSmallFiles ?? cleanupSrc?.deleteSmallFiles ?? false,
      deleteNonWhitelist:
        current?.cleanup?.deleteNonWhitelist ?? cleanupSrc?.deleteNonWhitelist ?? false,
      deleteBlacklist: current?.cleanup?.deleteBlacklist ?? cleanupSrc?.deleteBlacklist ?? false,
      extraWhitelistExt:
        current?.cleanup?.extraWhitelistExt ?? [...(cleanupSrc?.extraWhitelistExt ?? [])],
    },
  };
}

function seedDownload(cfg: ScrapeConfig, current?: JobDownloadOptions): JobDownloadOptions {
  const d = cfg.download;
  return {
    downloadPoster: current?.downloadPoster ?? d?.downloadPoster ?? true,
    downloadThumb: current?.downloadThumb ?? d?.downloadThumb ?? true,
    downloadFanart: current?.downloadFanart ?? d?.downloadFanart ?? false,
    preferHighResPoster: current?.preferHighResPoster ?? d?.preferHighResPoster ?? true,
    amazonHdPoster: current?.amazonHdPoster ?? d?.amazonHdPoster ?? false,
    tenhowHdPoster: current?.tenhowHdPoster ?? d?.tenhowHdPoster ?? false,
    amazonStrictMode: current?.amazonStrictMode ?? d?.amazonStrictMode ?? false,
    skipAmazon: current?.skipAmazon ?? d?.skipAmazon ?? true,
    subtitleLibraryPath: current?.subtitleLibraryPath ?? d?.subtitleLibraryPath ?? "",
    cropRatio: current?.cropRatio ?? d?.cropRatio ?? "full",
    cropIndependentPoster: current?.cropIndependentPoster ?? d?.cropIndependentPoster ?? false,
    preferCropResult: current?.preferCropResult ?? d?.preferCropResult ?? true,
    coverDownloadStrategy: current?.coverDownloadStrategy ?? cfg.coverDownloadStrategy ?? "priority",
  };
}

function seedNaming(cfg: ScrapeConfig, current?: JobNamingOptions): JobNamingOptions {
  const n = cfg.naming;
  return {
    directoryTemplate: current?.directoryTemplate ?? n?.directoryTemplate ?? "",
    fileNameTemplate: current?.fileNameTemplate ?? n?.fileNameTemplate ?? "{number}",
    nameSuffixTemplate: current?.nameSuffixTemplate ?? n?.nameSuffixTemplate ?? "",
    posterCrop: current?.posterCrop ?? n?.posterCrop ?? "right",
  };
}

function seedWatermark(cfg: ScrapeConfig, current?: JobWatermarkOptions): JobWatermarkOptions {
  const w = cfg.watermark;
  return {
    enabled: current?.enabled ?? w?.enabled ?? false,
    position: current?.position ?? w?.position ?? "top-right",
    scalePercent: current?.scalePercent ?? w?.scalePercent ?? 12,
    markSubtitle: current?.markSubtitle ?? w?.markSubtitle ?? true,
    markCracked: current?.markCracked ?? w?.markCracked ?? true,
    markLeak: current?.markLeak ?? w?.markLeak ?? true,
    markUncensored: current?.markUncensored ?? w?.markUncensored ?? true,
    markCensored: current?.markCensored ?? w?.markCensored ?? false,
  };
}

function seedMetadata(cfg: ScrapeConfig, current?: JobMetadataOptions): JobMetadataOptions {
  const m = cfg.metadata;
  return {
    strictMode: current?.strictMode ?? m?.strictMode ?? false,
    requireCover: current?.requireCover ?? m?.requireCover ?? false,
    trimPlot: current?.trimPlot ?? m?.trimPlot ?? true,
    autoTranslateTitle: current?.autoTranslateTitle ?? m?.autoTranslateTitle ?? false,
    autoTranslateOutline: current?.autoTranslateOutline ?? m?.autoTranslateOutline ?? false,
    useForumZhTitle: current?.useForumZhTitle ?? m?.useForumZhTitle ?? true,
    enableActorMapping: current?.enableActorMapping ?? m?.enableActorMapping ?? true,
    enableTagMapping: current?.enableTagMapping ?? m?.enableTagMapping ?? true,
  };
}

function seedNfo(cfg: ScrapeConfig, current?: JobNfoOptions): JobNfoOptions {
  return {
    writeActors: current?.writeActors ?? cfg.nfo?.include?.actor ?? true,
    writeGenres: current?.writeGenres ?? cfg.nfo?.include?.genre ?? true,
    mergeStrategy:
      current?.mergeStrategy ?? cfg.nfo?.mergeStrategy ?? cfg.nfoMergeStrategy ?? "prefer_scraped",
  };
}

function seedSources(cfg: ScrapeConfig, current?: JobSourcesOptions): JobSourcesOptions {
  return seedJobSources(cfg, current);
}

export function JobAdvancedSettingsModal({
  open,
  value,
  onChange,
  onClose,
  notify,
  onSavePreset,
  onExportPresets,
  onImportPresets,
}: Props) {
  const [tab, setTab] = useState<JobOptionsTab>("organize");
  const [loading, setLoading] = useState(false);
  const [scrape, setScrape] = useState<ScrapeConfig | null>(null);
  const [organize, setOrganize] = useState<OrganizeConfig | null>(null);
  const [catalog, setCatalog] = useState<ProviderCatalogRow[]>([]);

  const options = { ...defaultJobOptions(), ...value };
  const usingGlobal = isUsingGlobal(options, tab);

  useEffect(() => {
    if (!open) return;
    setTab("organize");
    setLoading(true);
    void (async () => {
      try {
        const [scrapeData, kindsData] = await Promise.all([fetchScrapeConfig(), fetchKinds()]);
        setScrape(scrapeData.config);
        setCatalog(scrapeData.catalog ?? []);
        setOrganize(kindsData.organize);
      } catch (e) {
        notify("error", e, "加载高级设置失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, notify]);

  function patch(partial: Partial<JobOptions>) {
    onChange({ ...options, ...partial });
  }

  function seedTab(nextTab: JobOptionsTab, next: JobOptions): JobOptions {
    if (!scrape || !organize) return next;
    if (nextTab === "organize") {
      return { ...next, organize: seedOrganize(organize, next.organize) };
    }
    if (nextTab === "download") {
      return { ...next, download: seedDownload(scrape, next.download) };
    }
    if (nextTab === "naming") {
      return { ...next, naming: seedNaming(scrape, next.naming) };
    }
    if (nextTab === "watermark") {
      return { ...next, watermark: seedWatermark(scrape, next.watermark) };
    }
    if (nextTab === "metadata") {
      return { ...next, metadata: seedMetadata(scrape, next.metadata) };
    }
    if (nextTab === "nfo") {
      return { ...next, nfo: seedNfo(scrape, next.nfo) };
    }
    if (nextTab === "sources") {
      return { ...next, sources: seedSources(scrape, next.sources) };
    }
    return next;
  }

  function patchTabGlobal(nextTab: JobOptionsTab, useGlobal: boolean) {
    let next: JobOptions = {
      ...options,
      useGlobal: { ...options.useGlobal, [nextTab]: useGlobal },
    };
    if (!useGlobal) next = seedTab(nextTab, next);
    onChange(next);
  }

  function patchOrganize(partial: Partial<JobOrganizeOptions>) {
    patch({ organize: { ...options.organize, ...partial } });
  }

  function patchCleanup(partial: Partial<JobOrganizeCleanupOptions>) {
    patchOrganize({
      cleanup: { ...options.organize?.cleanup, ...partial },
    });
  }

  function patchDownload(partial: Partial<JobDownloadOptions>) {
    const download = { ...options.download, ...partial };
    if (typeof partial.amazonHdPoster === "boolean") {
      download.skipAmazon = !partial.amazonHdPoster;
    } else if (typeof partial.skipAmazon === "boolean") {
      download.amazonHdPoster = !partial.skipAmazon;
    }
    patch({ download });
  }

  function patchNaming(partial: Partial<JobNamingOptions>) {
    patch({ naming: { ...options.naming, ...partial } });
  }

  function patchWatermark(partial: Partial<JobWatermarkOptions>) {
    patch({ watermark: { ...options.watermark, ...partial } });
  }

  function patchMetadata(partial: Partial<JobMetadataOptions>) {
    patch({ metadata: { ...options.metadata, ...partial } });
  }

  function patchNfo(partial: Partial<JobNfoOptions>) {
    patch({ nfo: { ...options.nfo, ...partial } });
  }

  function renderFields() {
    if (usingGlobal || loading || !scrape || !organize) {
      if (usingGlobal) return null;
      return <div className="empty-block">加载配置…</div>;
    }

    const org = seedOrganize(organize, options.organize);
    const dl = seedDownload(scrape, options.download);
    const naming = seedNaming(scrape, options.naming);
    const wm = seedWatermark(scrape, options.watermark);
    const meta = seedMetadata(scrape, options.metadata);
    const nfo = seedNfo(scrape, options.nfo);
    const modeHint = ORGANIZE_MODES.find((m) => m.value === org.organizeMode)?.hint;
    const cleanupOff = !org.cleanup?.enabled;

    switch (tab) {
      case "organize":
        return (
          <div className="advanced-job-settings">
            <Panel title="整理模式">
              <SettingRow label="整理方式" hint={modeHint}>
                <select
                  className="org-select"
                  value={org.organizeMode}
                  onChange={(e) => patchOrganize({ organizeMode: e.target.value })}
                >
                  {ORGANIZE_MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </SettingRow>
              <SettingRow label="硬链/软链失败降级" hint="跨盘或权限失败时：复制继续，或直接失败">
                <select
                  className="org-select"
                  value={org.organizeFallback}
                  onChange={(e) => patchOrganize({ organizeFallback: e.target.value })}
                >
                  <option value="copy">降级为复制</option>
                  <option value="fail">直接失败</option>
                </select>
              </SettingRow>
              <SettingRow label="冲突策略">
                <select
                  className="org-select"
                  value={org.onConflict}
                  onChange={(e) => patchOrganize({ onConflict: e.target.value })}
                >
                  <option value="skip">跳过</option>
                  <option value="overwrite">覆盖</option>
                  <option value="rename">重命名</option>
                </select>
              </SettingRow>
            </Panel>

            <Panel title="路径与覆盖">
              <SettingRow
                label="元数据目录"
                hint="视频以外文件放到另外的目录；留空则与视频同目录"
                layout="stack"
              >
                <FolderPicker
                  value={org.metadataDir || ""}
                  onChange={(relative) => patchOrganize({ metadataDir: relative })}
                  onError={(msg) => notify("error", msg, "读取目录失败")}
                />
              </SettingRow>
              <SettingRow
                label="刮削出错时删除元数据目录"
                hint="开启后，刮削失败时删除已创建的封面/缓存与独立元数据子目录"
              >
                <Switch
                  checked={Boolean(org.deleteMetadataOnFail)}
                  onChange={(v) => patchOrganize({ deleteMetadataOnFail: v })}
                />
              </SettingRow>
              <SettingRow label="覆盖目标目录视频和字幕" hint="目标已有视频/字幕时是否覆盖">
                <Switch
                  checked={Boolean(org.overwriteVideoSubtitle)}
                  onChange={(v) => patchOrganize({ overwriteVideoSubtitle: v })}
                />
              </SettingRow>
              <SettingRow label="覆盖目标目录图片" hint="目标已有海报/图片时是否覆盖">
                <Switch
                  checked={Boolean(org.overwriteImages)}
                  onChange={(v) => patchOrganize({ overwriteImages: v })}
                />
              </SettingRow>
            </Panel>

            <Panel title="扫描与识别过滤">
              <SettingRow label="文件大小过滤 (MB)" hint="小于此体积忽略；影响目录监控与扫描">
                <input
                  className="org-input-sm"
                  type="number"
                  min={0}
                  value={org.minFileSizeMb ?? 0}
                  onChange={(e) =>
                    patchOrganize({ minFileSizeMb: Number(e.target.value) || 0 })
                  }
                />
              </SettingRow>
              <SettingRow label="文件类型白名单" hint="仅列表内后缀视为视频" layout="stack">
                <TagListEditor
                  values={org.videoExtensions ?? []}
                  onChange={(videoExtensions) => patchOrganize({ videoExtensions })}
                  placeholder="如 mp4"
                />
              </SettingRow>
              <SettingRow label="文件名黑名单" hint="文件名含条目则忽略" layout="stack">
                <TagListEditor
                  values={org.filenameBlacklist ?? []}
                  onChange={(filenameBlacklist) => patchOrganize({ filenameBlacklist })}
                />
              </SettingRow>
              <SettingRow
                label="文件名垃圾信息过滤"
                hint='解析番号时剔除；正则以 "r:" 开头'
                layout="stack"
              >
                <TagListEditor
                  values={org.junkFilters ?? []}
                  onChange={(junkFilters) => patchOrganize({ junkFilters })}
                  placeholder="如 1080p 或 r:pattern"
                />
              </SettingRow>
              <SettingRow label="破解关键词" hint="匹配文件名与路径，不区分大小写" layout="stack">
                <TagListEditor
                  values={org.crackKeywords ?? []}
                  onChange={(crackKeywords) => patchOrganize({ crackKeywords })}
                />
              </SettingRow>
            </Panel>

            <Panel
              title="自动清理源目录"
              danger
              off={cleanupOff}
              headExtra={
                <Switch
                  checked={Boolean(org.cleanup?.enabled)}
                  onChange={(v) => patchCleanup({ enabled: v })}
                />
              }
            >
              <SettingRow label="白名单保护" hint="视频与补充白名单类型不会被清理">
                <Switch
                  checked={org.cleanup?.whitelistProtect !== false}
                  onChange={(v) => patchCleanup({ whitelistProtect: v })}
                />
              </SettingRow>
              <SettingRow label="删除小文件" hint="按上方体积规则">
                <Switch
                  checked={Boolean(org.cleanup?.deleteSmallFiles)}
                  onChange={(v) => patchCleanup({ deleteSmallFiles: v })}
                />
              </SettingRow>
              <SettingRow label="删除非白名单类型">
                <Switch
                  checked={Boolean(org.cleanup?.deleteNonWhitelist)}
                  onChange={(v) => patchCleanup({ deleteNonWhitelist: v })}
                />
              </SettingRow>
              <SettingRow label="删除黑名单命中">
                <Switch
                  checked={Boolean(org.cleanup?.deleteBlacklist)}
                  onChange={(v) => patchCleanup({ deleteBlacklist: v })}
                />
              </SettingRow>
              <SettingRow label="补充白名单后缀" hint="白名单保护开启时额外保留" layout="stack">
                <TagListEditor
                  values={org.cleanup?.extraWhitelistExt ?? []}
                  onChange={(extraWhitelistExt) => patchCleanup({ extraWhitelistExt })}
                  placeholder="如 nfo, jpg"
                />
              </SettingRow>
            </Panel>
          </div>
        );

      case "download":
        return (
          <div className="advanced-job-settings">
            <Panel title="下载内容">
              <SettingRow label="海报 / 封面图">
                <Switch
                  checked={Boolean(dl.downloadPoster)}
                  onChange={(v) => patchDownload({ downloadPoster: v })}
                />
              </SettingRow>
              <SettingRow label="缩略图" hint="建议开启">
                <Switch
                  checked={Boolean(dl.downloadThumb)}
                  onChange={(v) => patchDownload({ downloadThumb: v })}
                />
              </SettingRow>
              <SettingRow
                label="背景图 fanart"
                hint="开启后下载 Provider 的 extrafanart 剧照到 extrafanart/ 目录"
              >
                <Switch
                  checked={Boolean(dl.downloadFanart)}
                  onChange={(v) => patchDownload({ downloadFanart: v })}
                />
              </SettingRow>
            </Panel>
            <Panel title="缩略图 / 封面策略">
              <SettingRow label="选图策略">
                <select
                  className="org-select"
                  value={dl.coverDownloadStrategy || "priority"}
                  onChange={(e) => patchDownload({ coverDownloadStrategy: e.target.value })}
                >
                  <option value="priority">按字段优先级</option>
                  <option value="size">按图片质量（较慢）</option>
                </select>
              </SettingRow>
            </Panel>
            <Panel title="高清海报">
              <SettingRow
                label="Amazon 高清海报"
                hint="用标题/番号搜 Amazon JP DVD 高清图"
              >
                <Switch
                  checked={Boolean(dl.amazonHdPoster)}
                  onChange={(v) => patchDownload({ amazonHdPoster: v })}
                />
              </SettingRow>
              <SettingRow label="Tenhow 高清海报" hint="用演员名在 tenhow.net 检索 ASIN 高清图">
                <Switch
                  checked={Boolean(dl.tenhowHdPoster)}
                  onChange={(v) => patchDownload({ tenhowHdPoster: v })}
                />
              </SettingRow>
              <SettingRow label="DMM 优先高清">
                <Switch
                  checked={Boolean(dl.preferHighResPoster)}
                  onChange={(v) => patchDownload({ preferHighResPoster: v })}
                />
              </SettingRow>
              <SettingRow label="Amazon 严格模式">
                <Switch
                  checked={Boolean(dl.amazonStrictMode)}
                  onChange={(v) => patchDownload({ amazonStrictMode: v })}
                />
              </SettingRow>
            </Panel>
            <Panel title="字幕与裁剪">
              <SettingRow label="字幕库路径" layout="stack">
                <FolderPicker
                  value={dl.subtitleLibraryPath || ""}
                  onChange={(relative) => patchDownload({ subtitleLibraryPath: relative })}
                  onError={(msg) => notify("error", msg, "读取目录失败")}
                />
              </SettingRow>
              <SettingRow label="海报裁剪比例">
                <select
                  className="org-select"
                  value={dl.cropRatio || "full"}
                  onChange={(e) => patchDownload({ cropRatio: e.target.value })}
                >
                  <option value="full">完整</option>
                  <option value="emby">Emby 竖版</option>
                </select>
              </SettingRow>
              <SettingRow label="独立裁剪海报">
                <Switch
                  checked={Boolean(dl.cropIndependentPoster)}
                  onChange={(v) => patchDownload({ cropIndependentPoster: v })}
                />
              </SettingRow>
              <SettingRow label="优先使用裁剪结果">
                <Switch
                  checked={Boolean(dl.preferCropResult)}
                  onChange={(v) => patchDownload({ preferCropResult: v })}
                />
              </SettingRow>
            </Panel>
          </div>
        );

      case "naming":
        return (
          <div className="advanced-job-settings">
            <Panel title="命名模板">
              <SettingRow label="目录模板" layout="stack">
                <input
                  className="org-input"
                  value={naming.directoryTemplate || ""}
                  onChange={(e) => patchNaming({ directoryTemplate: e.target.value })}
                  placeholder="{category}/{studio}/{number}"
                />
              </SettingRow>
              <SettingRow label="文件名模板" layout="stack">
                <input
                  className="org-input"
                  value={naming.fileNameTemplate || ""}
                  onChange={(e) => patchNaming({ fileNameTemplate: e.target.value })}
                  placeholder="{number}"
                />
              </SettingRow>
              <SettingRow label="文件名后缀" layout="stack">
                <input
                  className="org-input"
                  value={naming.nameSuffixTemplate || ""}
                  onChange={(e) => patchNaming({ nameSuffixTemplate: e.target.value })}
                  placeholder="如 -{mosaic}"
                />
              </SettingRow>
              <SettingRow label="海报裁剪">
                <select
                  className="org-select"
                  value={naming.posterCrop || "right"}
                  onChange={(e) => patchNaming({ posterCrop: e.target.value })}
                >
                  <option value="right">右裁</option>
                  <option value="none">不裁</option>
                  <option value="face">人脸（失败居中）</option>
                </select>
              </SettingRow>
            </Panel>
          </div>
        );

      case "watermark":
        return (
          <div className="advanced-job-settings">
            <Panel title="水印">
              <SettingRow label="启用水印">
                <Switch
                  checked={Boolean(wm.enabled)}
                  onChange={(v) => patchWatermark({ enabled: v })}
                />
              </SettingRow>
              <SettingRow label="位置">
                <select
                  className="org-select"
                  value={wm.position || "top-right"}
                  onChange={(e) => patchWatermark({ position: e.target.value })}
                >
                  <option value="top-left">左上</option>
                  <option value="top-right">右上</option>
                  <option value="bottom-left">左下</option>
                  <option value="bottom-right">右下</option>
                </select>
              </SettingRow>
              <SettingRow label="缩放 %">
                <input
                  className="org-input"
                  type="number"
                  min={4}
                  max={40}
                  value={wm.scalePercent ?? 12}
                  onChange={(e) =>
                    patchWatermark({ scalePercent: Number(e.target.value) || 12 })
                  }
                />
              </SettingRow>
              {(
                [
                  ["markSubtitle", "标记字幕"],
                  ["markCracked", "标记破解"],
                  ["markLeak", "标记流出"],
                  ["markUncensored", "标记无码"],
                  ["markCensored", "标记有码"],
                ] as const
              ).map(([key, label]) => (
                <SettingRow key={key} label={label}>
                  <Switch
                    checked={Boolean(wm[key])}
                    onChange={(v) => patchWatermark({ [key]: v })}
                  />
                </SettingRow>
              ))}
            </Panel>
          </div>
        );

      case "metadata":
        return (
          <div className="advanced-job-settings">
            <Panel title="数据校验">
              <SettingRow
                label="启用严格字段模式"
                hint="关键字段缺失时触发完整性校验，防止漏刮数据"
              >
                <Switch
                  checked={Boolean(meta.strictMode)}
                  onChange={(v) => patchMetadata({ strictMode: v })}
                />
              </SettingRow>
              <SettingRow label="强制校验图片结果" hint="封面或缩略图未成功刮削时视为失败">
                <Switch
                  checked={Boolean(meta.requireCover)}
                  onChange={(v) => patchMetadata({ requireCover: v })}
                />
              </SettingRow>
            </Panel>
            <Panel title="元数据优化">
              <SettingRow label="使用色花堂中文标题" hint="番号匹配时优先使用色花堂中文标题">
                <Switch
                  checked={Boolean(meta.useForumZhTitle)}
                  onChange={(v) => patchMetadata({ useForumZhTitle: v })}
                />
              </SettingRow>
              <SettingRow label="启用演员数据映射">
                <Switch
                  checked={Boolean(meta.enableActorMapping)}
                  onChange={(v) => patchMetadata({ enableActorMapping: v })}
                />
              </SettingRow>
              <SettingRow label="启用标签数据映射">
                <Switch
                  checked={Boolean(meta.enableTagMapping)}
                  onChange={(v) => patchMetadata({ enableTagMapping: v })}
                />
              </SettingRow>
              <SettingRow label="精简多余的换行符（简介）">
                <Switch
                  checked={Boolean(meta.trimPlot)}
                  onChange={(v) => patchMetadata({ trimPlot: v })}
                />
              </SettingRow>
              <SettingRow label="自动翻译标题">
                <Switch
                  checked={Boolean(meta.autoTranslateTitle)}
                  onChange={(v) => patchMetadata({ autoTranslateTitle: v })}
                />
              </SettingRow>
              <SettingRow label="自动翻译简介">
                <Switch
                  checked={Boolean(meta.autoTranslateOutline)}
                  onChange={(v) => patchMetadata({ autoTranslateOutline: v })}
                />
              </SettingRow>
            </Panel>
          </div>
        );

      case "nfo":
        return (
          <div className="advanced-job-settings">
            <Panel title="NFO">
              <SettingRow label="写入演员">
                <Switch
                  checked={nfo.writeActors !== false}
                  onChange={(v) => patchNfo({ writeActors: v })}
                />
              </SettingRow>
              <SettingRow label="写入类型标签">
                <Switch
                  checked={nfo.writeGenres !== false}
                  onChange={(v) => patchNfo({ writeGenres: v })}
                />
              </SettingRow>
              <SettingRow label="合并策略" hint="重刮/重整理时的字段优先级">
                <select
                  className="org-select"
                  value={nfo.mergeStrategy || "prefer_scraped"}
                  onChange={(e) => patchNfo({ mergeStrategy: e.target.value })}
                >
                  <option value="prefer_scraped">刮削结果覆盖</option>
                  <option value="prefer_nfo">本地非空优先</option>
                </select>
              </SettingRow>
            </Panel>
          </div>
        );

      case "sources":
        return (
          <JobSourcesSettingsView
            scrape={scrape}
            catalog={catalog}
            value={seedSources(scrape, options.sources)}
            onChange={(sources) => patch({ sources })}
            notify={notify}
          />
        );

      default:
        return null;
    }
  }

  return (
    <Modal
      open={open}
      variant="sheet"
      title="手动任务 - 高级设置"
      padded
      className="modal-advanced-job"
      onClose={onClose}
      footer={
        <>
          <div className="advanced-job-foot-left">
            {onSavePreset ? (
              <button type="button" className="btn text" onClick={onSavePreset}>
                保存为预设
              </button>
            ) : null}
            {onExportPresets ? (
              <button type="button" className="btn text" onClick={onExportPresets}>
                导出预设
              </button>
            ) : null}
            {onImportPresets ? (
              <button type="button" className="btn text" onClick={onImportPresets}>
                导入预设
              </button>
            ) : null}
          </div>
          <div className="advanced-job-foot-right">
            <button type="button" className="btn primary solid" onClick={onClose}>
              保存修改
            </button>
            <button type="button" className="btn text" onClick={onClose}>
              关闭
            </button>
          </div>
        </>
      }
    >
      <div className="advanced-job-modal">
        <div className="advanced-job-tabs" role="tablist">
          {JOB_ADVANCED_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={`advanced-job-tab${tab === item.id ? " is-active" : ""}`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label className="advanced-job-row">
          <span>使用全局配置</span>
          <span className="switch">
            <input
              type="checkbox"
              checked={usingGlobal}
              onChange={(e) => patchTabGlobal(tab, e.target.checked)}
            />
          </span>
        </label>

        <div className="advanced-job-panel">{renderFields()}</div>
      </div>
    </Modal>
  );
}
