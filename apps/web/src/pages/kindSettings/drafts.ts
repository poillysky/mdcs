import type { KindRow } from "../../api";
import { normalizeRelativePath } from "../../lib/paths";
import type { OrganizeConfig, ScrapeConfig } from "../../types";

export type KindDraft = {
  enabled: boolean;
  label: string;
  sourceRoot: string;
  libraryRoot: string;
  useGlobalOrganize: boolean;
  organizeMode: string;
  organizeFallback: string;
  metadataDir: string;
  deleteMetadataOnFail: boolean;
};

export type ProfileDraft = ScrapeConfig["kindProfiles"][string];

export function defaultDownload(cfg: ScrapeConfig): NonNullable<ScrapeConfig["download"]> {
  return {
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
    ...cfg.download,
  };
}

export function defaultWatermark(cfg: ScrapeConfig): NonNullable<ScrapeConfig["watermark"]> {
  return {
    enabled: false,
    position: "top-right",
    scalePercent: 12,
    markSubtitle: true,
    markCracked: true,
    markLeak: true,
    markUncensored: true,
    markCensored: false,
    ...cfg.watermark,
  };
}

export function defaultMetadata(cfg: ScrapeConfig): NonNullable<ScrapeConfig["metadata"]> {
  return {
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
    ...cfg.metadata,
  };
}

export function toKindDraft(k: KindRow, organize: OrganizeConfig | null): KindDraft {
  return {
    enabled: k.enabled,
    label: k.label,
    sourceRoot: normalizeRelativePath(k.sourceRoot || k.sourceAbs || ""),
    libraryRoot: normalizeRelativePath(k.libraryRoot || k.libraryAbs || ""),
    useGlobalOrganize: k.useGlobalOrganize !== false,
    organizeMode: k.organizeMode || organize?.defaultMode || "hardlink",
    organizeFallback: k.organizeFallback || organize?.defaultFallback || "copy",
    metadataDir: k.metadataDir ?? "",
    deleteMetadataOnFail:
      typeof k.deleteMetadataOnFail === "boolean"
        ? k.deleteMetadataOnFail
        : Boolean(organize?.deleteMetadataOnFail),
  };
}

export function ensureProfile(cfg: ScrapeConfig, kindId: string): ProfileDraft {
  const p = cfg.kindProfiles[kindId];
  return {
    metaSources: p?.metaSources ?? [],
    coverSources: p?.coverSources ?? [],
    directoryTemplate: p?.directoryTemplate ?? "{category}/{studio}/{number}",
    fileNameTemplate: p?.fileNameTemplate ?? "{number}",
    nameSuffixTemplate: p?.nameSuffixTemplate ?? "",
    posterCrop: p?.posterCrop ?? "right",
    fieldPriority: p?.fieldPriority,
    useGlobal: {
      download: p?.useGlobal?.download !== false,
      naming: p?.useGlobal?.naming !== false,
      watermark: p?.useGlobal?.watermark !== false,
      metadata: p?.useGlobal?.metadata !== false,
      nfo: p?.useGlobal?.nfo !== false,
      sources: p?.useGlobal?.sources !== false,
    },
    download: { ...defaultDownload(cfg), ...p?.download },
    watermark: { ...defaultWatermark(cfg), ...p?.watermark },
    metadata: { ...defaultMetadata(cfg), ...p?.metadata },
    nfoMergeStrategy: p?.nfoMergeStrategy ?? cfg.nfoMergeStrategy ?? "prefer_scraped",
  };
}
