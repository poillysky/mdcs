import type { OrganizeConfig, ProviderSiteConfig, ScrapeConfig } from "../types";

export const JOB_ADVANCED_TABS = [
  { id: "organize", label: "整理" },
  { id: "download", label: "下载" },
  { id: "naming", label: "命名" },
  { id: "watermark", label: "水印" },
  { id: "metadata", label: "元数据" },
  { id: "nfo", label: "NFO" },
  { id: "sources", label: "数据源" },
] as const;

export type JobOptionsTab = (typeof JOB_ADVANCED_TABS)[number]["id"];

export type JobOrganizeCleanupOptions = {
  enabled?: boolean;
  whitelistProtect?: boolean;
  deleteSmallFiles?: boolean;
  deleteNonWhitelist?: boolean;
  deleteBlacklist?: boolean;
  extraWhitelistExt?: string[];
};

export type JobOrganizeOptions = {
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
  cleanup?: JobOrganizeCleanupOptions;
};

/** 任务级下载覆盖：对齐设置·下载（含选图策略） */
export type JobDownloadOptions = Partial<NonNullable<ScrapeConfig["download"]>> & {
  coverDownloadStrategy?: string;
};

/** 任务级命名覆盖：对齐设置·命名完整结构 */
export type JobNamingOptions = Partial<NonNullable<ScrapeConfig["naming"]>>;

/** 任务级水印覆盖：对齐设置·水印 */
export type JobWatermarkOptions = Partial<NonNullable<ScrapeConfig["watermark"]>>;

/** 任务级元数据覆盖：对齐设置·元数据 */
export type JobMetadataOptions = Partial<NonNullable<ScrapeConfig["metadata"]>>;

/** 任务级 NFO 覆盖：完整 nfo + 兼容旧 writeActors/writeGenres */
export type JobNfoOptions = Partial<NonNullable<ScrapeConfig["nfo"]>> & {
  writeActors?: boolean;
  writeGenres?: boolean;
  mergeStrategy?: string;
};

export type JobSourcesOptions = {
  disabledProviders?: string[];
  providerSettings?: Record<string, ProviderSiteConfig>;
  providerRetryDefault?: number;
  theporndbApiKey?: string;
  fieldPriority?: Record<string, string[]>;
  fieldBlockedSources?: Record<string, string[]>;
  recognitionWords?: ScrapeConfig["recognitionWords"];
  kindProfiles?: ScrapeConfig["kindProfiles"];
};

export type JobOptions = {
  useGlobal?: Partial<Record<JobOptionsTab, boolean>>;
  organize?: JobOrganizeOptions;
  download?: JobDownloadOptions;
  naming?: JobNamingOptions;
  watermark?: JobWatermarkOptions;
  metadata?: JobMetadataOptions;
  nfo?: JobNfoOptions;
  sources?: JobSourcesOptions;
  forceScan?: boolean;
};

export function defaultJobOptions(): JobOptions {
  return {
    useGlobal: Object.fromEntries(JOB_ADVANCED_TABS.map((t) => [t.id, true])) as Record<
      JobOptionsTab,
      boolean
    >,
  };
}

export function isUsingGlobal(options: JobOptions, tab: JobOptionsTab) {
  return options.useGlobal?.[tab] !== false;
}

export function seedJobSources(
  cfg: ScrapeConfig,
  current?: JobSourcesOptions,
): JobSourcesOptions {
  return {
    disabledProviders: current?.disabledProviders ?? [...(cfg.disabledProviders ?? [])],
    providerSettings: current?.providerSettings ?? { ...(cfg.providerSettings ?? {}) },
    providerRetryDefault: current?.providerRetryDefault ?? cfg.providerRetryDefault ?? 0,
    theporndbApiKey: current?.theporndbApiKey ?? cfg.theporndbApiKey,
    fieldPriority: current?.fieldPriority ?? { ...(cfg.fieldPriority ?? {}) },
    fieldBlockedSources: current?.fieldBlockedSources ?? { ...(cfg.fieldBlockedSources ?? {}) },
    recognitionWords: current?.recognitionWords ?? {
      code: { ...(cfg.recognitionWords?.code ?? {}) },
      path: { ...(cfg.recognitionWords?.path ?? {}) },
    },
    kindProfiles: current?.kindProfiles ?? { ...(cfg.kindProfiles ?? {}) },
  };
}

/** 把任务级数据源覆盖合回一份可编辑的 ScrapeConfig 草稿 */
export function applyJobSources(base: ScrapeConfig, sources?: JobSourcesOptions): ScrapeConfig {
  if (!sources) return base;
  return {
    ...base,
    disabledProviders: sources.disabledProviders ?? base.disabledProviders,
    providerSettings: sources.providerSettings ?? base.providerSettings,
    providerRetryDefault: sources.providerRetryDefault ?? base.providerRetryDefault,
    theporndbApiKey: sources.theporndbApiKey ?? base.theporndbApiKey,
    fieldPriority: sources.fieldPriority ?? base.fieldPriority,
    fieldBlockedSources: sources.fieldBlockedSources ?? base.fieldBlockedSources,
    recognitionWords: sources.recognitionWords ?? base.recognitionWords,
    kindProfiles: sources.kindProfiles ?? base.kindProfiles,
  };
}

export function scrapeToJobSources(cfg: ScrapeConfig): JobSourcesOptions {
  return seedJobSources(cfg);
}

export function applyJobDownload(base: ScrapeConfig, dl?: JobDownloadOptions): ScrapeConfig {
  if (!dl) return base;
  const { coverDownloadStrategy, ...download } = dl;
  return {
    ...base,
    download: { ...base.download!, ...download },
    coverDownloadStrategy:
      coverDownloadStrategy === "size" || coverDownloadStrategy === "priority"
        ? coverDownloadStrategy
        : base.coverDownloadStrategy,
  };
}

export function scrapeToJobDownload(cfg: ScrapeConfig): JobDownloadOptions {
  return {
    ...cfg.download,
    coverDownloadStrategy: cfg.coverDownloadStrategy,
  };
}

export function applyJobNaming(base: ScrapeConfig, naming?: JobNamingOptions): ScrapeConfig {
  if (!naming) return base;
  return {
    ...base,
    naming: { ...base.naming!, ...naming },
  };
}

export function scrapeToJobNaming(cfg: ScrapeConfig): JobNamingOptions {
  return { ...cfg.naming };
}

export function applyJobWatermark(base: ScrapeConfig, wm?: JobWatermarkOptions): ScrapeConfig {
  if (!wm) return base;
  return {
    ...base,
    watermark: { ...base.watermark!, ...wm },
  };
}

export function scrapeToJobWatermark(cfg: ScrapeConfig): JobWatermarkOptions {
  return { ...cfg.watermark };
}

export function applyJobMetadata(base: ScrapeConfig, meta?: JobMetadataOptions): ScrapeConfig {
  if (!meta) return base;
  return {
    ...base,
    metadata: { ...base.metadata!, ...meta },
  };
}

export function scrapeToJobMetadata(cfg: ScrapeConfig): JobMetadataOptions {
  return { ...cfg.metadata };
}

export function applyJobNfo(base: ScrapeConfig, nfo?: JobNfoOptions): ScrapeConfig {
  if (!nfo) return base;
  const {
    writeActors,
    writeGenres,
    mergeStrategy,
    include,
    tagExtras,
    tagFormats,
    enabled,
    tagline,
  } = nfo;
  const resolvedMerge =
    mergeStrategy === "prefer_nfo" || mergeStrategy === "prefer_scraped"
      ? mergeStrategy
      : base.nfo?.mergeStrategy || base.nfoMergeStrategy || "prefer_scraped";
  const merged: NonNullable<ScrapeConfig["nfo"]> = {
    ...base.nfo!,
    enabled: typeof enabled === "boolean" ? enabled : base.nfo!.enabled,
    tagline: typeof tagline === "string" ? tagline : base.nfo!.tagline,
    include: {
      ...base.nfo!.include,
      ...include,
      ...(typeof writeActors === "boolean" ? { actor: writeActors } : {}),
      ...(typeof writeGenres === "boolean" ? { genre: writeGenres } : {}),
    },
    tagExtras: { ...base.nfo!.tagExtras, ...tagExtras },
    tagFormats: { ...base.nfo!.tagFormats, ...tagFormats },
    mergeStrategy: resolvedMerge,
  };
  return {
    ...base,
    nfo: merged,
    nfoMergeStrategy: resolvedMerge,
  };
}

export function scrapeToJobNfo(cfg: ScrapeConfig): JobNfoOptions {
  return {
    ...cfg.nfo,
    writeActors: cfg.nfo?.include?.actor !== false,
    writeGenres: cfg.nfo?.include?.genre !== false,
    mergeStrategy: cfg.nfo?.mergeStrategy ?? cfg.nfoMergeStrategy,
  };
}

export function seedJobOrganize(
  org: OrganizeConfig,
  current?: JobOrganizeOptions,
): JobOrganizeOptions {
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
