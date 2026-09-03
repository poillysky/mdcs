import { normalizeRelativePath } from "../security/pathPolicy.js";

export const JOB_OPTION_TABS = [
  "organize",
  "download",
  "naming",
  "watermark",
  "metadata",
  "nfo",
  "sources",
] as const;

export type JobOptionsTab = (typeof JOB_OPTION_TABS)[number];

/**
 * 任务级覆盖：字段与前端 JobOptions / scrape.json 对应段对齐。
 * normalize 透传，具体消费方按需取字段。
 */
export type JobOptions = {
  /** 全流程/扫描阶段强制重扫磁盘（不因 mtime 跳过） */
  forceScan?: boolean;
  /** 刮削阶段忽略 scrape_cache 强制重刮 */
  forceScrape?: boolean;
  /**
   * 恢复任务时跳过已完成阶段（pause/abort 后由 scheduler 写入）。
   * 勿手动设置。
   */
  resumeSkipPhases?: Array<"scan" | "scrape" | "organize">;
  /** 仅刮削指定文件 id（任务级范围） */
  fileIds?: number[];
  /** 等待队列插队（顺序有意义：靠前优先） */
  priorityFileIds?: number[];
  /** 仅对这些文件强制重刮（忽略 scrape_cache） */
  forceScrapeFileIds?: number[];
  /** fileIds 全部终态后自动结束任务（失败重刮专用） */
  closeWhenFileIdsDone?: boolean;
  /** 本轮失败重刮批次 id（完成后按 closeWhenRetryBatchDone 暂停原任务） */
  retryBatchFileIds?: number[];
  closeWhenRetryBatchDone?: boolean;
  /** 扫描子目录（须在分区来源下）；缺省扫整个来源根 */
  scanPath?: string;
  /** 各 Tab 是否使用全局配置，默认 true */
  useGlobal?: Partial<Record<JobOptionsTab, boolean>>;
  organize?: Record<string, unknown> & {
    organizeMode?: string;
    organizeFallback?: string;
    libraryRoot?: string;
    metadataDir?: string;
    deleteMetadataOnFail?: boolean;
    overwriteVideoSubtitle?: boolean;
    overwriteImages?: boolean;
    onConflict?: string;
    minFileSizeMb?: number;
    videoExtensions?: string[];
    filenameBlacklist?: string[];
    junkFilters?: string[];
    crackKeywords?: string[];
    cleanup?: Record<string, unknown>;
  };
  download?: Record<string, unknown> & {
    downloadPoster?: boolean;
    downloadThumb?: boolean;
    downloadFanart?: boolean;
    preferHighResPoster?: boolean;
    amazonHdPoster?: boolean;
    tenhowHdPoster?: boolean;
    amazonStrictMode?: boolean;
    skipAmazon?: boolean;
    subtitleLibraryPath?: string;
    cropRatio?: string;
    cropIndependentPoster?: boolean;
    preferCropResult?: boolean;
    coverDownloadStrategy?: string;
  };
  naming?: Record<string, unknown> & {
    directoryTemplate?: string;
    fileNameTemplate?: string;
    nameSuffixTemplate?: string;
    posterCrop?: string;
  };
  watermark?: Record<string, unknown> & {
    enabled?: boolean;
    position?: string;
    scalePercent?: number;
    markSubtitle?: boolean;
    markCracked?: boolean;
    markLeak?: boolean;
    markUncensored?: boolean;
    markCensored?: boolean;
    markResolution?: boolean;
  };
  metadata?: Record<string, unknown> & {
    strictMode?: boolean;
    requireCover?: boolean;
    trimPlot?: boolean;
    autoTranslateTitle?: boolean;
    autoTranslateOutline?: boolean;
    autoTranslate?: boolean;
    useForumZhTitle?: boolean;
    enableActorMapping?: boolean;
    enableTagMapping?: boolean;
  };
  nfo?: Record<string, unknown> & {
    writeActors?: boolean;
    writeGenres?: boolean;
    mergeStrategy?: string;
    include?: Record<string, boolean>;
  };
  sources?: Record<string, unknown> & {
    metaSources?: string[];
    disabledProviders?: string[];
  };
};

export function normalizeJobOptions(raw: unknown): JobOptions {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const opts = { ...(raw as JobOptions) };
  try {
    if (typeof opts.scanPath === "string" && opts.scanPath.trim()) {
      opts.scanPath = normalizeJobPath(opts.scanPath);
    }
    if (opts.organize) {
      const org = { ...opts.organize };
      if (typeof org.libraryRoot === "string" && org.libraryRoot.trim()) {
        org.libraryRoot = normalizeJobPath(org.libraryRoot);
      }
      if (typeof org.metadataDir === "string" && org.metadataDir.trim()) {
        org.metadataDir = normalizeJobPath(org.metadataDir);
      }
      opts.organize = org;
    }
    if (opts.download && typeof opts.download.subtitleLibraryPath === "string") {
      const sub = opts.download.subtitleLibraryPath.trim();
      if (sub) {
        opts.download = {
          ...opts.download,
          subtitleLibraryPath: normalizeJobPath(sub),
        };
      }
    }
  } catch {
    /* 保留原值，由消费方校验 */
  }
  if (Array.isArray(opts.fileIds) && opts.fileIds.length) {
    opts.fileIds = [...opts.fileIds]
      .filter((id): id is number => Number.isFinite(id))
      .sort((a, b) => a - b);
  }
  if (Array.isArray(opts.priorityFileIds) && opts.priorityFileIds.length) {
    opts.priorityFileIds = [...opts.priorityFileIds].filter((id): id is number =>
      Number.isFinite(id),
    );
  }
  if (Array.isArray(opts.forceScrapeFileIds) && opts.forceScrapeFileIds.length) {
    opts.forceScrapeFileIds = [...opts.forceScrapeFileIds]
      .filter((id): id is number => Number.isFinite(id))
      .sort((a, b) => a - b);
  }
  if (Array.isArray(opts.retryBatchFileIds) && opts.retryBatchFileIds.length) {
    opts.retryBatchFileIds = [...opts.retryBatchFileIds]
      .filter((id): id is number => Number.isFinite(id))
      .sort((a, b) => a - b);
  }
  return opts;
}

function normalizeJobPath(value: string): string {
  return normalizeRelativePath(value);
}
