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
} from "../../types.js";
import {
  DEFAULT_CRACK_KEYWORDS,
  DEFAULT_JUNK_FILTERS,
  DEFAULT_VIDEO_EXTENSIONS,
  defaultOrganizeConfig,
} from "../organizeDefaults.js";
import {
  isObject,
  parseExtList,
  parseStringList,
  toBooleanOr,
  toNumberOr,
  toStringOr,
} from "./helpers.js";
import { toStorageRelativePath } from "../../paths.js";

function normConfigPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return toStorageRelativePath(trimmed);
}

const ORGANIZE_MODES = new Set<OrganizeMode>([
  "copy",
  "move",
  "hardlink",
  "softlink",
  "inplace",
]);
const ORGANIZE_FALLBACKS = new Set<OrganizeFallback>(["copy", "fail"]);
const CONFLICT_OPTIONS = new Set<OnConflict>(["skip", "overwrite", "rename"]);

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

function resolveOrganizeConflict(
  raw: Record<string, unknown>,
  base: OrganizeConfig,
): Pick<OrganizeConfig, "onConflict" | "overwriteVideoSubtitle"> {
  const overwriteFromRaw = toBooleanOr(raw.overwriteVideoSubtitle, base.overwriteVideoSubtitle);
  const hasExplicitConflict = CONFLICT_OPTIONS.has(raw.onConflict as OnConflict);

  if (hasExplicitConflict) {
    const onConflict = raw.onConflict as OnConflict;
    return {
      onConflict,
      // 与 onConflict 对齐：仅 overwrite 时视为「覆盖视频/字幕」
      overwriteVideoSubtitle: onConflict === "overwrite",
    };
  }

  const onConflict: OnConflict = overwriteFromRaw ? "overwrite" : "skip";
  return { onConflict, overwriteVideoSubtitle: overwriteFromRaw };
}

function normalizeOrganize(raw: unknown): OrganizeConfig {
  const base = defaultOrganizeConfig();
  if (!isObject(raw)) return base;
  const { onConflict, overwriteVideoSubtitle } = resolveOrganizeConflict(raw, base);
  return {
    defaultMode: ORGANIZE_MODES.has(raw.defaultMode as OrganizeMode)
      ? (raw.defaultMode as OrganizeMode)
      : base.defaultMode,
    defaultFallback: ORGANIZE_FALLBACKS.has(raw.defaultFallback as OrganizeFallback)
      ? (raw.defaultFallback as OrganizeFallback)
      : base.defaultFallback,
    onConflict,
    metadataDir: normConfigPath(toStringOr(raw.metadataDir, base.metadataDir)),
    deleteMetadataOnFail: toBooleanOr(raw.deleteMetadataOnFail, base.deleteMetadataOnFail),
    purgeCoverCacheAfterDone: toBooleanOr(
      raw.purgeCoverCacheAfterDone,
      base.purgeCoverCacheAfterDone,
    ),
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
      sourceRoot: normConfigPath(toStringOr(curr.sourceRoot, prev.sourceRoot)),
      libraryRoot: normConfigPath(toStringOr(curr.libraryRoot, prev.libraryRoot)),
      ...(useGlobalOrganize === false ? { useGlobalOrganize: false } : {}),
      ...(organizeMode ? { organizeMode } : {}),
      ...(organizeFallback ? { organizeFallback } : {}),
      ...(metadataDir !== undefined ? { metadataDir: normConfigPath(metadataDir) } : {}),
      ...(deleteMetadataOnFail !== undefined ? { deleteMetadataOnFail } : {}),
    };
  }

  assertLibrariesConfig(config);
  return config;
}
