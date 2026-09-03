import type { OrganizeConfig } from "../types.js";

export const DEFAULT_VIDEO_EXTENSIONS = [
  "mp4",
  "avi",
  "rmvb",
  "wmv",
  "mov",
  "mkv",
  "webm",
  "iso",
  "mpg",
  "m4v",
  "ts",
  "flv",
  "strm",
  "vob",
  "m2ts",
];

export const DEFAULT_JUNK_FILTERS = [
  "2048论坛@fun2048.com",
  "1080p",
  "720p",
  "22-sht.me",
  "-HD",
  "bbs2048.org@",
  "hhd800.com@",
  "icao.me@",
  "hhb_000",
  "[456k.me]",
  "[ThZu.Cc]",
  "_U3C3",
  "-hhb",
];

export const DEFAULT_CRACK_KEYWORDS = ["uncensored", "破解"];

export function defaultOrganizeConfig(): OrganizeConfig {
  return {
    defaultMode: "hardlink",
    defaultFallback: "copy",
    onConflict: "overwrite",
    metadataDir: "",
    deleteMetadataOnFail: false,
    purgeCoverCacheAfterDone: true,
    overwriteVideoSubtitle: true,
    overwriteImages: true,
    minFileSizeMb: 100,
    videoExtensions: [...DEFAULT_VIDEO_EXTENSIONS],
    filenameBlacklist: [],
    junkFilters: [...DEFAULT_JUNK_FILTERS],
    crackKeywords: [...DEFAULT_CRACK_KEYWORDS],
    cleanup: {
      enabled: false,
      whitelistProtect: true,
      deleteSmallFiles: true,
      deleteNonWhitelist: true,
      deleteBlacklist: true,
      extraWhitelistExt: [],
    },
  };
}
