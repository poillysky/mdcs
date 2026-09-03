import fs from "node:fs";
import { loadLibrariesConfig, pickKinds } from "../config/loadConfig.js";
import { organizeWalkFilter, walkVideoFiles } from "../library/scanFilter.js";
import { normalizeRelativePath } from "../security/pathPolicy.js";
import { resolveKindScanAbs } from "./scanner.js";
import type { JobRecord } from "../types.js";

type WalkCacheEntry = { count: number; at: number };

const WALK_CACHE_MS = 60_000;
const walkCache = new Map<string, WalkCacheEntry>();

type WalkInput = Pick<JobRecord, "kinds" | "options">;

function walkCacheKey(job: WalkInput): string | null {
  const scanPath = typeof job.options?.scanPath === "string" ? job.options.scanPath.trim() : "";
  if (!scanPath || !job.kinds?.length) return null;
  return `${job.kinds.join(",")}|${normalizeRelativePath(scanPath)}`;
}

/** scanPath 目录下磁盘视频总数（walk）；带短时缓存，避免列表刷新频繁扫盘 */
export function countScopeWalkTotal(job: WalkInput, opts?: { fresh?: boolean }): number | null {
  const scanPath = typeof job.options?.scanPath === "string" ? job.options.scanPath.trim() : "";
  if (!scanPath || !job.kinds?.length) return null;

  const key = walkCacheKey(job);
  if (!key) return null;

  if (!opts?.fresh) {
    const hit = walkCache.get(key);
    if (hit && Date.now() - hit.at < WALK_CACHE_MS) return hit.count;
  }

  try {
    const kinds = pickKinds(job.kinds);
    const kind = kinds[0];
    if (!kind) return null;
    const scanAbs = resolveKindScanAbs(kind, scanPath);
    if (!scanAbs || !fs.existsSync(scanAbs)) return null;
    const filter = organizeWalkFilter(loadLibrariesConfig().organize);
    const count = walkVideoFiles(scanAbs, filter).length;
    walkCache.set(key, { count, at: Date.now() });
    return count;
  } catch {
    return null;
  }
}

export function invalidateScopeWalkCache(job: WalkInput): void {
  const key = walkCacheKey(job);
  if (key) walkCache.delete(key);
}
