import { useState, type ReactNode } from "react";
import { FolderPicker } from "../FolderPicker";
import { SettingRow } from "../SettingRow";
import type {
  JobDownloadOptions,
  JobMetadataOptions,
  JobNamingOptions,
  JobNfoOptions,
  JobOrganizeCleanupOptions,
  JobOrganizeOptions,
  JobWatermarkOptions,
} from "../../lib/jobOptions";
import type { NotifyFn } from "../../lib/notify";
import type { OrganizeConfig, ScrapeConfig } from "../../types";

export const ORGANIZE_MODES = [
  { value: "hardlink", label: "硬链接", hint: "同盘零拷贝，不支持跨盘" },
  { value: "softlink", label: "软链接", hint: "仅生成链接，播放器需能寻址源文件" },
  { value: "inplace", label: "原地整理", hint: "源目录内出结果，忽略输出目录" },
  { value: "copy", label: "复制", hint: "保留源文件，占用双倍空间" },
  { value: "move", label: "移动", hint: "删除源文件，请谨慎使用" },
] as const;

export function TagListEditor({
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

export function Switch({
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

export function Panel({
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
    <section className={`mon-panel${danger ? " mon-panel--danger" : ""}${off ? " is-off" : ""}`}>
      <header className="mon-panel-head">
        <h3 className="mon-panel-title">{title}</h3>
        {headExtra}
      </header>
      <div className="mon-panel-body">{children}</div>
    </section>
  );
}

export function seedOrganize(org: OrganizeConfig, current?: JobOrganizeOptions): JobOrganizeOptions {
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

export function seedDownload(cfg: ScrapeConfig, current?: JobDownloadOptions): JobDownloadOptions {
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

export function seedNaming(cfg: ScrapeConfig, current?: JobNamingOptions): JobNamingOptions {
  const n = cfg.naming;
  return {
    directoryTemplate: current?.directoryTemplate ?? n?.directoryTemplate ?? "",
    fileNameTemplate: current?.fileNameTemplate ?? n?.fileNameTemplate ?? "{number}",
    nameSuffixTemplate: current?.nameSuffixTemplate ?? n?.nameSuffixTemplate ?? "",
    posterCrop: current?.posterCrop ?? n?.posterCrop ?? "right",
  };
}

export function seedWatermark(cfg: ScrapeConfig, current?: JobWatermarkOptions): JobWatermarkOptions {
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

export function seedMetadata(cfg: ScrapeConfig, current?: JobMetadataOptions): JobMetadataOptions {
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

export function seedNfo(cfg: ScrapeConfig, current?: JobNfoOptions): JobNfoOptions {
  return {
    writeActors: current?.writeActors ?? cfg.nfo?.include?.actor ?? true,
    writeGenres: current?.writeGenres ?? cfg.nfo?.include?.genre ?? true,
    mergeStrategy:
      current?.mergeStrategy ?? cfg.nfo?.mergeStrategy ?? cfg.nfoMergeStrategy ?? "prefer_scraped",
  };
}

export function OrganizeFields({
  value,
  onChange,
  notify,
  header,
  variant = "full",
}: {
  value: JobOrganizeOptions;
  onChange: (next: JobOrganizeOptions) => void;
  notify: NotifyFn;
  header?: ReactNode;
  /** kind：仅分区可持久化的整理字段；full：与设置·整理对齐的完整项 */
  variant?: "full" | "kind";
}) {
  const org = value;
  const modeHint = ORGANIZE_MODES.find((m) => m.value === org.organizeMode)?.hint;
  const cleanupOff = !org.cleanup?.enabled;
  const full = variant === "full";

  function patch(partial: Partial<JobOrganizeOptions>) {
    onChange({ ...org, ...partial });
  }

  function patchCleanup(partial: Partial<JobOrganizeCleanupOptions>) {
    patch({ cleanup: { ...org.cleanup, ...partial } });
  }

  return (
    <div className="advanced-job-settings">
      {header}
      <Panel title="整理模式">
        <SettingRow label="整理方式" hint={modeHint}>
          <select
            className="org-select"
            value={org.organizeMode}
            onChange={(e) => patch({ organizeMode: e.target.value })}
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
            onChange={(e) => patch({ organizeFallback: e.target.value })}
          >
            <option value="copy">降级为复制</option>
            <option value="fail">直接失败</option>
          </select>
        </SettingRow>
        {full ? (
          <SettingRow label="冲突策略">
            <select
              className="org-select"
              value={org.onConflict}
              onChange={(e) => patch({ onConflict: e.target.value })}
            >
              <option value="skip">跳过</option>
              <option value="overwrite">覆盖</option>
              <option value="rename">重命名</option>
            </select>
          </SettingRow>
        ) : null}
      </Panel>

      <Panel title="路径与覆盖">
        <SettingRow
          label="元数据目录"
          hint="视频以外文件放到另外的目录；留空则与视频同目录"
          layout="stack"
        >
          <FolderPicker
            value={org.metadataDir || ""}
            onChange={(relative) => patch({ metadataDir: relative })}
            onError={(msg) => notify("error", msg, "读取目录失败")}
          />
        </SettingRow>
        <SettingRow
          label="刮削出错时删除元数据目录"
          hint="开启后，刮削失败时删除已创建的封面/缓存与独立元数据子目录"
        >
          <Switch
            checked={Boolean(org.deleteMetadataOnFail)}
            onChange={(v) => patch({ deleteMetadataOnFail: v })}
          />
        </SettingRow>
        {full ? (
          <>
            <SettingRow label="覆盖目标目录视频和字幕" hint="目标已有视频/字幕时是否覆盖">
              <Switch
                checked={Boolean(org.overwriteVideoSubtitle)}
                onChange={(v) => patch({ overwriteVideoSubtitle: v })}
              />
            </SettingRow>
            <SettingRow label="覆盖目标目录图片" hint="目标已有海报/图片时是否覆盖">
              <Switch
                checked={Boolean(org.overwriteImages)}
                onChange={(v) => patch({ overwriteImages: v })}
              />
            </SettingRow>
          </>
        ) : (
          <p className="set-section-sub">
            冲突策略、扫描过滤与自动清理请在「设置 → 整理」全局配置；关闭「使用全局」后本分区仅覆盖上方整理参数。
          </p>
        )}
      </Panel>

      {full ? (
        <>
          <Panel title="扫描与识别过滤">
            <SettingRow label="文件大小过滤 (MB)" hint="小于此体积忽略；影响目录监控与扫描">
              <input
                className="org-input-sm"
                type="number"
                min={0}
                value={org.minFileSizeMb ?? 0}
                onChange={(e) => patch({ minFileSizeMb: Number(e.target.value) || 0 })}
              />
            </SettingRow>
            <SettingRow label="文件类型白名单" hint="仅列表内后缀视为视频" layout="stack">
              <TagListEditor
                values={org.videoExtensions ?? []}
                onChange={(videoExtensions) => patch({ videoExtensions })}
                placeholder="如 mp4"
              />
            </SettingRow>
            <SettingRow label="文件名黑名单" hint="文件名含条目则忽略" layout="stack">
              <TagListEditor
                values={org.filenameBlacklist ?? []}
                onChange={(filenameBlacklist) => patch({ filenameBlacklist })}
              />
            </SettingRow>
            <SettingRow
              label="文件名垃圾信息过滤"
              hint='解析番号时剔除；正则以 "r:" 开头'
              layout="stack"
            >
              <TagListEditor
                values={org.junkFilters ?? []}
                onChange={(junkFilters) => patch({ junkFilters })}
                placeholder="如 1080p 或 r:pattern"
              />
            </SettingRow>
            <SettingRow label="破解关键词" hint="匹配文件名与路径，不区分大小写" layout="stack">
              <TagListEditor
                values={org.crackKeywords ?? []}
                onChange={(crackKeywords) => patch({ crackKeywords })}
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
        </>
      ) : null}
    </div>
  );
}

export function DownloadFields({
  value,
  onChange,
  notify,
  variant = "full",
}: {
  value: JobDownloadOptions;
  onChange: (next: JobDownloadOptions) => void;
  notify: NotifyFn;
  variant?: "full" | "kind";
}) {
  const dl = value;

  function patch(partial: Partial<JobDownloadOptions>) {
    const next = { ...dl, ...partial };
    if (typeof partial.amazonHdPoster === "boolean") {
      next.skipAmazon = !partial.amazonHdPoster;
    } else if (typeof partial.skipAmazon === "boolean") {
      next.amazonHdPoster = !partial.skipAmazon;
    }
    onChange(next);
  }

  return (
    <div className="advanced-job-settings">
      <Panel title="下载内容">
        <SettingRow label="海报 / 封面图">
          <Switch checked={Boolean(dl.downloadPoster)} onChange={(v) => patch({ downloadPoster: v })} />
        </SettingRow>
        <SettingRow label="缩略图" hint="建议开启">
          <Switch checked={Boolean(dl.downloadThumb)} onChange={(v) => patch({ downloadThumb: v })} />
        </SettingRow>
        <SettingRow
          label="背景图 fanart"
          hint="开启后下载 Provider 的 extrafanart 剧照到 extrafanart/ 目录"
        >
          <Switch checked={Boolean(dl.downloadFanart)} onChange={(v) => patch({ downloadFanart: v })} />
        </SettingRow>
      </Panel>
      {variant === "full" ? (
        <Panel title="缩略图 / 封面策略">
          <SettingRow label="选图策略">
            <select
              className="org-select"
              value={dl.coverDownloadStrategy || "priority"}
              onChange={(e) => patch({ coverDownloadStrategy: e.target.value })}
            >
              <option value="priority">按字段优先级</option>
              <option value="size">按图片质量（较慢）</option>
            </select>
          </SettingRow>
        </Panel>
      ) : null}
      <Panel title="高清海报">
        <SettingRow label="Amazon 高清海报" hint="用标题/番号搜 Amazon JP DVD 高清图">
          <Switch checked={Boolean(dl.amazonHdPoster)} onChange={(v) => patch({ amazonHdPoster: v })} />
        </SettingRow>
        <SettingRow label="Tenhow 高清海报" hint="用演员名在 tenhow.net 检索 ASIN 高清图">
          <Switch checked={Boolean(dl.tenhowHdPoster)} onChange={(v) => patch({ tenhowHdPoster: v })} />
        </SettingRow>
        <SettingRow label="DMM 优先高清">
          <Switch
            checked={Boolean(dl.preferHighResPoster)}
            onChange={(v) => patch({ preferHighResPoster: v })}
          />
        </SettingRow>
        <SettingRow label="Amazon 严格模式">
          <Switch
            checked={Boolean(dl.amazonStrictMode)}
            onChange={(v) => patch({ amazonStrictMode: v })}
          />
        </SettingRow>
      </Panel>
      <Panel title="字幕与裁剪">
        <SettingRow label="字幕库路径" layout="stack">
          <FolderPicker
            value={dl.subtitleLibraryPath || ""}
            onChange={(relative) => patch({ subtitleLibraryPath: relative })}
            onError={(msg) => notify("error", msg, "读取目录失败")}
          />
        </SettingRow>
        <SettingRow label="海报裁剪比例">
          <select
            className="org-select"
            value={dl.cropRatio || "full"}
            onChange={(e) =>
              patch({
                cropRatio: e.target.value === "emby" ? "emby" : "full",
              })
            }
          >
            <option value="full">完整</option>
            <option value="emby">Emby 竖版</option>
          </select>
        </SettingRow>
        <SettingRow label="独立裁剪海报">
          <Switch
            checked={Boolean(dl.cropIndependentPoster)}
            onChange={(v) => patch({ cropIndependentPoster: v })}
          />
        </SettingRow>
        <SettingRow label="优先使用裁剪结果">
          <Switch
            checked={Boolean(dl.preferCropResult)}
            onChange={(v) => patch({ preferCropResult: v })}
          />
        </SettingRow>
      </Panel>
    </div>
  );
}

export function NamingFields({
  value,
  onChange,
}: {
  value: JobNamingOptions;
  onChange: (next: JobNamingOptions) => void;
}) {
  function patch(partial: Partial<JobNamingOptions>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="advanced-job-settings">
      <Panel title="命名模板">
        <SettingRow label="目录模板" layout="stack">
          <input
            className="org-input"
            value={value.directoryTemplate || ""}
            onChange={(e) => patch({ directoryTemplate: e.target.value })}
            placeholder="{category}/{studio}/{number}"
          />
        </SettingRow>
        <SettingRow label="文件名模板" layout="stack">
          <input
            className="org-input"
            value={value.fileNameTemplate || ""}
            onChange={(e) => patch({ fileNameTemplate: e.target.value })}
            placeholder="{number}"
          />
        </SettingRow>
        <SettingRow label="文件名后缀" layout="stack">
          <input
            className="org-input"
            value={value.nameSuffixTemplate || ""}
            onChange={(e) => patch({ nameSuffixTemplate: e.target.value })}
            placeholder="如 -{mosaic}"
          />
        </SettingRow>
        <SettingRow label="海报裁剪">
          <select
            className="org-select"
            value={value.posterCrop || "right"}
            onChange={(e) => patch({ posterCrop: e.target.value })}
          >
            <option value="right">右裁</option>
            <option value="none">不裁</option>
            <option value="face">人脸（失败居中）</option>
          </select>
        </SettingRow>
      </Panel>
    </div>
  );
}

export function WatermarkFields({
  value,
  onChange,
}: {
  value: JobWatermarkOptions;
  onChange: (next: JobWatermarkOptions) => void;
}) {
  function patch(partial: Partial<JobWatermarkOptions>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="advanced-job-settings">
      <Panel title="水印">
        <SettingRow label="启用水印">
          <Switch checked={Boolean(value.enabled)} onChange={(v) => patch({ enabled: v })} />
        </SettingRow>
        <SettingRow label="位置">
          <select
            className="org-select"
            value={value.position || "top-right"}
            onChange={(e) => patch({ position: e.target.value })}
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
            value={value.scalePercent ?? 12}
            onChange={(e) => patch({ scalePercent: Number(e.target.value) || 12 })}
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
            <Switch checked={Boolean(value[key])} onChange={(v) => patch({ [key]: v })} />
          </SettingRow>
        ))}
      </Panel>
    </div>
  );
}

export function MetadataFields({
  value,
  onChange,
}: {
  value: JobMetadataOptions;
  onChange: (next: JobMetadataOptions) => void;
}) {
  function patch(partial: Partial<JobMetadataOptions>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="advanced-job-settings">
      <Panel title="数据校验">
        <SettingRow label="启用严格字段模式" hint="关键字段缺失时触发完整性校验，防止漏刮数据">
          <Switch checked={Boolean(value.strictMode)} onChange={(v) => patch({ strictMode: v })} />
        </SettingRow>
        <SettingRow label="强制校验图片结果" hint="封面或缩略图未成功刮削时视为失败">
          <Switch checked={Boolean(value.requireCover)} onChange={(v) => patch({ requireCover: v })} />
        </SettingRow>
      </Panel>
      <Panel title="元数据优化">
        <SettingRow label="使用色花堂中文标题" hint="番号匹配时优先使用色花堂中文标题">
          <Switch
            checked={Boolean(value.useForumZhTitle)}
            onChange={(v) => patch({ useForumZhTitle: v })}
          />
        </SettingRow>
        <SettingRow label="启用演员数据映射">
          <Switch
            checked={Boolean(value.enableActorMapping)}
            onChange={(v) => patch({ enableActorMapping: v })}
          />
        </SettingRow>
        <SettingRow label="启用标签数据映射">
          <Switch
            checked={Boolean(value.enableTagMapping)}
            onChange={(v) => patch({ enableTagMapping: v })}
          />
        </SettingRow>
        <SettingRow label="精简多余的换行符（简介）">
          <Switch checked={Boolean(value.trimPlot)} onChange={(v) => patch({ trimPlot: v })} />
        </SettingRow>
        <SettingRow label="自动翻译标题">
          <Switch
            checked={Boolean(value.autoTranslateTitle)}
            onChange={(v) => patch({ autoTranslateTitle: v })}
          />
        </SettingRow>
        <SettingRow label="自动翻译简介">
          <Switch
            checked={Boolean(value.autoTranslateOutline)}
            onChange={(v) => patch({ autoTranslateOutline: v })}
          />
        </SettingRow>
      </Panel>
    </div>
  );
}

export function NfoFields({
  value,
  onChange,
  variant = "full",
}: {
  value: JobNfoOptions;
  onChange: (next: JobNfoOptions) => void;
  variant?: "full" | "kind";
}) {
  function patch(partial: Partial<JobNfoOptions>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="advanced-job-settings">
      <Panel title="NFO">
        {variant === "full" ? (
          <>
            <SettingRow label="写入演员">
              <Switch
                checked={value.writeActors !== false}
                onChange={(v) => patch({ writeActors: v })}
              />
            </SettingRow>
            <SettingRow label="写入类型标签">
              <Switch
                checked={value.writeGenres !== false}
                onChange={(v) => patch({ writeGenres: v })}
              />
            </SettingRow>
          </>
        ) : null}
        <SettingRow label="合并策略" hint="重刮/重整理时的字段优先级">
          <select
            className="org-select"
            value={value.mergeStrategy || "prefer_scraped"}
            onChange={(e) =>
              patch({
                mergeStrategy:
                  e.target.value === "prefer_nfo" ? "prefer_nfo" : "prefer_scraped",
              })
            }
          >
            <option value="prefer_scraped">刮削结果覆盖</option>
            <option value="prefer_nfo">本地非空优先</option>
          </select>
        </SettingRow>
        {variant === "kind" ? (
          <p className="set-section-sub">字段写入开关请在「设置 → NFO」全局配置；本分区可覆盖合并策略。</p>
        ) : null}
      </Panel>
    </div>
  );
}
