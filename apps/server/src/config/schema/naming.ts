import type { GlobalNamingConfig, KindScrapeProfile } from "../../scrape/types.js";
import { defaultNamingConfig } from "../../organize/namingConfig.js";
import {
  isObject,
  toBooleanOr,
  toNumberOr,
  toStringOr,
} from "./helpers.js";

export function createDefaultNamingConfig(): GlobalNamingConfig {
  return defaultNamingConfig();
}

export function normalizeNamingConfig(raw: unknown, legacySeed?: KindScrapeProfile): GlobalNamingConfig {
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
