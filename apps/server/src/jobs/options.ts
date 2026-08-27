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
  return raw as JobOptions;
}
