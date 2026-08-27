import type { KindId } from "../types.js";
import type { NfoConfig } from "../organize/nfoConfig.js";

export type SourceId = string;

export type SourceSnapshot = {
  fields: Record<string, unknown>;
  coverUrl?: string | null;
  alternateCoverUrls?: string[];
  extrafanartUrls?: string[];
  error?: string;
};

export type ScrapeMeta = {
  code: string;
  /** DMM CID / 发行码（如 sone00993，区别于番号 SONE-993） */
  publishNumber?: string;
  kind: KindId;
  title: string;
  titleZh?: string;
  /** 日文/原文标题（部分源站字段 originaltitle） */
  originalTitle?: string;
  plot?: string;
  premiered?: string;
  studio?: string;
  publisher?: string;
  series?: string;
  actors: string[];
  genres: string[];
  /** 演员名 → javdb 等主页链接（映射表可选产出） */
  actorUrls?: Record<string, string>;
  runtime?: number | null;
  directors?: string[];
  trailerUrl?: string;
  website?: string;
  /** 0–10，写入 <rating>/<criticrating> */
  score?: number | null;
  /** 源站原生分制，如 javdb 4.42/5 */
  ratingValue?: number | null;
  ratingMax?: number;
  ratingSource?: string;
  votes?: string | null;
  /** 非中文简介（日文原文等） */
  originalPlot?: string;
  coverUrl?: string | null;
  /** 本地封面路径（下载后） */
  coverLocal?: string | null;
  /** 额外剧照 URL（Emby extrafanart 轮播） */
  extrafanartUrls?: string[];
  /** 本地剧照路径（相对或绝对，整理后写入） */
  extrafanartLocal?: string[];
  mosaic?: string;
  source: string;
  sourcesTried: string[];
  fieldSources: Record<string, string>;
  /** 各字段命中源及耗时（可观测性） */
  fieldTimings?: Array<{ field: string; source?: string; ms?: number }>;
  /** 各源实际请求（FAST/SLOW 可观测） */
  sourceRuns?: Array<{
    id: string;
    ok: boolean;
    ms: number;
    error?: string;
    channel: "fast" | "slow";
  }>;
  scrapedAt: string;
  ok: boolean;
  message?: string;
  /** 各源原始字段，供 UI 切换数据源 */
  sourceSnapshots?: Record<string, SourceSnapshot>;
};

export type ProviderResult = {
  source: SourceId;
  fields: Partial<ScrapeMeta>;
  coverUrl?: string | null;
  /** MDCX thumb/poster 等多 URL；封面下载时按序回退 */
  alternateCoverUrls?: string[];
  /** MDCX extrafanart — 详情页剧照区 */
  extrafanartUrls?: string[];
  ms: number;
  error?: string;
};

export type ScrapeContext = {
  code: string;
  kind: KindId;
  metaSources: SourceId[];
  coverSources: SourceId[];
  signal?: AbortSignal;
};

export type ScrapeProvider = {
  id: SourceId;
  scrape(ctx: ScrapeContext): Promise<ProviderResult | null>;
};

export type FieldPriority = Record<string, SourceId[]>;

/** 单源站点覆盖（数据源卡片详情） */
export type ProviderSiteConfig = {
  /** 空=用 catalog.defaultUrl */
  baseUrl: string;
  cookie: string;
  userAgent: string;
  /** 请求冷却秒数；>0 时卡片显示 CD 角标 */
  cooldownSec: number;
  /** 是否覆盖全局重试次数 */
  overrideRetry: boolean;
  /** overrideRetry 为 true 时生效 */
  retry: number;
  /**
   * 代理覆盖：空=跟随全局；字面量 "null"=该源不走代理；其它=该源专用代理 URL
   */
  proxyUrl: string;
};

export type NfoMergeStrategy = "prefer_nfo" | "prefer_scraped";

/** 分区级「使用全局配置」开关；缺省/true = 全局，false = 专属 */
export type KindUseGlobal = {
  download?: boolean;
  naming?: boolean;
  watermark?: boolean;
  metadata?: boolean;
  nfo?: boolean;
  sources?: boolean;
};

export type KindDownloadOverride = {
  downloadPoster?: boolean;
  downloadThumb?: boolean;
  downloadFanart?: boolean;
  preferHighResPoster?: boolean;
  /** 启用 Amazon JP 补充高清海报；与 skipAmazon 互斥（开启则允许 Amazon 图） */
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

export type KindWatermarkOverride = {
  enabled?: boolean;
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  scalePercent?: number;
  style?: string;
  style4k?: string;
  customDir?: string;
  layout?: "stack" | "clockwise" | "counterclockwise";
  startPosition?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
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
  posSubtitle?: "auto" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
  posCracked?: "auto" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
  posLeak?: "auto" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
  posUncensored?: "auto" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
  posCensored?: "auto" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
  posResolution?: "auto" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
};

export type KindMetadataOverride = {
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

export type KindScrapeProfile = {
  metaSources: SourceId[];
  coverSources: SourceId[];
  directoryTemplate: string;
  /** 视频文件名模板，默认 {number} */
  fileNameTemplate: string;
  /** 文件名后缀，如 -{mosaic}；字段空则整段省略 */
  nameSuffixTemplate: string;
  posterCrop: string;
  fieldPriority?: FieldPriority;
  /** 各分类是否沿用全局；缺省 true */
  useGlobal?: KindUseGlobal;
  /** 专属下载覆盖（useGlobal.download===false） */
  download?: KindDownloadOverride;
  /** 专属水印覆盖 */
  watermark?: KindWatermarkOverride;
  /** 专属元数据覆盖 */
  metadata?: KindMetadataOverride;
  /** 专属 NFO 合并策略 */
  nfoMergeStrategy?: NfoMergeStrategy;
};

export type NamingCategoryRule = {
  id: string;
  pattern: string;
  category: string;
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

export type RecognitionWordsByKind = Partial<Record<RecognitionKindKey, string[]>>;

export type RecognitionWordsConfig = {
  /** 番号前缀识别词（命中则覆盖内置 Kind 规则，忽略大小写） */
  code: RecognitionWordsByKind;
  /** 完整路径识别词（含文件名，忽略大小写） */
  path: RecognitionWordsByKind;
};

export type NamingResolutionKey = "720P" | "1080P" | "4K" | "8K";

export type GlobalNamingConfig = {
  directoryTemplate: string;
  mediaTitleTemplate: string;
  fileNameTemplate: string;
  imageNameMode: "none" | "video";
  maxDirectoryLength: number;
  actorDisplayLimit: number;
  nameSuffixTemplate: string;
  videoSuffixTemplate: string;
  posterCrop: string;
  categoryLabels: {
    japan_censored: string;
    japan_uncensored: string;
    japan_amateur: string;
    fc2: string;
    china: string;
    western: string;
    unknown: string;
    japan_gravure?: string;
  };
  categoryRules: NamingCategoryRule[];
  mosaicLabels: {
    cracked: string;
    leak: string;
    uncensored: string;
    censored: string;
  };
  mosaicSuffixLabels: {
    cracked: string;
    leak: string;
    uncensored: string;
    censored: string;
  };
  subtitleLabel: string;
  noSubtitleLabel: string;
  subtitleSuffixLabel: string;
  subtitleAddChsSuffix: boolean;
  partSuffixTemplate: string;
  resolutionFieldTemplate: string;
  resolutionTextMap: string;
  resolutionEnabled: Record<NamingResolutionKey, boolean>;
  resolutionInactiveLabel: string;
  resolutionSuffixTemplate: string;
  resolutionSuffixEnabled: Record<NamingResolutionKey, boolean>;
  resolutionSource: "probe" | "path" | "prefer_probe" | "prefer_path";
  resolutionFallback: boolean;
};

export type ScrapeConfig = {
  enabled: boolean;
  proxyUrl: string;
  flareSolverrUrl: string;
  requestTimeoutSec: number;
  coverDownloadStrategy: "priority" | "size";
  exportFastConcurrency: number;
  exportSlowConcurrency: number;
  fieldPriority: FieldPriority;
  /** 按字段屏蔽 Provider（从有效源链中剔除，仍继承优先级顺序） */
  fieldBlockedSources: FieldPriority;
  /** 全局命名模板（设置·命名）；分区可专属覆盖 */
  naming: GlobalNamingConfig;
  kindProfiles: Record<KindId, KindScrapeProfile>;
  /** 禁用的 Provider id 列表（catalog 中关闭的源） */
  disabledProviders: SourceId[];
  /** 每源站点覆盖（URL / Cookie / UA / 冷却 / 重试 / 代理） */
  providerSettings: Partial<Record<SourceId, ProviderSiteConfig>>;
  /** 全局失败重试次数（每源未覆盖时使用） */
  providerRetryDefault: number;
  /** ThePornDB API Key（Bearer）；空则 theporndb 源返回错误 */
  theporndbApiKey: string;
  /** 重写 NFO 时与本地合并策略（兼容旧字段；与 nfo.mergeStrategy 同步） */
  nfoMergeStrategy: NfoMergeStrategy;
  /** 设置·NFO：字段开关 / 附加标签 / 模板 */
  nfo: NfoConfig;
  /** 下载产物开关（设置·下载） */
  download: {
    downloadPoster: boolean;
    downloadThumb: boolean;
    downloadFanart: boolean;
    /** DMM 封面 ps.jpg → pl.jpg */
    preferHighResPoster: boolean;
    /** 用标题搜 Amazon JP DVD 高清海报 */
    amazonHdPoster: boolean;
    /** 用演员信息搜 Tenhow 高清海报 */
    tenhowHdPoster: boolean;
    /** Amazon 因网络/503 失败时中止任务 */
    amazonStrictMode: boolean;
    /** 过滤封面候选中的 Amazon 图；与 amazonHdPoster 同步为互反 */
    skipAmazon: boolean;
    /** 本地字幕库根目录（相对项目根或绝对路径） */
    subtitleLibraryPath: string;
    /** 已废弃：复制字幕始终保留原后缀，仅重命名为视频基名 */
    subtitleAddChsSuffix: boolean;
    /** 裁剪宽高比：完整海报 2.12/3，Emby 墙 2/3 */
    cropRatio: "full" | "emby";
    /** 对已刮到的海报（含高清）也按比例中心裁 */
    cropIndependentPoster: boolean;
    /** 对比裁剪结果与原海报，像素更多则用裁剪结果 */
    preferCropResult: boolean;
  };
  /** 设置·元数据 */
  metadata: {
    strictMode: boolean;
    requireCover: boolean;
    /** 番号匹配时优先用色花堂中文标题 */
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
  /** OpenAI 兼容 LLM（系统设置 / 元数据翻译） */
  llm: {
    baseUrl: string;
    apiKey: string;
    model: string;
  };
  /** 数据源·自定义识别词（番号前缀 / 路径关键词） */
  recognitionWords: RecognitionWordsConfig;
  /** 设置·水印 */
  watermark: {
    enabled: boolean;
    position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    /** 兼容旧字段；由 heightRatio 同步 */
    scalePercent: number;
    style: string;
    style4k: string;
    customDir: string;
    layout: "stack" | "clockwise" | "counterclockwise";
    startPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    /** 图片高度 / 水印高度 */
    heightRatio: number;
    offsetX: number;
    offsetY: number;
    spacing: number;
    applyPoster: boolean;
    applyThumb: boolean;
    applyFanart: boolean;
    markSubtitle: boolean;
    markCracked: boolean;
    markLeak: boolean;
    markUncensored: boolean;
    markCensored: boolean;
    markResolution: boolean;
    posSubtitle: "auto" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
    posCracked: "auto" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
    posLeak: "auto" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
    posUncensored: "auto" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
    posCensored: "auto" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
    posResolution: "auto" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
  };
};
