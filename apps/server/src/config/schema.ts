import {
  KIND_IDS,
  type KindConfig,
  type KindId,
  type LibrariesConfig,
  type OnConflict,
  type OrganizeCleanupConfig,
  type OrganizeConfig,
  type OrganizeFallback,
  type OrganizeMode,
} from "../types.js";
import type {
  FieldPriority,
  GlobalNamingConfig,
  KindDownloadOverride,
  KindMetadataOverride,
  KindScrapeProfile,
  KindUseGlobal,
  KindWatermarkOverride,
  NfoMergeStrategy,
  RecognitionKindKey,
  RecognitionWordsByKind,
  RecognitionWordsConfig,
  ScrapeConfig,
  SourceId,
} from "../scrape/types.js";
import { listCatalogIds, SOURCE_CATALOG } from "../scrape/providers/catalog.js";
import {
  DEFAULT_CRACK_KEYWORDS,
  DEFAULT_JUNK_FILTERS,
  DEFAULT_VIDEO_EXTENSIONS,
  defaultOrganizeConfig,
} from "./organizeDefaults.js";
import { defaultNamingConfig } from "../organize/namingConfig.js";
import {
  defaultWatermarkConfig,
  heightRatioToScalePercent,
  scalePercentToHeightRatio,
  type GlobalWatermarkConfig,
  type WatermarkCorner,
  type WatermarkLayout,
  type WatermarkPos,
} from "../organize/watermarkConfig.js";
import { defaultNfoConfig, normalizeNfoConfig } from "../organize/nfoConfig.js";

const ORGANIZE_MODES = new Set<OrganizeMode>([
  "copy",
  "move",
  "hardlink",
  "softlink",
  "inplace",
]);
const ORGANIZE_FALLBACKS = new Set<OrganizeFallback>(["copy", "fail"]);

const RECOGNITION_KIND_KEYS: RecognitionKindKey[] = [
  "japan_censored",
  "japan_gravure",
  "japan_uncensored",
  "japan_amateur",
  "fc2",
  "china",
  "western",
];

function createDefaultRecognitionWords(): RecognitionWordsConfig {
  return { code: {}, path: {} };
}

function parseRecognitionWordList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function normalizeRecognitionWordsByKind(raw: unknown): RecognitionWordsByKind {
  const out: RecognitionWordsByKind = {};
  if (!isObject(raw)) return out;
  for (const kind of RECOGNITION_KIND_KEYS) {
    const list = parseRecognitionWordList(raw[kind]);
    if (list.length) out[kind] = list;
  }
  return out;
}

function normalizeRecognitionWords(raw: unknown, base: RecognitionWordsConfig): RecognitionWordsConfig {
  if (!isObject(raw)) return base;
  return {
    code: isObject(raw.code) ? normalizeRecognitionWordsByKind(raw.code) : base.code,
    path: isObject(raw.path) ? normalizeRecognitionWordsByKind(raw.path) : base.path,
  };
}
const CONFLICT_OPTIONS = new Set<OnConflict>(["skip", "overwrite", "rename"]);

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toStringOr(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function toBooleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function toNumberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseStringList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  const out = value
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean);
  return out.length ? out : [...fallback];
}

function parseExtList(value: unknown, fallback: string[]): string[] {
  const list = parseStringList(value, fallback);
  return list.map((x) => x.replace(/^\./, "").toLowerCase());
}

function parseSourceList(value: unknown): SourceId[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseDisabledProviders(value: unknown, catalogIds: Set<string>): SourceId[] {
  const ids = parseSourceList(value);
  return ids.filter((id) => catalogIds.has(id));
}

function defaultProviderSiteConfig(): import("../scrape/types.js").ProviderSiteConfig {
  return {
    baseUrl: "",
    cookie: "",
    userAgent: "",
    cooldownSec: 0,
    overrideRetry: false,
    retry: 0,
    proxyUrl: "",
  };
}

function normalizeProviderSiteConfig(
  raw: unknown,
): import("../scrape/types.js").ProviderSiteConfig {
  const base = defaultProviderSiteConfig();
  if (!isObject(raw)) return base;
  return {
    baseUrl: toStringOr(raw.baseUrl, base.baseUrl).trim(),
    cookie: toStringOr(raw.cookie, base.cookie).trim(),
    userAgent: toStringOr(raw.userAgent, base.userAgent).trim(),
    cooldownSec: Math.max(0, Math.floor(toNumberOr(raw.cooldownSec, base.cooldownSec))),
    overrideRetry: toBooleanOr(raw.overrideRetry, base.overrideRetry),
    retry: Math.max(0, Math.floor(toNumberOr(raw.retry, base.retry))),
    proxyUrl: toStringOr(raw.proxyUrl, base.proxyUrl).trim(),
  };
}

function parseProviderSettings(
  value: unknown,
  catalogIds: Set<string>,
): Partial<Record<SourceId, import("../scrape/types.js").ProviderSiteConfig>> {
  if (!isObject(value)) return {};
  const out: Partial<Record<SourceId, import("../scrape/types.js").ProviderSiteConfig>> = {};
  for (const [id, raw] of Object.entries(value)) {
    if (!catalogIds.has(id)) continue;
    const cfg = normalizeProviderSiteConfig(raw);
    const empty =
      !cfg.baseUrl &&
      !cfg.cookie &&
      !cfg.userAgent &&
      cfg.cooldownSec <= 0 &&
      !cfg.overrideRetry &&
      cfg.retry <= 0 &&
      !cfg.proxyUrl;
    if (!empty) out[id] = cfg;
  }
  // 目录默认冷却：用户未配置该源时写入（如 javdb=10s）
  for (const entry of SOURCE_CATALOG) {
    const defCd = entry.defaultCooldownSec ?? 0;
    if (defCd <= 0 || out[entry.id]) continue;
    if (!catalogIds.has(entry.id)) continue;
    out[entry.id] = { ...defaultProviderSiteConfig(), cooldownSec: defCd };
  }
  return out;
}

function parseFieldPriority(value: unknown): FieldPriority {
  if (!isObject(value)) return {};
  const out: FieldPriority = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = parseSourceList(v);
  }
  return out;
}

function parseCleanup(raw: unknown, base: OrganizeCleanupConfig): OrganizeCleanupConfig {
  if (!isObject(raw)) return { ...base, extraWhitelistExt: [...base.extraWhitelistExt] };
  return {
    enabled: toBooleanOr(raw.enabled, base.enabled),
    whitelistProtect: toBooleanOr(raw.whitelistProtect, base.whitelistProtect),
    deleteSmallFiles: toBooleanOr(raw.deleteSmallFiles, base.deleteSmallFiles),
    deleteNonWhitelist: toBooleanOr(raw.deleteNonWhitelist, base.deleteNonWhitelist),
    deleteBlacklist: toBooleanOr(raw.deleteBlacklist, base.deleteBlacklist),
    extraWhitelistExt: parseExtList(raw.extraWhitelistExt, base.extraWhitelistExt),
  };
}

function normalizeOrganize(raw: unknown): OrganizeConfig {
  const base = defaultOrganizeConfig();
  if (!isObject(raw)) return base;
  const overwriteVideoSubtitle = toBooleanOr(raw.overwriteVideoSubtitle, base.overwriteVideoSubtitle);
  // 覆盖开关优先；无显式 onConflict 时与开关对齐
  let onConflict: OnConflict = overwriteVideoSubtitle ? "overwrite" : "skip";
  if (
    raw.overwriteVideoSubtitle === undefined &&
    CONFLICT_OPTIONS.has(raw.onConflict as OnConflict)
  ) {
    onConflict = raw.onConflict as OnConflict;
  }
  return {
    defaultMode: ORGANIZE_MODES.has(raw.defaultMode as OrganizeMode)
      ? (raw.defaultMode as OrganizeMode)
      : base.defaultMode,
    defaultFallback: ORGANIZE_FALLBACKS.has(raw.defaultFallback as OrganizeFallback)
      ? (raw.defaultFallback as OrganizeFallback)
      : base.defaultFallback,
    onConflict,
    metadataDir: toStringOr(raw.metadataDir, base.metadataDir).trim(),
    deleteMetadataOnFail: toBooleanOr(raw.deleteMetadataOnFail, base.deleteMetadataOnFail),
    overwriteVideoSubtitle,
    overwriteImages: toBooleanOr(raw.overwriteImages, base.overwriteImages),
    minFileSizeMb: Math.max(0, toNumberOr(raw.minFileSizeMb, base.minFileSizeMb)),
    videoExtensions: parseExtList(raw.videoExtensions, DEFAULT_VIDEO_EXTENSIONS),
    filenameBlacklist: parseStringList(raw.filenameBlacklist, []),
    junkFilters: parseStringList(raw.junkFilters, DEFAULT_JUNK_FILTERS),
    crackKeywords: parseStringList(raw.crackKeywords, DEFAULT_CRACK_KEYWORDS),
    cleanup: parseCleanup(raw.cleanup, base.cleanup),
  };
}

export function createDefaultLibrariesConfig(): LibrariesConfig {
  return {
    pathRoot: ".",
    indexRoot: "index",
    organize: defaultOrganizeConfig(),
    kinds: Object.fromEntries(
      KIND_IDS.map((id) => [
        id,
        {
          enabled: true,
          label: id,
          sourceRoot: "",
          libraryRoot: "",
        } satisfies KindConfig,
      ]),
    ) as LibrariesConfig["kinds"],
  };
}

function assertLibrariesConfig(config: LibrariesConfig): void {
  if (!ORGANIZE_MODES.has(config.organize.defaultMode)) {
    throw new Error(`配置错误: organize.defaultMode 无效（${config.organize.defaultMode}）`);
  }
  if (!ORGANIZE_FALLBACKS.has(config.organize.defaultFallback)) {
    throw new Error(`配置错误: organize.defaultFallback 无效（${config.organize.defaultFallback}）`);
  }
  if (!CONFLICT_OPTIONS.has(config.organize.onConflict)) {
    throw new Error(`配置错误: organize.onConflict 无效（${config.organize.onConflict}）`);
  }
  for (const kind of KIND_IDS) {
    if (!config.kinds[kind]) {
      throw new Error(`配置错误: 缺少分区配置 ${kind}`);
    }
  }
}

export function normalizeLibrariesConfig(raw: unknown): LibrariesConfig {
  const base = createDefaultLibrariesConfig();
  if (!isObject(raw)) {
    assertLibrariesConfig(base);
    return base;
  }
  const kindsRaw = isObject(raw.kinds) ? raw.kinds : {};

  const config: LibrariesConfig = {
    pathRoot: toStringOr(raw.pathRoot, base.pathRoot),
    indexRoot: toStringOr(raw.indexRoot, base.indexRoot || "index"),
    organize: normalizeOrganize(raw.organize),
    server: isObject(raw.server)
      ? {
          host: typeof raw.server.host === "string" ? raw.server.host : undefined,
          port: typeof raw.server.port === "number" ? raw.server.port : undefined,
        }
      : undefined,
    web: isObject(raw.web)
      ? {
          port: typeof raw.web.port === "number" ? raw.web.port : undefined,
          apiOrigin: typeof raw.web.apiOrigin === "string" ? raw.web.apiOrigin : undefined,
        }
      : undefined,
    kinds: {} as Record<KindId, KindConfig>,
  };

  for (const id of KIND_IDS) {
    const curr = isObject(kindsRaw[id]) ? kindsRaw[id] : {};
    const prev = base.kinds[id];
    const organizeMode = ORGANIZE_MODES.has(curr.organizeMode as OrganizeMode)
      ? (curr.organizeMode as OrganizeMode)
      : undefined;
    const organizeFallback = ORGANIZE_FALLBACKS.has(curr.organizeFallback as OrganizeFallback)
      ? (curr.organizeFallback as OrganizeFallback)
      : undefined;
    const useGlobalOrganize =
      typeof curr.useGlobalOrganize === "boolean" ? curr.useGlobalOrganize : undefined;
    const metadataDir =
      typeof curr.metadataDir === "string" ? curr.metadataDir.trim() : undefined;
    const deleteMetadataOnFail =
      typeof curr.deleteMetadataOnFail === "boolean" ? curr.deleteMetadataOnFail : undefined;
    config.kinds[id] = {
      enabled: toBooleanOr(curr.enabled, prev.enabled),
      label: toStringOr(curr.label, prev.label),
      sourceRoot: toStringOr(curr.sourceRoot, prev.sourceRoot),
      libraryRoot: toStringOr(curr.libraryRoot, prev.libraryRoot),
      ...(useGlobalOrganize === false ? { useGlobalOrganize: false } : {}),
      ...(organizeMode ? { organizeMode } : {}),
      ...(organizeFallback ? { organizeFallback } : {}),
      ...(metadataDir !== undefined ? { metadataDir } : {}),
      ...(deleteMetadataOnFail !== undefined ? { deleteMetadataOnFail } : {}),
    };
  }

  assertLibrariesConfig(config);
  return config;
}

export function createDefaultKindScrapeProfile(): KindScrapeProfile {
  return {
    metaSources: ["javbus", "jav321"],
    coverSources: ["javbus", "jav321"],
    directoryTemplate: "{category}/{studio}/{series_name}/{number}",
    fileNameTemplate: "{number}",
    nameSuffixTemplate: "",
    posterCrop: "right",
  };
}

export function createDefaultNamingConfig(): GlobalNamingConfig {
  return defaultNamingConfig();
}

function normalizeNamingConfig(raw: unknown, legacySeed?: KindScrapeProfile): GlobalNamingConfig {
  const base = createDefaultNamingConfig();
  const namingRaw = isObject(raw) ? raw : {};
  const resEnabled = isObject(namingRaw.resolutionEnabled)
    ? {
        "720P": toBooleanOr(namingRaw.resolutionEnabled["720P"], base.resolutionEnabled["720P"]),
        "1080P": toBooleanOr(namingRaw.resolutionEnabled["1080P"], base.resolutionEnabled["1080P"]),
        "4K": toBooleanOr(namingRaw.resolutionEnabled["4K"], base.resolutionEnabled["4K"]),
        "8K": toBooleanOr(namingRaw.resolutionEnabled["8K"], base.resolutionEnabled["8K"]),
      }
    : base.resolutionEnabled;
  const resSuffixEnabled = isObject(namingRaw.resolutionSuffixEnabled)
    ? {
        "720P": toBooleanOr(
          namingRaw.resolutionSuffixEnabled["720P"],
          base.resolutionSuffixEnabled["720P"],
        ),
        "1080P": toBooleanOr(
          namingRaw.resolutionSuffixEnabled["1080P"],
          base.resolutionSuffixEnabled["1080P"],
        ),
        "4K": toBooleanOr(
          namingRaw.resolutionSuffixEnabled["4K"],
          base.resolutionSuffixEnabled["4K"],
        ),
        "8K": toBooleanOr(
          namingRaw.resolutionSuffixEnabled["8K"],
          base.resolutionSuffixEnabled["8K"],
        ),
      }
    : base.resolutionSuffixEnabled;
  const catLabels = isObject(namingRaw.categoryLabels) ? namingRaw.categoryLabels : {};
  const mosaicLabels = isObject(namingRaw.mosaicLabels) ? namingRaw.mosaicLabels : {};
  const mosaicSuffixLabels = isObject(namingRaw.mosaicSuffixLabels)
    ? namingRaw.mosaicSuffixLabels
    : {};
  const categoryRules = Array.isArray(namingRaw.categoryRules)
    ? namingRaw.categoryRules
        .filter((r): r is Record<string, unknown> => isObject(r))
        .map((r, i) => ({
          id: toStringOr(r.id, `rule_${i}`),
          pattern: toStringOr(r.pattern, ""),
          category: toStringOr(r.category, ""),
        }))
        .filter((r) => r.pattern || r.category)
    : base.categoryRules;
  const imageMode =
    namingRaw.imageNameMode === "video" || namingRaw.imageNameMode === "none"
      ? namingRaw.imageNameMode
      : namingRaw.imageNameMode === "number"
        ? "video" // 旧「番号前缀」并入视频前缀语义，避免丢配置
        : base.imageNameMode;
  const resSource =
    namingRaw.resolutionSource === "probe" ||
    namingRaw.resolutionSource === "path" ||
    namingRaw.resolutionSource === "prefer_probe" ||
    namingRaw.resolutionSource === "prefer_path"
      ? namingRaw.resolutionSource
      : base.resolutionSource;
  const posterCrop = (() => {
    const mode = namingRaw.posterCrop ?? legacySeed?.posterCrop;
    return mode === "right" || mode === "none" || mode === "face" || typeof mode === "string"
      ? String(mode || base.posterCrop)
      : base.posterCrop;
  })();

  return {
    directoryTemplate: toStringOr(
      namingRaw.directoryTemplate,
      legacySeed?.directoryTemplate || base.directoryTemplate,
    ),
    mediaTitleTemplate: toStringOr(namingRaw.mediaTitleTemplate, base.mediaTitleTemplate),
    fileNameTemplate: toStringOr(
      namingRaw.fileNameTemplate,
      legacySeed?.fileNameTemplate || base.fileNameTemplate,
    ),
    imageNameMode: imageMode,
    maxDirectoryLength: Math.max(0, toNumberOr(namingRaw.maxDirectoryLength, base.maxDirectoryLength)),
    actorDisplayLimit: Math.max(0, toNumberOr(namingRaw.actorDisplayLimit, base.actorDisplayLimit)),
    nameSuffixTemplate: toStringOr(
      namingRaw.nameSuffixTemplate,
      legacySeed?.nameSuffixTemplate ?? base.nameSuffixTemplate,
    ),
    videoSuffixTemplate: toStringOr(namingRaw.videoSuffixTemplate, base.videoSuffixTemplate),
    posterCrop,
    categoryLabels: {
      japan_censored: toStringOr(catLabels.japan_censored, base.categoryLabels.japan_censored),
      japan_gravure: toStringOr(catLabels.japan_gravure, base.categoryLabels.japan_gravure || "日本写真"),
      japan_uncensored: toStringOr(catLabels.japan_uncensored, base.categoryLabels.japan_uncensored),
      japan_amateur: toStringOr(catLabels.japan_amateur, base.categoryLabels.japan_amateur),
      fc2: toStringOr(catLabels.fc2, base.categoryLabels.fc2),
      china: toStringOr(catLabels.china, base.categoryLabels.china),
      western: toStringOr(catLabels.western, base.categoryLabels.western),
      unknown: toStringOr(catLabels.unknown, base.categoryLabels.unknown),
    },
    categoryRules,
    mosaicLabels: {
      cracked: toStringOr(mosaicLabels.cracked, base.mosaicLabels.cracked),
      leak: toStringOr(mosaicLabels.leak, base.mosaicLabels.leak),
      uncensored: toStringOr(mosaicLabels.uncensored, base.mosaicLabels.uncensored),
      censored: toStringOr(mosaicLabels.censored, base.mosaicLabels.censored),
    },
    mosaicSuffixLabels: {
      cracked: toStringOr(mosaicSuffixLabels.cracked, base.mosaicSuffixLabels.cracked),
      leak: toStringOr(mosaicSuffixLabels.leak, base.mosaicSuffixLabels.leak),
      uncensored: toStringOr(mosaicSuffixLabels.uncensored, base.mosaicSuffixLabels.uncensored),
      censored: toStringOr(mosaicSuffixLabels.censored, base.mosaicSuffixLabels.censored),
    },
    subtitleLabel: toStringOr(namingRaw.subtitleLabel, base.subtitleLabel),
    noSubtitleLabel: toStringOr(namingRaw.noSubtitleLabel, base.noSubtitleLabel),
    subtitleSuffixLabel: toStringOr(namingRaw.subtitleSuffixLabel, base.subtitleSuffixLabel),
    subtitleAddChsSuffix: toBooleanOr(namingRaw.subtitleAddChsSuffix, base.subtitleAddChsSuffix),
    partSuffixTemplate: toStringOr(namingRaw.partSuffixTemplate, base.partSuffixTemplate),
    resolutionFieldTemplate: toStringOr(
      namingRaw.resolutionFieldTemplate,
      base.resolutionFieldTemplate,
    ),
    resolutionTextMap: toStringOr(namingRaw.resolutionTextMap, base.resolutionTextMap),
    resolutionEnabled: resEnabled,
    resolutionInactiveLabel: toStringOr(
      namingRaw.resolutionInactiveLabel,
      base.resolutionInactiveLabel,
    ),
    resolutionSuffixTemplate: toStringOr(
      namingRaw.resolutionSuffixTemplate,
      base.resolutionSuffixTemplate,
    ),
    resolutionSuffixEnabled: resSuffixEnabled,
    resolutionSource: resSource,
    resolutionFallback: toBooleanOr(namingRaw.resolutionFallback, base.resolutionFallback),
  };
}

function kindProfileWith(
  base: KindScrapeProfile,
  patch: Partial<KindScrapeProfile>,
): KindScrapeProfile {
  return { ...base, ...patch };
}

export function createDefaultScrapeConfig(): ScrapeConfig {
  const baseProfile = createDefaultKindScrapeProfile();
  const avMeta = ["javbus", "jav321", "libredmm", "freejavbt", "airav_io", "iqqtv", "avsex", "sevenmmtv"];
  const avCover = ["javbus", "jav321", "libredmm", "avsex"];
  const kindProfiles = {
    japan_censored: kindProfileWith(baseProfile, {
      metaSources: avMeta,
      coverSources: avCover,
      posterCrop: "right",
    }),
    japan_gravure: kindProfileWith(baseProfile, {
      metaSources: avMeta,
      coverSources: avCover,
      posterCrop: "right",
    }),
    japan_uncensored: kindProfileWith(baseProfile, {
      metaSources: ["carib", "javbus", "jav321", "freejavbt", "iqqtv", "avsex", "sevenmmtv", "airav_io"],
      coverSources: ["carib", "javbus", "jav321", "avsex"],
      posterCrop: "none",
    }),
    japan_amateur: kindProfileWith(baseProfile, {
      metaSources: avMeta,
      coverSources: ["javbus", "jav321", "libredmm"],
      posterCrop: "face",
    }),
    fc2: kindProfileWith(baseProfile, {
      metaSources: ["fc2", "fd2ppv", "javdb"],
      coverSources: ["fc2", "fc2_hub", "fd2ppv", "javbus"],
      posterCrop: "face",
    }),
    china: kindProfileWith(baseProfile, {
      metaSources: ["madouqu", "madou", "xiao_huang_shu"],
      coverSources: ["madouqu", "madou", "javbus"],
      posterCrop: "none",
    }),
    western: kindProfileWith(baseProfile, {
      metaSources: ["airav_io", "javdb", "miss_av"],
      coverSources: ["javbus", "airav_io", "javdb"],
      posterCrop: "none",
    }),
  } as ScrapeConfig["kindProfiles"];

  return {
    enabled: true,
    proxyUrl: "",
    flareSolverrUrl: "",
    requestTimeoutSec: 30,
    coverDownloadStrategy: "priority",
    exportFastConcurrency: 4,
    exportSlowConcurrency: 2,
    fieldPriority: {
      cover: ["javbus", "jav321", "libredmm"],
      titleZh: ["avsex", "iqqtv", "airav_io", "sevenmmtv"],
      outline: ["avsex", "iqqtv", "airav_io", "jav321"],
      plot: ["avsex", "iqqtv", "airav_io", "jav321"],
      originalPlot: ["dmm", "iqqtv", "jav321", "libredmm", "airav_io"],
      studio: ["javbus", "jav321", "libredmm"],
      actors: ["javbus", "jav321", "libredmm"],
      tags: ["javbus", "freejavbt", "airav_io"],
      series: ["javbus", "freejavbt", "jav321"],
    },
    fieldBlockedSources: {},
    naming: createDefaultNamingConfig(),
    kindProfiles,
    disabledProviders: [],
    providerSettings: {
      javdb: {
        baseUrl: "",
        cookie: "",
        userAgent: "",
        cooldownSec: 10,
        overrideRetry: false,
        retry: 0,
        proxyUrl: "",
      },
    },
    providerRetryDefault: 0,
    theporndbApiKey: "",
    nfoMergeStrategy: "prefer_scraped",
    nfo: defaultNfoConfig(),
    download: {
      downloadPoster: true,
      downloadThumb: true,
      downloadFanart: false,
      preferHighResPoster: true,
      amazonHdPoster: false,
      tenhowHdPoster: false,
      amazonStrictMode: false,
      skipAmazon: true,
      subtitleLibraryPath: "",
      subtitleAddChsSuffix: false,
      cropRatio: "full",
      cropIndependentPoster: false,
      preferCropResult: true,
    },
    metadata: {
      strictMode: false,
      requireCover: false,
      useForumZhTitle: true,
      enableActorMapping: true,
      enableTagMapping: true,
      trimPlot: true,
      mappingLanguage: "zh-CN",
      autoTranslateTitle: false,
      autoTranslateOutline: false,
      translateEngine: "openai",
      customSystemPrompt: "",
    },
    llm: {
      baseUrl: "",
      apiKey: "",
      model: "gpt-4o-mini",
    },
    recognitionWords: createDefaultRecognitionWords(),
    watermark: defaultWatermarkConfig(),
  };
}

function normalizeUseGlobal(raw: unknown): KindUseGlobal | undefined {
  if (!isObject(raw)) return undefined;
  const out: KindUseGlobal = {};
  for (const key of ["download", "naming", "watermark", "metadata", "nfo", "sources"] as const) {
    if (typeof raw[key] === "boolean") out[key] = raw[key];
  }
  return Object.keys(out).length ? out : undefined;
}

function normalizeDownloadOverride(raw: unknown): KindDownloadOverride | undefined {
  if (!isObject(raw)) return undefined;
  const out: KindDownloadOverride = {};
  if (typeof raw.downloadPoster === "boolean") out.downloadPoster = raw.downloadPoster;
  if (typeof raw.downloadThumb === "boolean") out.downloadThumb = raw.downloadThumb;
  if (typeof raw.downloadFanart === "boolean") out.downloadFanart = raw.downloadFanart;
  if (typeof raw.preferHighResPoster === "boolean") out.preferHighResPoster = raw.preferHighResPoster;
  if (typeof raw.amazonHdPoster === "boolean") out.amazonHdPoster = raw.amazonHdPoster;
  if (typeof raw.tenhowHdPoster === "boolean") out.tenhowHdPoster = raw.tenhowHdPoster;
  if (typeof raw.amazonStrictMode === "boolean") out.amazonStrictMode = raw.amazonStrictMode;
  if (typeof raw.skipAmazon === "boolean") out.skipAmazon = raw.skipAmazon;
  if (typeof raw.subtitleLibraryPath === "string") out.subtitleLibraryPath = raw.subtitleLibraryPath;
  if (typeof raw.subtitleAddChsSuffix === "boolean") out.subtitleAddChsSuffix = raw.subtitleAddChsSuffix;
  if (raw.cropRatio === "emby" || raw.cropRatio === "full") out.cropRatio = raw.cropRatio;
  if (typeof raw.cropIndependentPoster === "boolean") {
    out.cropIndependentPoster = raw.cropIndependentPoster;
  }
  if (typeof raw.preferCropResult === "boolean") out.preferCropResult = raw.preferCropResult;
  // Amazon 高清开启 ↔ 允许 Amazon 图
  if (typeof out.amazonHdPoster === "boolean") out.skipAmazon = !out.amazonHdPoster;
  else if (typeof out.skipAmazon === "boolean") out.amazonHdPoster = !out.skipAmazon;
  return Object.keys(out).length ? out : undefined;
}

function normalizeWatermarkOverride(raw: unknown): KindWatermarkOverride | undefined {
  if (!isObject(raw)) return undefined;
  const out: KindWatermarkOverride = {};
  if (typeof raw.enabled === "boolean") out.enabled = raw.enabled;
  const pos = raw.position;
  if (
    pos === "top-left" ||
    pos === "top-right" ||
    pos === "bottom-left" ||
    pos === "bottom-right"
  ) {
    out.position = pos;
  }
  if (typeof raw.scalePercent === "number" && Number.isFinite(raw.scalePercent)) {
    out.scalePercent = Math.max(4, Math.min(40, Math.floor(raw.scalePercent)));
  }
  if (typeof raw.style === "string") out.style = raw.style;
  if (typeof raw.style4k === "string") out.style4k = raw.style4k;
  if (typeof raw.customDir === "string") out.customDir = raw.customDir;
  if (
    raw.layout === "stack" ||
    raw.layout === "clockwise" ||
    raw.layout === "counterclockwise"
  ) {
    out.layout = raw.layout;
  }
  const start = raw.startPosition;
  if (
    start === "top-left" ||
    start === "top-right" ||
    start === "bottom-left" ||
    start === "bottom-right"
  ) {
    out.startPosition = start;
  }
  if (typeof raw.heightRatio === "number" && Number.isFinite(raw.heightRatio)) {
    out.heightRatio = Math.max(2, Math.min(40, raw.heightRatio));
  }
  for (const key of ["offsetX", "offsetY", "spacing"] as const) {
    if (typeof raw[key] === "number" && Number.isFinite(raw[key])) out[key] = raw[key];
  }
  for (const key of ["applyPoster", "applyThumb", "applyFanart"] as const) {
    if (typeof raw[key] === "boolean") out[key] = raw[key];
  }
  if (typeof raw.markSubtitle === "boolean") out.markSubtitle = raw.markSubtitle;
  if (typeof raw.markCracked === "boolean") out.markCracked = raw.markCracked;
  if (typeof raw.markLeak === "boolean") out.markLeak = raw.markLeak;
  if (typeof raw.markUncensored === "boolean") out.markUncensored = raw.markUncensored;
  if (typeof raw.markCensored === "boolean") out.markCensored = raw.markCensored;
  if (typeof raw.markResolution === "boolean") out.markResolution = raw.markResolution;
  for (const key of [
    "posSubtitle",
    "posCracked",
    "posLeak",
    "posUncensored",
    "posCensored",
    "posResolution",
  ] as const) {
    const v = raw[key];
    if (
      v === "auto" ||
      v === "top-left" ||
      v === "top-right" ||
      v === "bottom-left" ||
      v === "bottom-right"
    ) {
      out[key] = v;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

function normalizeMetadataOverride(raw: unknown): KindMetadataOverride | undefined {
  if (!isObject(raw)) return undefined;
  const out: KindMetadataOverride = {};
  if (typeof raw.strictMode === "boolean") out.strictMode = raw.strictMode;
  if (typeof raw.requireCover === "boolean") out.requireCover = raw.requireCover;
  if (typeof raw.trimPlot === "boolean") out.trimPlot = raw.trimPlot;
  if (typeof raw.autoTranslateTitle === "boolean") out.autoTranslateTitle = raw.autoTranslateTitle;
  if (typeof raw.autoTranslateOutline === "boolean") {
    out.autoTranslateOutline = raw.autoTranslateOutline;
  }
  if (typeof raw.useForumZhTitle === "boolean") out.useForumZhTitle = raw.useForumZhTitle;
  if (typeof raw.enableActorMapping === "boolean") out.enableActorMapping = raw.enableActorMapping;
  if (typeof raw.enableTagMapping === "boolean") out.enableTagMapping = raw.enableTagMapping;
  if (
    raw.mappingLanguage === "zh-CN" ||
    raw.mappingLanguage === "zh-TW" ||
    raw.mappingLanguage === "ja" ||
    raw.mappingLanguage === "en"
  ) {
    out.mappingLanguage = raw.mappingLanguage;
  }
  if (raw.translateEngine === "openai") out.translateEngine = "openai";
  if (typeof raw.customSystemPrompt === "string") out.customSystemPrompt = raw.customSystemPrompt;
  return Object.keys(out).length ? out : undefined;
}

function normalizeKindProfile(raw: unknown): KindScrapeProfile {
  const base = createDefaultKindScrapeProfile();
  if (!isObject(raw)) return base;
  const mode = raw.posterCrop;
  const posterCrop =
    mode === "right" || mode === "none" || mode === "face"
      ? mode
      : typeof mode === "string"
        ? mode
        : base.posterCrop;
  const metaSources = parseSourceList(raw.metaSources);
  const coverSources = parseSourceList(raw.coverSources);
  const useGlobal = normalizeUseGlobal(raw.useGlobal);
  const download = normalizeDownloadOverride(raw.download);
  const watermark = normalizeWatermarkOverride(raw.watermark);
  const metadata = normalizeMetadataOverride(raw.metadata);
  const nfoMerge: NfoMergeStrategy | undefined =
    raw.nfoMergeStrategy === "prefer_nfo" || raw.nfoMergeStrategy === "prefer_scraped"
      ? raw.nfoMergeStrategy
      : undefined;
  return {
    metaSources: metaSources.length ? metaSources : base.metaSources,
    coverSources: coverSources.length ? coverSources : base.coverSources,
    directoryTemplate: toStringOr(raw.directoryTemplate, base.directoryTemplate),
    fileNameTemplate: toStringOr(raw.fileNameTemplate, base.fileNameTemplate),
    nameSuffixTemplate: toStringOr(raw.nameSuffixTemplate, base.nameSuffixTemplate),
    posterCrop,
    fieldPriority: isObject(raw.fieldPriority) ? parseFieldPriority(raw.fieldPriority) : undefined,
    ...(useGlobal ? { useGlobal } : {}),
    ...(download ? { download } : {}),
    ...(watermark ? { watermark } : {}),
    ...(metadata ? { metadata } : {}),
    ...(nfoMerge ? { nfoMergeStrategy: nfoMerge } : {}),
  };
}

function assertScrapeConfig(config: ScrapeConfig): void {
  if (config.coverDownloadStrategy !== "priority" && config.coverDownloadStrategy !== "size") {
    throw new Error(`配置错误: coverDownloadStrategy 无效（${config.coverDownloadStrategy}）`);
  }
  if (config.exportFastConcurrency < 1 || config.exportSlowConcurrency < 1) {
    throw new Error("配置错误: exportFastConcurrency/exportSlowConcurrency 必须大于 0");
  }
  for (const kind of KIND_IDS) {
    if (!config.kindProfiles[kind]) {
      throw new Error(`配置错误: 缺少 kindProfiles.${kind}`);
    }
  }
}

export function normalizeScrapeConfig(raw: unknown): ScrapeConfig {
  const base = createDefaultScrapeConfig();
  if (!isObject(raw)) {
    assertScrapeConfig(base);
    return base;
  }
  const catalogIds = new Set(listCatalogIds());
  const kindProfiles = {} as ScrapeConfig["kindProfiles"];
  const rawKindProfiles = isObject(raw.kindProfiles) ? raw.kindProfiles : {};
  for (const kind of KIND_IDS) {
    kindProfiles[kind] = normalizeKindProfile(
      rawKindProfiles[kind] ?? base.kindProfiles[kind],
    );
  }

  const downloadRaw = isObject(raw.download) ? raw.download : {};
  const metadataRaw = isObject(raw.metadata) ? raw.metadata : {};
  const watermarkRaw = isObject(raw.watermark) ? raw.watermark : {};
  const namingRaw = isObject(raw.naming) ? raw.naming : {};
  // 旧配置无 naming 块时，用 japan_censored 模板作全局种子，避免升级丢规则
  const naming = normalizeNamingConfig(namingRaw, kindProfiles.japan_censored);
  const watermark = normalizeWatermarkConfig(watermarkRaw, base.watermark);

  const nfoMerge =
    raw.nfoMergeStrategy === "prefer_nfo" || raw.nfoMergeStrategy === "prefer_scraped"
      ? raw.nfoMergeStrategy
      : base.nfoMergeStrategy;
  const nfo = normalizeNfoConfig(raw.nfo, nfoMerge);
  // 顶层 nfoMergeStrategy 与 nfo.mergeStrategy 双向对齐（旧客户端只写其一）
  const mergeSynced = nfo.mergeStrategy;

  const config: ScrapeConfig = {
    enabled: toBooleanOr(raw.enabled, base.enabled),
    proxyUrl: toStringOr(raw.proxyUrl, base.proxyUrl),
    flareSolverrUrl: toStringOr(raw.flareSolverrUrl, base.flareSolverrUrl),
    requestTimeoutSec: Math.max(5, Math.floor(toNumberOr(raw.requestTimeoutSec, base.requestTimeoutSec))),
    coverDownloadStrategy:
      raw.coverDownloadStrategy === "priority" || raw.coverDownloadStrategy === "size"
        ? raw.coverDownloadStrategy
        : base.coverDownloadStrategy,
    exportFastConcurrency: Math.max(
      1,
      Math.floor(toNumberOr(raw.exportFastConcurrency, base.exportFastConcurrency)),
    ),
    exportSlowConcurrency: Math.max(
      1,
      Math.floor(toNumberOr(raw.exportSlowConcurrency, base.exportSlowConcurrency)),
    ),
    fieldPriority: isObject(raw.fieldPriority)
      ? parseFieldPriority(raw.fieldPriority)
      : base.fieldPriority,
    fieldBlockedSources: isObject(raw.fieldBlockedSources)
      ? parseFieldPriority(raw.fieldBlockedSources)
      : base.fieldBlockedSources,
    naming,
    kindProfiles,
    disabledProviders: parseDisabledProviders(raw.disabledProviders, catalogIds),
    providerSettings: parseProviderSettings(raw.providerSettings, catalogIds),
    providerRetryDefault: Math.max(
      0,
      Math.floor(toNumberOr(raw.providerRetryDefault, base.providerRetryDefault)),
    ),
    theporndbApiKey: toStringOr(raw.theporndbApiKey, base.theporndbApiKey),
    nfoMergeStrategy: mergeSynced,
    nfo,
    download: (() => {
      const preferHighResPoster = toBooleanOr(
        downloadRaw.preferHighResPoster,
        base.download.preferHighResPoster,
      );
      const tenhowHdPoster = toBooleanOr(
        downloadRaw.tenhowHdPoster,
        base.download.tenhowHdPoster,
      );
      const amazonStrictMode = toBooleanOr(
        downloadRaw.amazonStrictMode,
        base.download.amazonStrictMode,
      );
      // 新字段优先；旧配置仅有 skipAmazon 时反推 amazonHdPoster
      let amazonHdPoster: boolean;
      let skipAmazon: boolean;
      if (typeof downloadRaw.amazonHdPoster === "boolean") {
        amazonHdPoster = downloadRaw.amazonHdPoster;
        skipAmazon = !amazonHdPoster;
      } else if (typeof downloadRaw.skipAmazon === "boolean") {
        skipAmazon = downloadRaw.skipAmazon;
        amazonHdPoster = !skipAmazon;
      } else {
        amazonHdPoster = base.download.amazonHdPoster;
        skipAmazon = base.download.skipAmazon;
      }
      return {
        downloadPoster: toBooleanOr(downloadRaw.downloadPoster, base.download.downloadPoster),
        downloadThumb: toBooleanOr(downloadRaw.downloadThumb, base.download.downloadThumb),
        downloadFanart: toBooleanOr(downloadRaw.downloadFanart, base.download.downloadFanart),
        preferHighResPoster,
        amazonHdPoster,
        tenhowHdPoster,
        amazonStrictMode,
        skipAmazon,
        subtitleLibraryPath: toStringOr(
          downloadRaw.subtitleLibraryPath,
          base.download.subtitleLibraryPath,
        ),
        subtitleAddChsSuffix: toBooleanOr(
          downloadRaw.subtitleAddChsSuffix,
          base.download.subtitleAddChsSuffix,
        ),
        cropRatio: downloadRaw.cropRatio === "emby" ? "emby" : "full",
        cropIndependentPoster: toBooleanOr(
          downloadRaw.cropIndependentPoster,
          base.download.cropIndependentPoster,
        ),
        preferCropResult: toBooleanOr(
          downloadRaw.preferCropResult,
          base.download.preferCropResult,
        ),
      };
    })(),
    metadata: (() => {
      const langRaw = metadataRaw.mappingLanguage;
      const mappingLanguage =
        langRaw === "zh-TW" || langRaw === "ja" || langRaw === "en" ? langRaw : "zh-CN";
      return {
        strictMode: toBooleanOr(metadataRaw.strictMode, base.metadata.strictMode),
        requireCover: toBooleanOr(metadataRaw.requireCover, base.metadata.requireCover),
        useForumZhTitle: toBooleanOr(
          metadataRaw.useForumZhTitle,
          base.metadata.useForumZhTitle,
        ),
        enableActorMapping: toBooleanOr(
          metadataRaw.enableActorMapping,
          base.metadata.enableActorMapping,
        ),
        enableTagMapping: toBooleanOr(
          metadataRaw.enableTagMapping,
          base.metadata.enableTagMapping,
        ),
        trimPlot: toBooleanOr(metadataRaw.trimPlot, base.metadata.trimPlot),
        mappingLanguage,
        autoTranslateTitle: toBooleanOr(
          metadataRaw.autoTranslateTitle,
          base.metadata.autoTranslateTitle,
        ),
        autoTranslateOutline: toBooleanOr(
          metadataRaw.autoTranslateOutline,
          base.metadata.autoTranslateOutline,
        ),
        translateEngine: "openai" as const,
        customSystemPrompt: toStringOr(
          metadataRaw.customSystemPrompt,
          base.metadata.customSystemPrompt,
        ),
      };
    })(),
    llm: (() => {
      const llmRaw = isObject(raw.llm) ? raw.llm : {};
      return {
        baseUrl: toStringOr(llmRaw.baseUrl, base.llm.baseUrl),
        apiKey: toStringOr(llmRaw.apiKey, base.llm.apiKey),
        model: toStringOr(llmRaw.model, base.llm.model) || "gpt-4o-mini",
      };
    })(),
    recognitionWords: normalizeRecognitionWords(raw.recognitionWords, base.recognitionWords),
    watermark,
  };
  assertScrapeConfig(config);
  return config;
}

function parseCorner(v: unknown, fallback: WatermarkCorner): WatermarkCorner {
  if (v === "top-left" || v === "top-right" || v === "bottom-left" || v === "bottom-right") {
    return v;
  }
  return fallback;
}

function parsePos(v: unknown, fallback: WatermarkPos): WatermarkPos {
  if (v === "auto") return "auto";
  if (v === "top-left" || v === "top-right" || v === "bottom-left" || v === "bottom-right") {
    return v;
  }
  return fallback;
}

function parseLayout(v: unknown, fallback: WatermarkLayout): WatermarkLayout {
  if (v === "stack" || v === "clockwise" || v === "counterclockwise") return v;
  return fallback;
}

function normalizeWatermarkConfig(
  raw: Record<string, unknown>,
  base: GlobalWatermarkConfig,
): GlobalWatermarkConfig {
  const startPosition = parseCorner(
    raw.startPosition ?? raw.position,
    base.startPosition || base.position,
  );
  const position = parseCorner(raw.position, startPosition);

  let heightRatio: number;
  if (typeof raw.heightRatio === "number" && Number.isFinite(raw.heightRatio)) {
    heightRatio = Math.max(2, Math.min(40, Math.floor(raw.heightRatio)));
  } else if (typeof raw.scalePercent === "number" && Number.isFinite(raw.scalePercent)) {
    heightRatio = scalePercentToHeightRatio(raw.scalePercent);
  } else {
    heightRatio = base.heightRatio;
  }
  const scalePercent =
    typeof raw.scalePercent === "number" && Number.isFinite(raw.scalePercent)
      ? Math.max(1, Math.min(40, Math.floor(raw.scalePercent)))
      : heightRatioToScalePercent(heightRatio);

  return {
    enabled: toBooleanOr(raw.enabled, base.enabled),
    position,
    scalePercent,
    style: toStringOr(raw.style, base.style) || "default",
    style4k: toStringOr(raw.style4k, base.style4k) || "default",
    customDir: toStringOr(raw.customDir, base.customDir),
    layout: parseLayout(raw.layout, base.layout),
    startPosition,
    heightRatio,
    offsetX: Math.max(0, Math.floor(toNumberOr(raw.offsetX, base.offsetX))),
    offsetY: Math.max(0, Math.floor(toNumberOr(raw.offsetY, base.offsetY))),
    spacing: Math.max(0, Math.floor(toNumberOr(raw.spacing, base.spacing))),
    applyPoster: toBooleanOr(raw.applyPoster, base.applyPoster),
    applyThumb: toBooleanOr(raw.applyThumb, base.applyThumb),
    applyFanart: toBooleanOr(raw.applyFanart, base.applyFanart),
    markSubtitle: toBooleanOr(raw.markSubtitle, base.markSubtitle),
    markCracked: toBooleanOr(raw.markCracked, base.markCracked),
    markLeak: toBooleanOr(raw.markLeak, base.markLeak),
    markUncensored: toBooleanOr(raw.markUncensored, base.markUncensored),
    markCensored: toBooleanOr(raw.markCensored, base.markCensored),
    markResolution: toBooleanOr(raw.markResolution, base.markResolution),
    posSubtitle: parsePos(raw.posSubtitle, base.posSubtitle),
    posCracked: parsePos(raw.posCracked, base.posCracked),
    posLeak: parsePos(raw.posLeak, base.posLeak),
    posUncensored: parsePos(raw.posUncensored, base.posUncensored),
    posCensored: parsePos(raw.posCensored, base.posCensored),
    posResolution: parsePos(raw.posResolution, base.posResolution),
  };
}
