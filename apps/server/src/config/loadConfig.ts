import fs from "node:fs";
import path from "node:path";
import {
  CONFIG_DIR,
  ensureDir,
  LIBRARIES_CONFIG_PATH,
  buildVideoExtSet,
  isVideoFile,
  pathExists,
  PROJECT_ROOT,
  resolveFromRoot,
} from "../paths.js";
import { hitsFilenameBlacklist } from "../library/scanFilter.js";
import type {
  KindConfig,
  KindId,
  LibrariesConfig,
  OrganizeConfig,
  OrganizeFallback,
  OrganizeMode,
  ResolvedKind,
} from "../types.js";
import { KIND_IDS } from "../types.js";
import { assertKindPathField, assertRelativePathAllowed, normalizeRelativePath } from "../security/pathPolicy.js";
import { createDefaultLibrariesConfig, normalizeLibrariesConfig } from "./schema.js";

let cached: LibrariesConfig | null = null;
let cachedMtime = 0;

export function loadLibrariesConfig(force = false): LibrariesConfig {
  ensureDir(CONFIG_DIR);
  const mtime = pathExists(LIBRARIES_CONFIG_PATH)
    ? fs.statSync(LIBRARIES_CONFIG_PATH).mtimeMs
    : 0;
  if (cached && !force && mtime === cachedMtime) return cached;
  if (!pathExists(LIBRARIES_CONFIG_PATH)) {
    const fallback = createDefaultLibrariesConfig();
    fs.writeFileSync(
      LIBRARIES_CONFIG_PATH,
      `${JSON.stringify(fallback, null, 2)}\n`,
      "utf8",
    );
    cached = fallback;
    cachedMtime = fs.statSync(LIBRARIES_CONFIG_PATH).mtimeMs;
    return fallback;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(LIBRARIES_CONFIG_PATH, "utf8"));
  } catch (err) {
    throw new Error(
      `配置文件解析失败: libraries.json 不是有效 JSON（${err instanceof Error ? err.message : String(err)}）`,
    );
  }
  cached = normalizeLibrariesConfig(raw);
  cachedMtime = mtime;
  return cached;
}

export function saveLibrariesConfig(config: LibrariesConfig): void {
  ensureDir(CONFIG_DIR);
  const normalized = normalizeLibrariesConfig(config);
  fs.writeFileSync(LIBRARIES_CONFIG_PATH, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  cached = normalized;
  cachedMtime = fs.statSync(LIBRARIES_CONFIG_PATH).mtimeMs;
}

export function getIndexRoot(config = loadLibrariesConfig()): string {
  return resolveFromRoot(config.indexRoot || "index", getPathRoot(config));
}

export type IndexFolder = {
  name: string;
  relative: string;
  /** 目录修改时间（毫秒时间戳） */
  mtime: number;
};

export type IndexFile = {
  name: string;
  relative: string;
  mtime: number;
  size: number;
};

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  "dist",
  "apps",
  "references",
  "data",
]);

export function listIndexFolders(
  parent = "",
  config = loadLibrariesConfig(),
): {
  parent: string;
  folders: IndexFolder[];
  files: IndexFile[];
} {
  const root = getPathRoot(config);
  let rel = "";
  try {
    rel = parent.trim() ? normalizeRelativePath(parent) : "";
  } catch {
    return { parent: "", folders: [], files: [] };
  }
  if (rel) {
    assertRelativePathAllowed(rel, config);
  }
  const abs = rel ? resolveFromRoot(rel, root) : root;
  const inside = path.relative(root, abs);
  if (inside.startsWith("..") || path.isAbsolute(inside)) {
    return { parent: "", folders: [], files: [] };
  }

  const folders: IndexFolder[] = [];
  const files: IndexFile[] = [];
  if (!pathExists(abs)) {
    return { parent: rel, folders, files };
  }
  const videoExt = buildVideoExtSet(config.organize.videoExtensions);
  const filenameBlacklist = config.organize.filenameBlacklist || [];
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(abs, { withFileTypes: true });
  } catch {
    return { parent: rel, folders, files };
  }
  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    const childRel = rel ? `${rel}/${ent.name}` : ent.name;
    const childAbs = path.join(abs, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIR_NAMES.has(ent.name)) continue;
      let mtime = 0;
      try {
        mtime = Math.floor(fs.statSync(childAbs).mtimeMs);
      } catch {
        /* 无权限或已删除则留 0 */
      }
      folders.push({ name: ent.name, relative: childRel, mtime });
      continue;
    }
    if (!ent.isFile()) continue;
    if (!isVideoFile(ent.name, videoExt)) continue;
    if (hitsFilenameBlacklist(ent.name, filenameBlacklist)) continue;
    let mtime = 0;
    let size = 0;
    try {
      const st = fs.statSync(childAbs);
      mtime = Math.floor(st.mtimeMs);
      size = st.size;
    } catch {
      /* 无权限或已删除则留 0 */
    }
    files.push({ name: ent.name, relative: childRel, mtime, size });
  }
  folders.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  files.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  return { parent: rel, folders, files };
}

export function getPathRoot(config = loadLibrariesConfig()): string {
  return resolveFromRoot(config.pathRoot || ".", PROJECT_ROOT);
}

export function resolveKind(
  kindId: KindId,
  config = loadLibrariesConfig(),
): ResolvedKind | null {
  const kind = config.kinds[kindId];
  if (!kind) return null;
  const root = getPathRoot(config);
  const sourceRoot = (kind.sourceRoot || "").trim();
  const libraryRoot = (kind.libraryRoot || "").trim();
  const exclusive = kind.useGlobalOrganize === false;
  return {
    ...kind,
    sourceRoot,
    libraryRoot,
    id: kindId,
    sourceAbs: sourceRoot ? resolveFromRoot(sourceRoot, root) : "",
    libraryAbs: libraryRoot ? resolveFromRoot(libraryRoot, root) : "",
    organizeMode:
      exclusive && kind.organizeMode ? kind.organizeMode : config.organize.defaultMode,
    organizeFallback:
      exclusive && kind.organizeFallback
        ? kind.organizeFallback
        : config.organize.defaultFallback,
  };
}

/** 解析分区生效的整理配置（全局或专属 sticky 合并） */
export function resolveOrganizeForKind(
  kindId: KindId,
  config = loadLibrariesConfig(),
): OrganizeConfig {
  const kind = config.kinds[kindId];
  const org = config.organize;
  if (!kind || kind.useGlobalOrganize !== false) return { ...org, cleanup: { ...org.cleanup } };
  return {
    ...org,
    cleanup: { ...org.cleanup },
    defaultMode: kind.organizeMode ?? org.defaultMode,
    defaultFallback: kind.organizeFallback ?? org.defaultFallback,
    metadataDir: kind.metadataDir ?? org.metadataDir,
    deleteMetadataOnFail:
      typeof kind.deleteMetadataOnFail === "boolean"
        ? kind.deleteMetadataOnFail
        : org.deleteMetadataOnFail,
  };
}

export function listResolvedKinds(config = loadLibrariesConfig()): ResolvedKind[] {
  return KIND_IDS.map((id) => resolveKind(id, config)).filter(
    (k): k is ResolvedKind => k !== null,
  );
}

export function listEnabledKinds(config = loadLibrariesConfig()): ResolvedKind[] {
  return listResolvedKinds(config).filter((k) => k.enabled);
}

export function updateKindConfig(
  kindId: KindId,
  patch: Partial<KindConfig>,
): ResolvedKind {
  const config = loadLibrariesConfig();
  const current = config.kinds[kindId];
  if (!current) throw new Error(`未知分区: ${kindId}`);
  const next: KindConfig = { ...current, ...patch };
  if (typeof patch.sourceRoot === "string") {
    next.sourceRoot = assertKindPathField("sourceRoot", patch.sourceRoot);
  }
  if (typeof patch.libraryRoot === "string") {
    next.libraryRoot = assertKindPathField("libraryRoot", patch.libraryRoot);
  }
  // 切回全局时清掉 sticky，避免「开关开着却仍吃旧专属值」
  if (patch.useGlobalOrganize === true || patch.useGlobalOrganize === undefined) {
    if (patch.useGlobalOrganize === true) {
      delete next.useGlobalOrganize;
      delete next.organizeMode;
      delete next.organizeFallback;
      delete next.metadataDir;
      delete next.deleteMetadataOnFail;
    }
  }
  if (patch.useGlobalOrganize === false) {
    next.useGlobalOrganize = false;
  }
  config.kinds[kindId] = next;
  saveLibrariesConfig(config);
  const resolved = resolveKind(kindId, config);
  if (!resolved) throw new Error(`无法解析分区: ${kindId}`);
  return resolved;
}

export function updateOrganizeConfig(
  patch: Partial<LibrariesConfig["organize"]>,
): LibrariesConfig["organize"] {
  const config = loadLibrariesConfig();
  const prevMode = config.organize.defaultMode;
  const prevFallback = config.organize.defaultFallback;
  config.organize = { ...config.organize, ...patch };
  if (typeof config.organize.metadataDir === "string" && config.organize.metadataDir.trim()) {
    config.organize.metadataDir = normalizeRelativePath(config.organize.metadataDir);
  }
  if (patch.cleanup) {
    config.organize.cleanup = { ...config.organize.cleanup, ...patch.cleanup };
  }
  // 仅改覆盖开关且未同时指定 onConflict 时，用开关推导冲突策略
  if (typeof patch.overwriteVideoSubtitle === "boolean" && patch.onConflict === undefined) {
    config.organize.onConflict = patch.overwriteVideoSubtitle ? "overwrite" : "skip";
  } else if (patch.onConflict !== undefined) {
    config.organize.overwriteVideoSubtitle = config.organize.onConflict === "overwrite";
  }
  // 全局模式变更时清掉分区 sticky，避免整理页改了却不生效
  if (patch.defaultMode && patch.defaultMode !== prevMode) {
    for (const id of KIND_IDS) {
      const k = config.kinds[id];
      if (k && "organizeMode" in k) {
        delete (k as { organizeMode?: unknown }).organizeMode;
      }
    }
  }
  if (patch.defaultFallback && patch.defaultFallback !== prevFallback) {
    for (const id of KIND_IDS) {
      const k = config.kinds[id];
      if (k && "organizeFallback" in k) {
        delete (k as { organizeFallback?: unknown }).organizeFallback;
      }
    }
  }
  saveLibrariesConfig(config);
  return loadLibrariesConfig().organize;
}

export function pickKinds(
  input: string[] | undefined,
  config = loadLibrariesConfig(),
): ResolvedKind[] {
  const enabled = listEnabledKinds(config);
  if (!input?.length || input.includes("*enabled")) return enabled;
  const set = new Set(input);
  return enabled.filter((k) => set.has(k.id));
}

export type { OrganizeMode, OrganizeFallback };
