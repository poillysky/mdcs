import fs from "node:fs";
import path from "node:path";
import { COVERS_DIR, resolveProjectPath } from "../paths.js";
import { writeScrapeCache } from "../scrape/cache.js";
import type { ScrapeMeta } from "../scrape/types.js";
import type { KindId } from "../types.js";

const COVER_EXTS = ["jpg", "jpeg", "png", "webp"] as const;

/** 过小多为下载失败占位/错误页，不可作封面源或片库成品 */
export const MIN_COVER_IMAGE_BYTES = 20_000;

export function isUsableCoverImage(abs: string): boolean {
  try {
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return false;
    return fs.statSync(abs).size >= MIN_COVER_IMAGE_BYTES;
  } catch {
    return false;
  }
}

export function isCoverFileReadable(abs: string): boolean {
  return isUsableCoverImage(abs);
}

/** 丢弃不存在的 coverSource（含指向片库 poster 但文件已删的失效路径） */
export function sanitizeCoverSourceForPoster(coverSource: string | null): string | null {
  if (!coverSource) return null;
  return isCoverFileReadable(coverSource) ? coverSource : null;
}

/** 删除 data/covers/{kind}/{code}.* */
export function deleteCoverCacheFiles(code: string, kind: KindId): void {
  if (!code) return;
  const coverDir = path.join(COVERS_DIR, kind);
  if (!fs.existsSync(coverDir)) return;
  for (const ext of COVER_EXTS) {
    const p = path.join(coverDir, `${code}.${ext}`);
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {
      /* ignore */
    }
    const thumbP = path.join(coverDir, `${code}-thumb.${ext}`);
    try {
      if (fs.existsSync(thumbP)) fs.unlinkSync(thumbP);
    } catch {
      /* ignore */
    }
  }
}

/** 整理成功后清理封面缓存，并同步 scrape_cache 去掉 coverLocal */
export function purgeCoverCacheAfterOrganize(
  code: string,
  kind: KindId,
  meta: ScrapeMeta,
): ScrapeMeta {
  deleteCoverCacheFiles(code, kind);
  const next: ScrapeMeta = { ...meta, coverLocal: null };
  writeScrapeCache(next);
  return next;
}

/**
 * 整理用封面源：仅 data/covers 缓存（完整横版原图）。
 * 片库 poster/thumb 是整理产物，不可再作裁剪源，否则二次刮削会叠裁丢内容。
 */
export function resolveOrganizeCoverSource(opts: {
  meta: { coverLocal?: string | null } | null;
  projectRoot: string;
  posterAbsCandidate: string;
}): string | null {
  const local = opts.meta?.coverLocal;
  if (!local) return null;
  const abs = resolveProjectPath(local, opts.projectRoot);
  try {
    if (isUsableCoverImage(abs)) return abs;
  } catch {
    /* ignore */
  }
  return null;
}

/** 片库已整理出的 poster/thumb，不可作为裁剪输入 */
export function isLibraryOrganizedImage(abs: string, posterAbsCandidate: string): boolean {
  const resolved = path.resolve(abs);
  const dir = path.dirname(path.resolve(posterAbsCandidate));
  const posterStem = path.basename(posterAbsCandidate, path.extname(posterAbsCandidate));
  const candidates = [
    ...COVER_EXTS.map((ext) => path.join(dir, `${posterStem}.${ext}`)),
    ...COVER_EXTS.map((ext) => path.join(dir, `thumb.${ext}`)),
  ];
  return candidates.some((p) => path.resolve(p) === resolved);
}

export function libraryHasOrganizedImages(posterAbs: string | null): boolean {
  if (!posterAbs) return false;
  try {
    if (isUsableCoverImage(posterAbs)) return true;
    const thumb = path.join(path.dirname(posterAbs), "thumb.jpg");
    return isUsableCoverImage(thumb);
  } catch {
    return false;
  }
}

/** 整理成功后是否清理 data/covers 缓存 */
export function shouldPurgeCoverCacheAfterOrganize(
  posterAbs: string | null,
  meta: { coverLocal?: string | null },
): boolean {
  if (meta.coverLocal) return true;
  return libraryHasOrganizedImages(posterAbs);
}
