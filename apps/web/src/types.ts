export type TabId = "config" | "sources" | "jobs" | "live";

export type ApiResponse<T = unknown> = {
  ok: boolean;
  data?: T;
  message?: string;
  code?: string;
};

export type HealthInfo = {
  service: string;
  version: string;
  phase: string;
  projectRoot?: string;
  kinds?: number;
};

export type OrganizeCleanupConfig = {
  enabled: boolean;
  whitelistProtect: boolean;
  deleteSmallFiles: boolean;
  deleteNonWhitelist: boolean;
  deleteBlacklist: boolean;
  extraWhitelistExt: string[];
};

export type OrganizeConfig = {
  defaultMode: string;
  defaultFallback: string;
  onConflict: string;
  metadataDir: string;
  deleteMetadataOnFail: boolean;
  overwriteVideoSubtitle: boolean;
  overwriteImages: boolean;
  minFileSizeMb: number;
  videoExtensions: string[];
  filenameBlacklist: string[];
  junkFilters: string[];
  crackKeywords: string[];
  cleanup: OrganizeCleanupConfig;
};

export type IndexFolder = {
  name: string;
  relative: string;
  mtime?: number;
};

export type IndexBrowse = {
  parent: string;
  folders: IndexFolder[];
};

export type KindRow = {
  id: string;
  label: string;
  enabled: boolean;
  sourceRoot: string;
  libraryRoot: string;
  sourceAbs: string;
  libraryAbs: string;
  organizeMode: string;
  organizeFallback?: string;
  useGlobalOrganize?: boolean;
  metadataDir?: string;
  deleteMetadataOnFail?: boolean;
  stats: Record<string, number>;
};

export type JobRow = {
  id: string;
  kinds: string[];
  mode: string;
  status: string;
  total: number;
  processed: number;
  failed: number;
  skipped: number;
  message?: string;
  dryRun?: boolean;
  options?: Record<string, unknown>;
  triggerSource?: string;
  createdAt?: number;
  updatedAt?: number;
};

export type FileRow = {
  id: number;
  kind: string;
  source_path: string;
  file_name: string;
  code: string | null;
  status: string;
  error?: string | null;
  file_size?: number;
  file_mtime?: number;
  cd_index?: number;
  mosaic?: string;
  scraped_at?: number | null;
  organized_at?: number | null;
  target_path?: string | null;
  title?: string | null;
  /** 中文标题（有则列表/导航优先） */
  titleZh?: string | null;
  actors?: string | null;
  duration?: string | null;
  /** 发行日 YYYY-MM-DD（列表从 meta 解析） */
  premiered?: string | null;
  /** 任务来源：manual | monitor | qb（join jobs.trigger_source） */
  triggerSource?: string | null;
  scrape_source?: string | null;
  cover_url?: string | null;
};

export type ScrapeMetaView = {
  code: string;
  /** DMM CID / 发行码（如 sone00993） */
  publishNumber?: string;
  kind: string;
  title: string;
  titleZh?: string;
  plot?: string;
  originalPlot?: string;
  actors?: string[];
  genres?: string[];
  directors?: string[];
  studio?: string;
  publisher?: string;
  series?: string;
  premiered?: string;
  runtime?: number | null;
  score?: number | null;
  ratingValue?: number | null;
  ratingMax?: number;
  ratingSource?: string;
  votes?: string | null;
  coverUrl?: string | null;
  coverLocal?: string | null;
  extrafanartUrls?: string[];
  extrafanartLocal?: string[];
  trailerUrl?: string;
  website?: string;
  mosaic?: string;
  source: string;
  sourcesTried?: string[];
  fieldSources?: Record<string, string>;
  fieldTimings?: Array<{ field: string; source?: string; ms?: number }>;
  sourceRuns?: Array<{
    id: string;
    ok: boolean;
    ms: number;
    error?: string;
    channel: "fast" | "slow";
  }>;
  scrapedAt?: string;
  ok?: boolean;
  message?: string;
  sourceSnapshots?: Record<string, SourceSnapshotView>;
};

export type SourceSnapshotView = {
  fields: Record<string, unknown>;
  coverUrl?: string | null;
  alternateCoverUrls?: string[];
  extrafanartUrls?: string[];
  error?: string;
};

export type JobEvent = {
  ts: string;
  level: "info" | "ok" | "warn" | "error";
  text: string;
  jobId?: string;
  kind?: string;
};

export type ProviderSiteConfig = {
  baseUrl: string;
  cookie: string;
  userAgent: string;
  cooldownSec: number;
  overrideRetry: boolean;
  retry: number;
  proxyUrl: string;
};

/** 自定义识别词支持的 Kind（对齐七路径） */
export type RecognitionKindKey =
  | "japan_censored"
  | "japan_gravure"
  | "japan_uncensored"
  | "japan_amateur"
  | "fc2"
  | "china"
  | "western";

export type ScrapeConfig = {
  enabled: boolean;
  proxyUrl: string;
  flareSolverrUrl: string;
  requestTimeoutSec: number;
  coverDownloadStrategy: string;
  exportFastConcurrency: number;
  exportSlowConcurrency: number;
  fieldPriority: Record<string, string[]>;
  fieldBlockedSources?: Record<string, string[]>;
  naming?: {
    directoryTemplate: string;
    mediaTitleTemplate?: string;
    fileNameTemplate: string;
    imageNameMode?: "none" | "video";
    maxDirectoryLength?: number;
    actorDisplayLimit?: number;
    nameSuffixTemplate: string;
    videoSuffixTemplate?: string;
    posterCrop: string;
    categoryLabels?: Record<string, string>;
    categoryRules?: { id: string; pattern: string; category: string }[];
    mosaicLabels?: Record<string, string>;
    mosaicSuffixLabels?: Record<string, string>;
    subtitleLabel?: string;
    noSubtitleLabel?: string;
    subtitleSuffixLabel?: string;
    subtitleAddChsSuffix?: boolean;
    partSuffixTemplate?: string;
    resolutionFieldTemplate?: string;
    resolutionTextMap?: string;
    resolutionEnabled?: Record<string, boolean>;
    resolutionInactiveLabel?: string;
    resolutionSuffixTemplate?: string;
    resolutionSuffixEnabled?: Record<string, boolean>;
    resolutionSource?: "probe" | "path" | "prefer_probe" | "prefer_path";
    resolutionFallback?: boolean;
  };
  disabledProviders: string[];
  providerSettings?: Record<string, ProviderSiteConfig>;
  providerRetryDefault?: number;
  theporndbApiKey?: string;
  nfoMergeStrategy?: "prefer_nfo" | "prefer_scraped";
  nfo?: {
    enabled: boolean;
    mergeStrategy: "prefer_nfo" | "prefer_scraped";
    include: {
      sorttitle: boolean;
      originaltitle: boolean;
      titleCd: boolean;
      outline: boolean;
      plot: boolean;
      originalplot: boolean;
      outlineNoCdata: boolean;
      outlineShowFrom: boolean;
      release: boolean;
      releasedate: boolean;
      premiered: boolean;
      actor: boolean;
      director: boolean;
      country: boolean;
      mpaa: boolean;
      customrating: boolean;
      year: boolean;
      runtime: boolean;
      votes: boolean;
      score: boolean;
      criticrating: boolean;
      series: boolean;
      tag: boolean;
      genre: boolean;
      studio: boolean;
      maker: boolean;
      publisher: boolean;
      label: boolean;
      poster: boolean;
      cover: boolean;
      trailer: boolean;
      website: boolean;
      actorSet: boolean;
      seriesSet: boolean;
      prefixSet: boolean;
    };
    tagExtras: {
      letters: boolean;
      actor: boolean;
      definition: boolean;
      cnword: boolean;
      mosaic: boolean;
      series: boolean;
      studio: boolean;
      publisher: boolean;
    };
    tagline: string;
    tagFormats: {
      cnword: string;
      series: string;
      studio: string;
      publisher: string;
    };
  };
  download?: {
    downloadPoster: boolean;
    downloadThumb: boolean;
    downloadFanart: boolean;
    preferHighResPoster: boolean;
    amazonHdPoster?: boolean;
    tenhowHdPoster?: boolean;
    amazonStrictMode?: boolean;
    skipAmazon: boolean;
    subtitleLibraryPath?: string;
    subtitleAddChsSuffix?: boolean;
    cropRatio?: "full" | "emby";
    cropIndependentPoster?: boolean;
    preferCropResult?: boolean;
  };
  metadata?: {
    strictMode: boolean;
    requireCover: boolean;
    useForumZhTitle: boolean;
    enableActorMapping: boolean;
    enableTagMapping: boolean;
    trimPlot: boolean;
    mappingLanguage: "zh-CN" | "zh-TW" | "ja" | "en";
    autoTranslateTitle: boolean;
    autoTranslateOutline: boolean;
    translateEngine: "openai";
    customSystemPrompt: string;
  };
  llm?: {
    baseUrl: string;
    apiKey: string;
    model: string;
  };
  recognitionWords?: {
    code: Partial<Record<RecognitionKindKey, string[]>>;
    path: Partial<Record<RecognitionKindKey, string[]>>;
  };
  watermark?: {
    enabled: boolean;
    position: string;
    scalePercent: number;
    style?: string;
    style4k?: string;
    customDir?: string;
    layout?: "stack" | "clockwise" | "counterclockwise";
    startPosition?: string;
    heightRatio?: number;
    offsetX?: number;
    offsetY?: number;
    spacing?: number;
    applyPoster?: boolean;
    applyThumb?: boolean;
    applyFanart?: boolean;
    markSubtitle: boolean;
    markCracked: boolean;
    markLeak: boolean;
    markUncensored: boolean;
    markCensored: boolean;
    markResolution?: boolean;
    posSubtitle?: string;
    posCracked?: string;
    posLeak?: string;
    posUncensored?: string;
    posCensored?: string;
    posResolution?: string;
  };
  kindProfiles: Record<
    string,
    {
      metaSources: string[];
      coverSources: string[];
      directoryTemplate: string;
      fileNameTemplate?: string;
      nameSuffixTemplate?: string;
      posterCrop: string;
      fieldPriority?: Record<string, string[]>;
      useGlobal?: {
        download?: boolean;
        naming?: boolean;
        watermark?: boolean;
        metadata?: boolean;
        nfo?: boolean;
        sources?: boolean;
      };
      download?: {
        downloadPoster?: boolean;
        downloadThumb?: boolean;
        downloadFanart?: boolean;
        preferHighResPoster?: boolean;
        amazonHdPoster?: boolean;
        tenhowHdPoster?: boolean;
        amazonStrictMode?: boolean;
        skipAmazon?: boolean;
        subtitleLibraryPath?: string;
        subtitleAddChsSuffix?: boolean;
        cropRatio?: "full" | "emby";
        cropIndependentPoster?: boolean;
        preferCropResult?: boolean;
      };
      watermark?: {
        enabled?: boolean;
        position?: string;
        scalePercent?: number;
        style?: string;
        style4k?: string;
        customDir?: string;
        layout?: "stack" | "clockwise" | "counterclockwise";
        startPosition?: string;
        heightRatio?: number;
        offsetX?: number;
        offsetY?: number;
        spacing?: number;
        applyPoster?: boolean;
        applyThumb?: boolean;
        applyFanart?: boolean;
        markSubtitle?: boolean;
        markCracked?: boolean;
        markLeak?: boolean;
        markUncensored?: boolean;
        markCensored?: boolean;
        markResolution?: boolean;
        posSubtitle?: string;
        posCracked?: string;
        posLeak?: string;
        posUncensored?: string;
        posCensored?: string;
        posResolution?: string;
      };
      metadata?: {
        strictMode?: boolean;
        requireCover?: boolean;
        trimPlot?: boolean;
        autoTranslateTitle?: boolean;
        autoTranslateOutline?: boolean;
        useForumZhTitle?: boolean;
        enableActorMapping?: boolean;
        enableTagMapping?: boolean;
        mappingLanguage?: "zh-CN" | "zh-TW" | "ja" | "en";
        translateEngine?: "openai";
        customSystemPrompt?: string;
      };
      nfoMergeStrategy?: "prefer_nfo" | "prefer_scraped";
    }
  >;
};

export type ProviderCatalogRow = {
  id: string;
  label: string;
  defaultUrl: string;
  probePath: string;
  access: string;
  group: "av" | "uncensored" | "fc2" | "chinese" | "western" | "general";
  tier?: 1 | 2 | 3 | 4 | 5;
  probeable?: boolean;
  defaultCooldownSec?: number;
  needsApiKey?: boolean;
  implemented: boolean;
  registered: boolean;
  enabled: boolean;
  notes?: string;
};

export type MonitorEntry = {
  id: string;
  path: string;
  kinds: string[];
  jobMode: string;
};

export type WebhookEndpoint = {
  id: string;
  name: string;
  method: "POST" | "GET" | "PUT";
  url: string;
  events: Array<"finished" | "failed">;
  kinds: string[];
  headers: Array<{ key: string; value: string }>;
  bodyTemplate: string;
  timeoutSec: number;
  retries: number;
};

export type OpsConfig = {
  monitor: {
    enabled: boolean;
    mode: "compat" | "performance";
    intervalSec: number;
    entries: MonitorEntry[];
  };
  webhook: {
    enabled: boolean;
    endpoints: WebhookEndpoint[];
  };
  presets: JobPreset[];
  lastJob?: LastJobSnapshot;
  qb: {
    enabled: boolean;
    jobMode: string;
    kinds: string[];
    categories: string[];
  };
  actors: {
    source: "local" | "emby";
    embyUrl: string;
    embyApiKey: string;
    embyUserId: string;
    libraryIds: string[];
    autoScrapeEnabled: boolean;
    autoScrapeRecentDays: number;
    refreshLibraryAfterScrape: boolean;
    scrapeMetadata: boolean;
    scrapeImages: boolean;
    metadataOverwrite: "missing" | "all";
  };
};

export type JobPreset = {
  id: string;
  name: string;
  kinds: string[];
  mode: string;
  dryRun: boolean;
  options: Record<string, unknown>;
  updatedAt: number;
};

export type LastJobSnapshot = {
  kinds: string[];
  mode: string;
  dryRun: boolean;
  options: Record<string, unknown>;
  savedAt: number;
};

export type ActorRow = {
  name: string;
  workCount: number;
  kinds: string[];
  codes: string[];
  lastScrapedAt: number | null;
  profileStatus?: "scraped" | "missing";
  mappedName?: string;
  avatarUrl?: string | null;
  overview?: string;
  profileScrapedAt?: number | null;
  imageScrapedAt?: number | null;
  birthday?: string;
  birthplace?: string;
  providerIds?: Record<string, string>;
  tags?: string[];
};
