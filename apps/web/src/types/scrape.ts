import type { ProviderSiteConfig } from "./provider.js";

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
