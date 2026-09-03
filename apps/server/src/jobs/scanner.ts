import fs from "node:fs";
import path from "node:path";
import { loadLibrariesConfig, getPathRoot } from "../config/loadConfig.js";
import { loadScrapeConfig } from "../config/loadScrape.js";
import { openDatabase } from "../db/init.js";
import { classifyFromPath, resolveFileKind } from "../library/classify.js";
import { identifyFromFileName, stripJunkFilters } from "../library/identify.js";
import {
  organizeWalkFilter,
  passesMinSize,
  walkVideoFiles,
  walkVideoFilesAsync,
} from "../library/scanFilter.js";
import { pathExists, resolveFromRoot, toPosixRelative } from "../paths.js";
import { notifyFileChanges } from "../files/events.js";
import { readScrapeCache } from "../scrape/cache.js";
import { assertRelativePathAllowed, normalizeRelativePath } from "../security/pathPolicy.js";
import type { KindId, ResolvedKind, ScanResult } from "../types.js";

const BATCH = 500;

export type ScanProgress = {
  /** walk 到的视频文件总数（扫描范围完整规模） */
  discovered: number;
  skipped: number;
  indexed: number;
};

function emitScanProgress(
  opts: { onProgress?: (stats: ScanProgress) => void } | undefined,
  discovered: number,
  skipped: number,
  indexed: number,
) {
  opts?.onProgress?.({ discovered, skipped, indexed });
}

/** 文件内容变化时，这些终态应回到 indexed 以便重新刮削 */
export function scanUpdateShouldReindex(status: string): boolean {
  return (
    status === "done" ||
    status === "scraped" ||
    status === "failed" ||
    status === "planned" ||
    status === "organizing"
  );
}

/** 解析本次扫描目录（须在分区 sourceRoot 之下） */
export function resolveKindScanAbs(kind: ResolvedKind, scanPath?: string): string {
  if (!kind.sourceAbs) {
    throw new Error("分区未绑定来源目录");
  }
  const rel = scanPath?.trim() ? normalizeRelativePath(scanPath) : "";
  if (!rel) return kind.sourceAbs;
  assertRelativePathAllowed(rel);
  const sourceRel = normalizeRelativePath(kind.sourceRoot || "");
  if (!sourceRel) {
    throw new Error("分区未绑定来源目录");
  }
  if (rel !== sourceRel && !rel.startsWith(`${sourceRel}/`)) {
    throw new Error("扫描路径必须在分区来源目录下");
  }
  const abs = resolveFromRoot(rel, getPathRoot());
  if (!pathExists(abs) || !fs.statSync(abs).isDirectory()) {
    throw new Error("扫描目录不存在");
  }
  return abs;
}

export type ScanEntryRecord = {
  file_mtime: number;
  file_size: number;
  status: string;
  scraped_at: number | null;
};

/** 本地是否已有刮削成功记录（DB 终态或 scrape_cache / meta JSON） */
export function hasLocalScrapeSuccess(
  existing: ScanEntryRecord,
  code: string | null,
  kind: KindId,
): boolean {
  if (existing.status === "done" || existing.status === "scraped") {
    if (existing.scraped_at != null) return true;
  }
  const trimmed = code?.trim();
  if (trimmed) {
    const cached = readScrapeCache(trimmed, kind);
    if (cached?.ok) return true;
  }
  return false;
}

/** 磁盘文件未变时，仅当已有刮削成功记录才跳过；否则继续入库/刷新状态 */
export function shouldSkipScanEntry(
  existing: ScanEntryRecord | undefined,
  mtimeMs: number,
  size: number,
  force = false,
  ctx?: { code: string | null; kind: KindId },
): boolean {
  if (force || !existing) return false;
  if (existing.file_mtime !== Math.floor(mtimeMs) || existing.file_size !== size) return false;
  if (!ctx?.kind) return false;
  return hasLocalScrapeSuccess(existing, ctx.code ?? null, ctx.kind);
}

export function scanKind(
  kind: ResolvedKind,
  projectRoot: string,
  opts?: {
    force?: boolean;
    jobId?: string;
    scanAbs?: string;
    onProgress?: (stats: ScanProgress) => void;
  },
): ScanResult {
  const scanRoot = opts?.scanAbs || kind.sourceAbs;
  if (!scanRoot) {
    return { kind: kind.id, scanned: 0, inserted: 0, updated: 0, skipped: 0 };
  }
  const libraries = loadLibrariesConfig();
  const org = libraries.organize;
  const filter = organizeWalkFilter(org);
  const junkFilters = org.junkFilters || [];
  const crackKeywords = org.crackKeywords || [];
  const recognitionWords = loadScrapeConfig().recognitionWords;
  const jobId = opts?.jobId?.trim() || null;

  const db = openDatabase();
  const files = walkVideoFiles(scanRoot, filter);
  emitScanProgress(opts, files.length, 0, 0);
  const upsert = db.prepare(`
    INSERT INTO files (
      kind, source_path, file_name, file_size, file_mtime, code, cd_index, mosaic, status, job_id
    ) VALUES (
      @kind, @source_path, @file_name, @file_size, @file_mtime, @code, @cd_index, @mosaic, 'indexed', @job_id
    )
    ON CONFLICT(source_path) DO UPDATE SET
      file_name = excluded.file_name,
      file_size = excluded.file_size,
      file_mtime = excluded.file_mtime,
      code = excluded.code,
      cd_index = excluded.cd_index,
      mosaic = excluded.mosaic,
      kind = excluded.kind,
      job_id = COALESCE(excluded.job_id, files.job_id),
      status = CASE
        WHEN files.status IN ('done', 'scraped') AND files.scraped_at IS NOT NULL THEN files.status
        WHEN files.status IN ('done', 'scraped', 'failed', 'planned', 'organizing') THEN 'indexed'
        ELSE files.status
      END,
      error = CASE
        WHEN files.status IN ('done', 'scraped') AND files.scraped_at IS NOT NULL THEN files.error
        WHEN files.status IN ('done', 'scraped', 'failed', 'planned', 'organizing') THEN NULL
        ELSE files.error
      END,
      scraped_at = CASE
        WHEN files.status IN ('done', 'scraped') AND files.scraped_at IS NOT NULL THEN files.scraped_at
        WHEN files.status IN ('done', 'scraped', 'failed', 'planned', 'organizing') THEN NULL
        ELSE files.scraped_at
      END,
      organized_at = CASE
        WHEN files.status IN ('done', 'scraped') AND files.scraped_at IS NOT NULL THEN files.organized_at
        WHEN files.status IN ('done', 'scraped', 'failed', 'planned', 'organizing') THEN NULL
        ELSE files.organized_at
      END,
      target_path = CASE
        WHEN files.status IN ('done', 'scraped') AND files.scraped_at IS NOT NULL THEN files.target_path
        WHEN files.status IN ('done', 'scraped', 'failed', 'planned', 'organizing') THEN NULL
        ELSE files.target_path
      END
  `);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files[i] ? files.slice(i, i + BATCH) : [];
    const changedRels: string[] = [];
    db.exec("BEGIN");
    try {
      for (const abs of batch) {
        const st = fs.statSync(abs);
        if (!passesMinSize(abs, filter.minBytes)) {
          skipped += 1;
          continue;
        }
        const rel = toPosixRelative(abs, projectRoot);
        const mtime = Math.floor(st.mtimeMs);
        const fileName = path.basename(abs);
        const cleanedName = stripJunkFilters(fileName, junkFilters);
        const { code, cdIndex } = identifyFromFileName(cleanedName);
        const classified = classifyFromPath(rel, fileName, code, crackKeywords, recognitionWords);
        const fileKind = resolveFileKind(kind.id as KindId, classified);
        const existing = db
          .prepare(
            `SELECT id, file_mtime, file_size, status, scraped_at FROM files WHERE source_path = ?`,
          )
          .get(rel) as
          | {
              id: number;
              file_mtime: number;
              file_size: number;
              status: string;
              scraped_at: number | null;
            }
          | undefined;

        if (
          shouldSkipScanEntry(existing, st.mtimeMs, st.size, Boolean(opts?.force), {
            code,
            kind: fileKind,
          })
        ) {
          skipped += 1;
          continue;
        }

        upsert.run({
          kind: fileKind,
          source_path: rel,
          file_name: fileName,
          file_size: st.size,
          file_mtime: mtime,
          code,
          cd_index: cdIndex,
          mosaic: classified.mosaic,
          job_id: jobId,
        });

        if (!existing) inserted += 1;
        else updated += 1;
        changedRels.push(rel);
      }
      db.exec("COMMIT");
      notifyScanBatch(db, changedRels, kind.id as KindId, jobId);
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    emitScanProgress(opts, files.length, skipped, inserted + updated);
  }

  return {
    kind: kind.id,
    scanned: files.length,
    inserted,
    updated,
    skipped,
  };
}

function notifyScanBatch(
  db: ReturnType<typeof openDatabase>,
  rels: string[],
  kindId: KindId,
  jobId: string | null,
  opts?: { notify?: boolean },
) {
  if (opts?.notify === false || !rels.length) return;
  const ids = rels
    .map((rel) =>
      db.prepare(`SELECT id FROM files WHERE source_path = ?`).get(rel) as { id: number } | undefined,
    )
    .filter((row): row is { id: number } => Boolean(row?.id))
    .map((row) => row.id);
  if (ids.length) notifyFileChanges(ids, { kind: kindId, jobId: jobId ?? undefined, reason: "scan" });
}

function yieldEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/** 异步扫描：每批入库后让出事件循环，避免阻塞 HTTP 与其它任务 */
export async function scanKindAsync(
  kind: ResolvedKind,
  projectRoot: string,
  opts?: {
    force?: boolean;
    jobId?: string;
    scanAbs?: string;
    signal?: AbortSignal;
    /** 全量扫描时关闭逐批 WS 推送，避免前端/接口被拖死 */
    notifyChanges?: boolean;
    onProgress?: (stats: ScanProgress) => void;
  },
): Promise<ScanResult> {
  const scanRoot = opts?.scanAbs || kind.sourceAbs;
  if (!scanRoot) {
    return { kind: kind.id, scanned: 0, inserted: 0, updated: 0, skipped: 0 };
  }
  const libraries = loadLibrariesConfig();
  const org = libraries.organize;
  const filter = organizeWalkFilter(org);
  const junkFilters = org.junkFilters || [];
  const crackKeywords = org.crackKeywords || [];
  const recognitionWords = loadScrapeConfig().recognitionWords;
  const jobId = opts?.jobId?.trim() || null;
  const notifyChanges = opts?.notifyChanges !== false;

  const db = openDatabase();
  const files = await walkVideoFilesAsync(scanRoot, filter, {
    signal: opts?.signal,
    onDiscovered: (count) => emitScanProgress(opts, count, 0, 0),
  });
  emitScanProgress(opts, files.length, 0, 0);
  const upsert = db.prepare(`
    INSERT INTO files (
      kind, source_path, file_name, file_size, file_mtime, code, cd_index, mosaic, status, job_id
    ) VALUES (
      @kind, @source_path, @file_name, @file_size, @file_mtime, @code, @cd_index, @mosaic, 'indexed', @job_id
    )
    ON CONFLICT(source_path) DO UPDATE SET
      file_name = excluded.file_name,
      file_size = excluded.file_size,
      file_mtime = excluded.file_mtime,
      code = excluded.code,
      cd_index = excluded.cd_index,
      mosaic = excluded.mosaic,
      kind = excluded.kind,
      job_id = COALESCE(excluded.job_id, files.job_id),
      status = CASE
        WHEN files.status IN ('done', 'scraped') AND files.scraped_at IS NOT NULL THEN files.status
        WHEN files.status IN ('done', 'scraped', 'failed', 'planned', 'organizing') THEN 'indexed'
        ELSE files.status
      END,
      error = CASE
        WHEN files.status IN ('done', 'scraped') AND files.scraped_at IS NOT NULL THEN files.error
        WHEN files.status IN ('done', 'scraped', 'failed', 'planned', 'organizing') THEN NULL
        ELSE files.error
      END,
      scraped_at = CASE
        WHEN files.status IN ('done', 'scraped') AND files.scraped_at IS NOT NULL THEN files.scraped_at
        WHEN files.status IN ('done', 'scraped', 'failed', 'planned', 'organizing') THEN NULL
        ELSE files.scraped_at
      END,
      organized_at = CASE
        WHEN files.status IN ('done', 'scraped') AND files.scraped_at IS NOT NULL THEN files.organized_at
        WHEN files.status IN ('done', 'scraped', 'failed', 'planned', 'organizing') THEN NULL
        ELSE files.organized_at
      END,
      target_path = CASE
        WHEN files.status IN ('done', 'scraped') AND files.scraped_at IS NOT NULL THEN files.target_path
        WHEN files.status IN ('done', 'scraped', 'failed', 'planned', 'organizing') THEN NULL
        ELSE files.target_path
      END
  `);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < files.length; i += BATCH) {
    if (opts?.signal?.aborted) break;
    const batch = files[i] ? files.slice(i, i + BATCH) : [];
    const changedRels: string[] = [];
    db.exec("BEGIN");
    try {
      for (const abs of batch) {
        const st = fs.statSync(abs);
        if (!passesMinSize(abs, filter.minBytes)) {
          skipped += 1;
          continue;
        }
        const rel = toPosixRelative(abs, projectRoot);
        const mtime = Math.floor(st.mtimeMs);
        const fileName = path.basename(abs);
        const cleanedName = stripJunkFilters(fileName, junkFilters);
        const { code, cdIndex } = identifyFromFileName(cleanedName);
        const classified = classifyFromPath(rel, fileName, code, crackKeywords, recognitionWords);
        const fileKind = resolveFileKind(kind.id as KindId, classified);
        const existing = db
          .prepare(
            `SELECT id, file_mtime, file_size, status, scraped_at FROM files WHERE source_path = ?`,
          )
          .get(rel) as
          | {
              id: number;
              file_mtime: number;
              file_size: number;
              status: string;
              scraped_at: number | null;
            }
          | undefined;

        if (
          shouldSkipScanEntry(existing, st.mtimeMs, st.size, Boolean(opts?.force), {
            code,
            kind: fileKind,
          })
        ) {
          skipped += 1;
          continue;
        }

        upsert.run({
          kind: fileKind,
          source_path: rel,
          file_name: fileName,
          file_size: st.size,
          file_mtime: mtime,
          code,
          cd_index: cdIndex,
          mosaic: classified.mosaic,
          job_id: jobId,
        });

        if (!existing) inserted += 1;
        else updated += 1;
        changedRels.push(rel);
      }
      db.exec("COMMIT");
      notifyScanBatch(db, changedRels, kind.id as KindId, jobId, { notify: notifyChanges });
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    emitScanProgress(opts, files.length, skipped, inserted + updated);
    await yieldEventLoop();
  }

  return {
    kind: kind.id,
    scanned: files.length,
    inserted,
    updated,
    skipped,
  };
}
