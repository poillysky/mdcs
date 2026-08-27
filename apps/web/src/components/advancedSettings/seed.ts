import type {
  JobDownloadOptions,
  JobMetadataOptions,
  JobNamingOptions,
  JobNfoOptions,
  JobOrganizeOptions,
  JobWatermarkOptions,
} from "../../lib/jobOptions";
import type { OrganizeConfig, ScrapeConfig } from "../../types";

export function seedOrganize(
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
