export const KIND_IDS = [
  "japan_censored",
  "japan_gravure",
  "japan_uncensored",
  "japan_amateur",
  "fc2",
  "china",
  "western",
] as const;

export type KindId = (typeof KIND_IDS)[number];

export type OrganizeMode = "copy" | "move" | "hardlink" | "softlink" | "inplace";
export type OrganizeFallback = "copy" | "fail";
export type OnConflict = "skip" | "overwrite" | "rename";

export type OrganizeCleanupConfig = {
  enabled: boolean;
  whitelistProtect: boolean;
  deleteSmallFiles: boolean;
  deleteNonWhitelist: boolean;
  deleteBlacklist: boolean;
  extraWhitelistExt: string[];
};

export type OrganizeConfig = {
  defaultMode: OrganizeMode;
  defaultFallback: OrganizeFallback;
  onConflict: OnConflict;
  /** 视频以外文件（NFO/图片）独立目录；空=与视频同目录 */
  metadataDir: string;
  /** 刮削失败时删除已创建的独立元数据目录 */
  deleteMetadataOnFail: boolean;
  overwriteVideoSubtitle: boolean;
  overwriteImages: boolean;
  /** 小于此体积（MB）的文件扫描时忽略 */
  minFileSizeMb: number;
  /** 视为视频的后缀（不含点），如 mp4 */
  videoExtensions: string[];
  filenameBlacklist: string[];
  /** 解析番号前剔除的垃圾串；正则以 r: 开头 */
  junkFilters: string[];
  /** 识别无码破解，匹配文件名与路径 */
  crackKeywords: string[];
  cleanup: OrganizeCleanupConfig;
};
export type JobMode =
  | "scan_only"
  | "scrape_only"
  | "organize_only"
  | "full"
  | "rescan";

export type FileStatus =
  | "pending"
  | "scraping"
  | "scraped"
  | "planned"
  | "organizing"
  | "done"
  | "failed"
  | "skipped";

export type JobStatus =
  | "queued"
  | "running"
  | "paused"
  | "done"
  | "failed"
  | "cancelled";

export type JobTriggerSource = "manual" | "monitor" | "qb";

export type KindConfig = {
  enabled: boolean;
  label: string;
  sourceRoot: string;
  libraryRoot: string;
  /**
   * 整理参数是否沿用全局（默认 true）。
   * false 时使用本分区 sticky：organizeMode / organizeFallback / metadataDir / deleteMetadataOnFail。
   */
  useGlobalOrganize?: boolean;
  organizeMode?: OrganizeMode;
  organizeFallback?: OrganizeFallback;
  /** 分区专属元数据目录；仅 useGlobalOrganize===false 时生效 */
  metadataDir?: string;
  /** 分区专属：刮削失败删元数据目录 */
  deleteMetadataOnFail?: boolean;
};

export type LibrariesConfig = {
  pathRoot: string;
  indexRoot?: string;
  server?: {
    port?: number;
    host?: string;
  };
  web?: {
    port?: number;
    apiOrigin?: string;
  };
  organize: OrganizeConfig;
  kinds: Record<KindId, KindConfig>;
};

export type ResolvedKind = KindConfig & {
  id: KindId;
  sourceAbs: string;
  libraryAbs: string;
  organizeMode: OrganizeMode;
  organizeFallback: OrganizeFallback;
};

export type ApiResponse<T = unknown> = {
  ok: boolean;
  data?: T;
  message?: string;
  code?: string;
};

import type { JobOptions } from "./jobs/options.js";

export type JobRecord = {
  id: string;
  kinds: KindId[];
  mode: JobMode;
  dryRun: boolean;
  options?: JobOptions;
  triggerSource: JobTriggerSource;
  status: JobStatus;
  total: number;
  processed: number;
  failed: number;
  skipped: number;
  message?: string;
  createdAt: number;
  updatedAt: number;
};

export type FileRecord = {
  id: number;
  kind: KindId;
  sourcePath: string;
  fileName: string;
  fileSize: number;
  fileMtime: number;
  code: string | null;
  cdIndex: number;
  status: FileStatus;
  targetPath: string | null;
  error: string | null;
};

export type ScanResult = {
  kind: KindId;
  scanned: number;
  inserted: number;
  updated: number;
  skipped: number;
};

export type JobEvent = {
  ts: string;
  level: "info" | "ok" | "warn" | "error";
  text: string;
  jobId?: string;
  kind?: KindId;
};
