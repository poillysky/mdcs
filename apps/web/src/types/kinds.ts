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
  purgeCoverCacheAfterDone: boolean;
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

export type IndexFile = {
  name: string;
  relative: string;
  mtime: number;
  size: number;
};

export type IndexBrowse = {
  parent: string;
  folders: IndexFolder[];
  files: IndexFile[];
};

export type KindRow = {
  id: string;
  label: string;
  enabled: boolean;
  sourceRoot: string;
  libraryRoot: string;
  sourceAbs?: string;
  libraryAbs?: string;
  organizeMode: string;
  organizeFallback?: string;
  useGlobalOrganize?: boolean;
  metadataDir?: string;
  deleteMetadataOnFail?: boolean;
  stats: Record<string, number>;
};
