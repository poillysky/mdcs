import path from "node:path";
import { PROJECT_ROOT, resolveFromRoot, toLibraryRelativePath, toPosixRelative } from "../paths.js";
import { normalizeLibraryRelativePath } from "../security/pathPolicy.js";
import type { ResolvedKind } from "../types.js";

/** 已是 media/index/data 或片库/索引根下的项目相对路径 */
export function isProjectRelativePath(raw: string): boolean {
  const norm = String(raw || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
  return (
    /^(?:media|index|data)\//i.test(norm) ||
    norm.includes("片商目录") ||
    norm.includes("本地索引")
  );
}

/**
 * 将 DB 中的 target_path（相对片库根）展开为项目相对路径，供 UI / pipeline 日志展示。
 * 例：HMN/HMN-467/HMN-467.strm → media/片商目录/日本有码/HMN/HMN-467/HMN-467.strm
 */
export function expandLibraryTargetRel(targetRel: string, libraryRoot?: string): string {
  const raw = String(targetRel || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!raw) return "";
  if (path.isAbsolute(raw)) {
    const rel = toPosixRelative(raw, PROJECT_ROOT);
    return rel && !rel.startsWith("..") ? rel : raw.replace(/\\/g, "/");
  }
  if (isProjectRelativePath(raw)) return raw;
  const lib = String(libraryRoot || "").trim().replace(/\\/g, "/").replace(/\/+$/, "");
  if (!lib) return raw;
  return `${lib}/${raw}`;
}

/**
 * files.target_path 存的是相对片库根目录的路径（如 HMN/HMN-456/HMN-456.strm），
 * 不是相对项目根。整理计划里的 targetAbs/nfoAbs 用本函数解析。
 */
export function resolveStoredTargetAbs(
  kind: ResolvedKind,
  targetRel: string,
  projectRoot = PROJECT_ROOT,
): string {
  const raw = normalizeLibraryRelativePath(targetRel, kind.libraryAbs, projectRoot);
  if (!raw) return "";
  if (path.isAbsolute(raw)) return raw;
  if (/^(?:media|index|data)\//i.test(raw) || raw.includes("片商目录") || raw.includes("本地索引")) {
    return resolveFromRoot(raw, projectRoot);
  }
  if (kind.libraryAbs) {
    return path.join(kind.libraryAbs, raw.replace(/^\/+/, ""));
  }
  return resolveFromRoot(raw, projectRoot);
}

export function resolveNfoAbsBesideVideo(
  videoAbs: string,
  metadataDir: string | undefined,
  projectRoot = PROJECT_ROOT,
): string {
  const absDir = path.dirname(videoAbs);
  const stem = path.parse(videoAbs).name;
  const raw = (metadataDir || "").trim();
  const metaRoot = raw ? (path.isAbsolute(raw) ? raw : resolveFromRoot(raw, projectRoot)) : absDir;
  return path.join(metaRoot, `${stem}.nfo`);
}
