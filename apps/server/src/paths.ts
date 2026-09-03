import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** apps/server/src -> apps/server -> apps -> MDCS 项目根 */
export const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");

export function resolveFromRoot(relativePath: string, root = PROJECT_ROOT): string {
  const normalized = relativePath.replace(/\\/g, "/").trim();
  if (!normalized || normalized === ".") return root;
  return path.resolve(root, normalized);
}

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function readTextFile(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

export function pathExists(p: string): boolean {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

/** 规范化后是否指向同一路径（不要求文件存在） */
export function pathsReferToSameLocation(a: string, b: string): boolean {
  return path.resolve(a) === path.resolve(b);
}

export const CONFIG_DIR = resolveFromRoot("config");
export const DATA_DIR = resolveFromRoot("data");
export const DB_PATH = path.join(DATA_DIR, "mdcs.db");
export const LEGACY_DB_PATH = path.join(DATA_DIR, "scrap.db");
export const LIBRARIES_CONFIG_PATH = path.join(CONFIG_DIR, "libraries.json");
export const META_DIR = path.join(DATA_DIR, "meta");
export const COVERS_DIR = path.join(DATA_DIR, "covers");
export const SCRAPE_CONFIG_PATH = path.join(CONFIG_DIR, "scrape.json");
export const OPS_CONFIG_PATH = path.join(CONFIG_DIR, "ops.json");
export const SCHEMA_PATH = path.join(__dirname, "db", "schema.sql");

export const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mkv",
  ".avi",
  ".wmv",
  ".mov",
  ".ts",
  ".m2ts",
  ".flv",
  ".webm",
  ".iso",
  ".rmvb",
  ".mpg",
  ".m4v",
  ".strm",
  ".vob",
]);

export function buildVideoExtSet(extensions?: string[]): Set<string> {
  if (!extensions?.length) return VIDEO_EXTENSIONS;
  const set = new Set<string>();
  for (const raw of extensions) {
    const e = raw.trim().toLowerCase().replace(/^\./, "");
    if (e) set.add(`.${e}`);
  }
  return set.size ? set : VIDEO_EXTENSIONS;
}

export function isVideoFile(fileName: string, extensions?: string[] | Set<string>): boolean {
  const ext = path.extname(fileName).toLowerCase();
  if (extensions instanceof Set) return extensions.has(ext);
  if (Array.isArray(extensions)) return buildVideoExtSet(extensions).has(ext);
  return VIDEO_EXTENSIONS.has(ext);
}

export function toPosixRelative(absPath: string, root = PROJECT_ROOT): string {
  return path.relative(root, absPath).split(path.sep).join("/");
}

/** 封面缓存等路径：存相对项目根；已是相对则规范化斜杠 */
export function toProjectRelativePath(raw: string, root = PROJECT_ROOT): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  const norm = s.replace(/\\/g, "/");
  // /media/... 等为项目内相对路径（带前导斜杠），不是盘符绝对路径
  if (norm.startsWith("/") && !/^[a-zA-Z]:/.test(norm)) {
    return norm.replace(/^\/+/, "").replace(/\/+$/, "");
  }
  if (path.isAbsolute(s) || /^[a-zA-Z]:/.test(norm)) {
    const rel = toPosixRelative(s, root);
    return rel.startsWith("..") ? norm.replace(/^\/+/, "") : rel;
  }
  return norm.replace(/^\/+/, "").replace(/\/+$/, "");
}

/** 存储/API 用：相对项目根、无前导斜杠、统一正斜杠 */
export function toStorageRelativePath(raw: string, root = PROJECT_ROOT): string {
  return toProjectRelativePath(raw, root);
}

/** 片库绝对路径 → 相对片库根（存 target_path） */
export function toLibraryRelativePath(absPath: string, libraryAbs: string): string {
  if (!libraryAbs?.trim()) return "";
  const rel = path.relative(libraryAbs, path.resolve(absPath)).replace(/\\/g, "/");
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return "";
  return rel;
}

/** 读取封面缓存等：相对路径 → 绝对路径 */
export function resolveProjectPath(raw: string, root = PROJECT_ROOT): string {
  const s = String(raw || "").trim();
  if (!s) return s;
  if (path.isAbsolute(s) || /^[a-zA-Z]:[\\/]/.test(s)) return s;
  return resolveFromRoot(s.replace(/^\/+/, ""), root);
}
