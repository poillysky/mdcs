import fs from "node:fs";
import path from "node:path";
import {
  CONFIG_DIR,
  ensureDir,
  LIBRARIES_CONFIG_PATH,
  pathExists,
  PROJECT_ROOT,
  resolveFromRoot,
} from "../paths.js";
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
import { assertKindPathField, assertRelativePathAllowed } from "../security/pathPolicy.js";
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
} {
  const root = getPathRoot(config);
  const rel = parent.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (rel) {
    assertRelativePathAllowed(rel, config);
  }
  const abs = rel ? resolveFromRoot(rel, root) : root;
  const inside = path.relative(root, abs);
  if (inside.startsWith("..") || path.isAbsolute(inside)) {
    return { parent: "", folders: [] };
  }

  const folders: IndexFolder[] = [];
  if (!pathExists(abs)) {
    return { parent: rel, folders };
  }
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(abs, { withFileTypes: true });
  } catch {
    return { parent: rel, folders };
  }
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (ent.name.startsWith(".")) continue;
    if (SKIP_DIR_NAMES.has(ent.name)) continue;
    const childRel = rel ? `${rel}/${ent.name}` : ent.name;
    let mtime = 0;
    try {
      mtime = Math.floor(fs.statSync(path.join(abs, ent.name)).mtimeMs);
    } catch {
      /* 无权限或已删除则留 0 */
    }
    folders.push({ name: ent.name, relative: childRel, mtime });
  }
  folders.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  return { parent: rel, folders };
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
  config.organize = { ...config.organize, ...patch };
  if (patch.cleanup) {
    config.organize.cleanup = { ...config.organize.cleanup, ...patch.cleanup };
  }
  if (typeof patch.overwriteVideoSubtitle === "boolean") {
    config.organize.onConflict = patch.overwriteVideoSubtitle ? "overwrite" : "skip";
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
