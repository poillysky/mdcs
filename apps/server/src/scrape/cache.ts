import fs from "node:fs";
import path from "node:path";
import { openDatabase } from "../db/init.js";
import {
  COVERS_DIR,
  META_DIR,
  ensureDir,
  resolveProjectPath,
  toProjectRelativePath,
} from "../paths.js";
import type { KindId } from "../types.js";
import { KIND_IDS } from "../types.js";
import type { ScrapeMeta } from "./types.js";
import { resolveProviderSite } from "./providers/providerSite.js";

function metaJsonPath(code: string, kind: KindId): string {
  return path.join(META_DIR, kind, `${code}.json`);
}

/** 从磁盘 JSON 读取（与 SQLite 双备份） */
export function readMetaJsonFile(code: string, kind: KindId): ScrapeMeta | null {
  const filePath = metaJsonPath(code, kind);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as ScrapeMeta;
  } catch {
    return null;
  }
}

function parseScrapedAt(meta: ScrapeMeta): number {
  const ts = Date.parse(meta.scrapedAt || "");
  return Number.isFinite(ts) ? ts : 0;
}

function mergeStoredMeta(dbMeta: ScrapeMeta | null, fileMeta: ScrapeMeta | null): ScrapeMeta | null {
  if (!dbMeta && !fileMeta) return null;
  if (!dbMeta) return fileMeta;
  if (!fileMeta) return dbMeta;

  const dbTime = parseScrapedAt(dbMeta);
  const fileTime = parseScrapedAt(fileMeta);
  const base = fileTime >= dbTime ? { ...fileMeta } : { ...dbMeta };
  const other = fileTime >= dbTime ? dbMeta : fileMeta;

  if (!base.sourceSnapshots && other.sourceSnapshots) {
    base.sourceSnapshots = other.sourceSnapshots;
  }
  if (!base.coverLocal && other.coverLocal) {
    base.coverLocal = other.coverLocal;
  }
  if (!base.coverUrl && other.coverUrl) {
    base.coverUrl = other.coverUrl;
  }
  if (!base.publishNumber && other.publishNumber) {
    base.publishNumber = other.publishNumber;
  }
  if (!base.fieldSources?.publishNumber && other.fieldSources?.publishNumber) {
    base.fieldSources = {
      ...(base.fieldSources ?? {}),
      publishNumber: other.fieldSources.publishNumber,
    };
  }
  if ((base.ratingValue == null || !Number.isFinite(Number(base.ratingValue))) && other.ratingValue != null) {
    base.ratingValue = other.ratingValue;
  }
  if (base.ratingMax == null && other.ratingMax != null) {
    base.ratingMax = other.ratingMax;
  }
  if (!base.ratingSource && other.ratingSource) {
    base.ratingSource = other.ratingSource;
  }
  if (!base.fieldSources?.ratingValue && other.fieldSources?.ratingValue) {
    base.fieldSources = {
      ...(base.fieldSources ?? {}),
      ratingValue: other.fieldSources.ratingValue,
    };
  }
  return base;
}

function shouldPersistMerged(dbMeta: ScrapeMeta | null, merged: ScrapeMeta): boolean {
  if (!dbMeta) return true;
  if (!dbMeta.sourceSnapshots && merged.sourceSnapshots) return true;
  if (!dbMeta.publishNumber && merged.publishNumber) return true;
  if (!dbMeta.fieldSources?.publishNumber && merged.fieldSources?.publishNumber) return true;
  if (!dbMeta.fieldSources?.code && merged.fieldSources?.code) return true;
  if (
    (dbMeta.ratingValue == null || !Number.isFinite(Number(dbMeta.ratingValue))) &&
    merged.ratingValue != null &&
    Number.isFinite(Number(merged.ratingValue))
  ) {
    return true;
  }
  return parseScrapedAt(merged) > parseScrapedAt(dbMeta);
}

function readDbMeta(code: string, kind: KindId): ScrapeMeta | null {
  const db = openDatabase();
  const row = db
    .prepare(`SELECT meta_json FROM scrape_cache WHERE code = ? AND kind = ?`)
    .get(code, kind) as { meta_json: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.meta_json) as ScrapeMeta;
  } catch {
    return null;
  }
}

/** 启动时把 data/meta 下的 JSON 同步进 SQLite（防止只留文件或 DB 损坏） */
export function syncMetaDirFromDisk(): number {
  if (!fs.existsSync(META_DIR)) return 0;
  let synced = 0;
  for (const kind of KIND_IDS) {
    const dir = path.join(META_DIR, kind);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".json")) continue;
      const code = name.slice(0, -".json".length);
      const fileMeta = readMetaJsonFile(code, kind);
      if (!fileMeta?.code) continue;
      const dbMeta = readDbMeta(code, kind);
      const merged = mergeStoredMeta(dbMeta, fileMeta);
      if (!merged) continue;
      if (shouldPersistMerged(dbMeta, merged)) {
        writeScrapeCache(enrichScrapeMeta(merged));
        synced += 1;
      }
    }
  }
  return synced;
}

/** 从源快照回填发行码（旧缓存未合并进顶层时） */
function backfillPublishNumber(meta: ScrapeMeta): ScrapeMeta {
  if (String(meta.publishNumber || "").trim()) {
    if (meta.fieldSources?.publishNumber) return meta;
    // 有值无来源时，尽量对齐快照来源
  }
  const snaps = meta.sourceSnapshots ?? {};
  if (!Object.keys(snaps).length) return meta;

  const prefer = [
    "dmm",
    "jav321",
    "libredmm",
    "avbase",
    ...(meta.sourcesTried ?? []),
    ...Object.keys(snaps),
  ];
  const seen = new Set<string>();
  for (const id of prefer) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const snap = snaps[id];
    if (!snap) continue;
    const raw = String(
      snap.fields?.publishNumber ?? snap.fields?.productId ?? "",
    ).trim();
    if (!raw) continue;
    const publishNumber = raw.toLowerCase();
    const nextSources = { ...(meta.fieldSources ?? {}) };
    if (!nextSources.publishNumber) nextSources.publishNumber = id;
    return {
      ...meta,
      publishNumber: meta.publishNumber?.trim() || publishNumber,
      fieldSources: nextSources,
    };
  }
  return meta;
}

/** 从源快照回填原生评分（旧缓存只合并了 ×2 后的 score） */
function backfillRatingValue(meta: ScrapeMeta): ScrapeMeta {
  if (meta.ratingValue != null && Number.isFinite(Number(meta.ratingValue))) {
    if (meta.fieldSources?.ratingValue) return meta;
  }
  const snaps = meta.sourceSnapshots ?? {};
  if (!Object.keys(snaps).length) return meta;

  const prefer = [
    meta.fieldSources?.score,
    meta.fieldSources?.ratingValue,
    "dmm",
    "javdb",
    "jav321",
    "mgstage",
    "javlibrary",
    ...(meta.sourcesTried ?? []),
    ...Object.keys(snaps),
  ];
  const seen = new Set<string>();
  for (const id of prefer) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const snap = snaps[id];
    if (!snap) continue;
    const rv = Number(snap.fields?.ratingValue);
    if (!Number.isFinite(rv)) continue;
    const nextSources = { ...(meta.fieldSources ?? {}) };
    if (!nextSources.ratingValue) nextSources.ratingValue = id;
    const ratingMax = Number(snap.fields?.ratingMax);
    const ratingSource =
      String(snap.fields?.ratingSource || "").trim() ||
      meta.ratingSource ||
      id;
    return {
      ...meta,
      ratingValue: meta.ratingValue != null && Number.isFinite(Number(meta.ratingValue))
        ? meta.ratingValue
        : rv,
      ratingMax:
        meta.ratingMax != null
          ? meta.ratingMax
          : Number.isFinite(ratingMax) && ratingMax > 0
            ? ratingMax
            : 5,
      ratingSource,
      fieldSources: nextSources,
    };
  }
  return meta;
}

/** 读取时补全：本地封面文件、extrafanart 作封面回退、发行码、番号来源 */
export function enrichScrapeMeta(meta: ScrapeMeta): ScrapeMeta {
  let next = backfillPublishNumber(meta);
  next = backfillRatingValue(next);
  if (String(next.code || "").trim() && !next.fieldSources?.code) {
    next = {
      ...next,
      fieldSources: { ...(next.fieldSources ?? {}), code: "系统解析" },
    };
  }
  const local = findLocalCover(meta.code, meta.kind);
  if (local && !next.coverLocal) {
    next = { ...next, coverLocal: local };
  }
  if (!next.coverUrl && next.extrafanartUrls?.[0]) {
    next = { ...next, coverUrl: next.extrafanartUrls[0] };
  }
  return next;
}

export function readScrapeCache(code: string, kind: KindId): ScrapeMeta | null {
  const dbMeta = readDbMeta(code, kind);
  const fileMeta = readMetaJsonFile(code, kind);
  const merged = mergeStoredMeta(dbMeta, fileMeta);
  if (!merged) return null;
  const enriched = enrichScrapeMeta(merged);
  if (shouldPersistMerged(dbMeta, enriched)) {
    writeScrapeCache(enriched);
  }
  return enriched;
}

export function writeScrapeCache(meta: ScrapeMeta): void {
  const toStore: ScrapeMeta = {
    ...meta,
    ...(meta.coverLocal
      ? { coverLocal: toProjectRelativePath(meta.coverLocal) }
      : {}),
  };
  const db = openDatabase();
  const ts = Date.now();
  db.prepare(`
    INSERT INTO scrape_cache (code, kind, meta_json, scraped_at)
    VALUES (@code, @kind, @meta_json, @scraped_at)
    ON CONFLICT(code, kind) DO UPDATE SET
      meta_json = excluded.meta_json,
      scraped_at = excluded.scraped_at
  `).run({
    code: toStore.code,
    kind: toStore.kind,
    meta_json: JSON.stringify(toStore),
    scraped_at: ts,
  });

  const metaPath = path.join(META_DIR, toStore.kind, `${toStore.code}.json`);
  ensureDir(path.dirname(metaPath));
  fs.writeFileSync(metaPath, `${JSON.stringify(toStore, null, 2)}\n`, "utf8");
}

export type CoverCacheSlot = "poster" | "thumb";

function coverCacheStem(code: string, slot: CoverCacheSlot = "poster"): string {
  return slot === "thumb" ? `${code}-thumb` : code;
}

/** 返回相对项目根的封面缓存路径（如 data/covers/kind/CODE.jpg） */
export function findLocalCover(code: string, kind: KindId, slot: CoverCacheSlot = "poster"): string | null {
  const dir = path.join(COVERS_DIR, kind);
  if (!fs.existsSync(dir)) return null;
  const stem = coverCacheStem(code, slot);
  for (const ext of ["jpg", "jpeg", "png", "webp"]) {
    const p = path.join(dir, `${stem}.${ext}`);
    if (fs.existsSync(p) && fs.statSync(p).size > 0) return toProjectRelativePath(p);
  }
  return null;
}

export function findLocalThumbCover(code: string, kind: KindId): string | null {
  return findLocalCover(code, kind, "thumb");
}

/** 本地封面缓存过小（多为流媒体预览图）时允许重下 */
const MIN_COVER_CACHE_BYTES = 20_000;

export async function downloadCover(
  code: string,
  kind: KindId,
  coverUrl: string,
  opts?: {
    signal?: AbortSignal;
    force?: boolean;
    referer?: string;
    pageUrl?: string;
    sourceId?: string;
    cacheSlot?: CoverCacheSlot;
  },
): Promise<string | null> {
  if (!coverUrl) return null;
  const slot = opts?.cacheSlot ?? "poster";
  if (!opts?.force) {
    const existing = findLocalCover(code, kind, slot);
    if (existing) {
      try {
        if (fs.statSync(resolveProjectPath(existing)).size >= MIN_COVER_CACHE_BYTES) {
          return existing;
        }
      } catch {
        /* re-download */
      }
    }
  }
  try {
    const { fetchBuffer } = await import("./network/fetch.js");
    const { cookieForUrl } = await import("./network/sourceCookies.js");
    const { resolveCoverImageReferer } = await import("./network/imageReferer.js");
    const { downloadFlareProtectedCoverImage } = await import("./network/coverDownload.js");
    const proxyUrlOverride = opts?.sourceId ? resolveProviderSite(opts.sourceId).proxyUrlOverride : undefined;
    const referer =
      opts?.referer ||
      resolveCoverImageReferer(coverUrl, {
        sourceId: opts?.sourceId,
        pageUrl: opts?.pageUrl,
      });

    let buf =
      (await downloadFlareProtectedCoverImage(coverUrl, {
        pageUrl: opts?.pageUrl,
        referer,
        sourceId: opts?.sourceId,
      })) ?? null;
    if (!buf) {
      buf = await fetchBuffer(coverUrl, {
        signal: opts?.signal,
        referer,
        cookie: cookieForUrl(coverUrl),
        proxyUrlOverride,
      });
    }
    if (!buf?.length || buf.length < MIN_COVER_CACHE_BYTES) {
      return null;
    }
    const ext = coverUrl.match(/\.(jpe?g|png|webp)(\?|$)/i)?.[1]?.toLowerCase() ?? "jpg";
    const dir = path.join(COVERS_DIR, kind);
    ensureDir(dir);
    const filePath = path.join(dir, `${coverCacheStem(code, slot)}.${ext}`);
    fs.writeFileSync(filePath, buf);
    return toProjectRelativePath(filePath);
  } catch {
    return null;
  }
}

/** size 策略：取候选 URL 中体积最大者（HEAD Content-Length，失败则按顺序回退） */
export async function pickLargestCoverUrl(
  urls: string[],
  signal?: AbortSignal,
): Promise<string | null> {
  const unique = [...new Set(urls.filter(Boolean))];
  if (!unique.length) return null;
  if (unique.length === 1) return unique[0]!;

  let best: { url: string; size: number } | null = null;
  for (const url of unique) {
    if (signal?.aborted) break;
    try {
      const { fetchBuffer } = await import("./network/fetch.js");
      // 简化：拉一小段无法 HEAD 时用 GET 长度；undici GET 全量对大图贵，优先尝试 Content-Length via undici request
      const { request } = await import("undici");
      const res = await request(url, {
        method: "HEAD",
        signal: signal ?? AbortSignal.timeout(10000),
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
      });
      await res.body.dump();
      const len = Number(res.headers["content-length"] || 0);
      if (len > 0 && (!best || len > best.size)) best = { url, size: len };
      else if (!best) best = { url, size: 0 };
    } catch {
      if (!best) best = { url, size: 0 };
    }
  }
  return best?.url ?? unique[0]!;
}
