import { openDatabase } from "../db/init.js";
import {
  buildWaitingRevertPatch,
  isFilePipelineInflight,
  isFileTerminalStatus,
  isFileWaitingStatus,
} from "../files/pipelineState.js";
import { notifyFileChanges } from "../files/events.js";
import { deletePipelineHistory } from "../scrape/pipelineProgress.js";
import { hasLocalScrapeSuccess, type ScanEntryRecord } from "./scanner.js";
import type { KindId } from "../types.js";

const ABORT_ERROR_MARKERS = ["任务中断", "已重置为等待", "已重新排队整理"];

type FileAbortRow = {
  id: number;
  kind: string;
  code: string | null;
  status: string;
  file_mtime: number;
  file_size: number;
  scraped_at: number | null;
  organized_at: number | null;
  error: string | null;
  job_id: string | null;
  target_path: string | null;
};

type FileAbortPatch = Pick<
  FileAbortRow,
  "status" | "error" | "scraped_at" | "organized_at" | "target_path" | "job_id"
>;

function isAbortNoise(error: string | null): boolean {
  if (!error?.trim()) return false;
  return ABORT_ERROR_MARKERS.some((m) => error.includes(m));
}

function hadScrapeSuccess(row: FileAbortRow): boolean {
  const entry: ScanEntryRecord = {
    file_mtime: row.file_mtime,
    file_size: row.file_size,
    status: row.status,
    scraped_at: row.scraped_at,
  };
  return hasLocalScrapeSuccess(entry, row.code, row.kind as KindId);
}

/**
 * 任务中断后恢复单条文件。
 * 终态 done/failed/skipped 保留；流水线中途 → 回退 indexed（等待中）。
 */
export function resolveFileStateAfterJobAbort(
  row: FileAbortRow,
  opts: { detachJobId: boolean },
): FileAbortPatch | null {
  const detach = opts.detachJobId;

  if (row.status === "done") {
    if (isAbortNoise(row.error)) {
      return {
        status: row.status,
        error: null,
        scraped_at: row.scraped_at,
        organized_at: row.organized_at,
        target_path: row.target_path,
        job_id: row.job_id,
      };
    }
    return null;
  }

  if (row.status === "failed") {
    if (!detach && !isAbortNoise(row.error)) return null;
    if (!isAbortNoise(row.error)) {
      return {
        status: "failed",
        error: row.error,
        scraped_at: row.scraped_at,
        organized_at: row.organized_at,
        target_path: row.target_path,
        job_id: detach ? null : row.job_id,
      };
    }
    return buildWaitingRevertPatch(row.job_id, detach);
  }

  if (row.status === "skipped") {
    return {
      status: "skipped",
      error: row.error,
      scraped_at: row.scraped_at,
      organized_at: row.organized_at,
      target_path: row.target_path,
      job_id: detach ? null : row.job_id,
    };
  }

  if (isFilePipelineInflight(row.status)) {
    return buildWaitingRevertPatch(row.job_id, detach);
  }

  if (isFileWaitingStatus(row.status)) {
    const patch: FileAbortPatch = {
      status: row.status,
      error: isAbortNoise(row.error) ? null : row.error,
      scraped_at: row.scraped_at,
      organized_at: row.organized_at,
      target_path: row.target_path,
      job_id: detach ? null : row.job_id,
    };
    if (
      patch.error !== row.error ||
      patch.job_id !== row.job_id ||
      patch.scraped_at !== row.scraped_at ||
      patch.organized_at !== row.organized_at ||
      patch.target_path !== row.target_path
    ) {
      return patch;
    }
    return null;
  }

  return null;
}

const ABORT_UPDATE_SQL = `UPDATE files SET
  status = @status,
  error = @error,
  scraped_at = @scraped_at,
  organized_at = @organized_at,
  target_path = @target_path,
  job_id = @job_id
WHERE id = @id`;

function applyAbortPatch(row: FileAbortRow, jobId: string | undefined, patch: FileAbortPatch): boolean {
  if (
    patch.status === row.status &&
    patch.error === row.error &&
    patch.scraped_at === row.scraped_at &&
    patch.organized_at === row.organized_at &&
    patch.target_path === row.target_path &&
    patch.job_id === row.job_id
  ) {
    return false;
  }
  const db = openDatabase();
  db.prepare(ABORT_UPDATE_SQL).run({ id: row.id, ...patch });
  notifyFileChanges(row.id, { kind: row.kind as KindId, jobId, reason: "action" });
  return true;
}

/** 任务取消/停止后：未完成条目回退等待，解除与已取消任务的绑定 */
export function reconcileJobFilesAfterAbort(
  jobId: string,
  opts: { detachJobId: boolean },
): number {
  const db = openDatabase();
  const rows = db
    .prepare(
      `SELECT id, kind, code, status, file_mtime, file_size, scraped_at, organized_at, error, job_id, target_path
       FROM files WHERE job_id = ?`,
    )
    .all(jobId) as FileAbortRow[];

  let changed = 0;
  for (const row of rows) {
    const next = resolveFileStateAfterJobAbort(row, opts);
    if (!next) continue;
    if (applyAbortPatch(row, jobId, next)) changed += 1;
  }
  return changed;
}

/** 回收单条流水线中途状态，回退等待 */
export function releaseInflightFileState(fileId: number, detachJobId = false): boolean {
  const db = openDatabase();
  const row = db
    .prepare(
      `SELECT id, kind, code, status, file_mtime, file_size, scraped_at, organized_at, error, job_id, target_path
       FROM files WHERE id = ?`,
    )
    .get(fileId) as FileAbortRow | undefined;
  if (!row) return false;
  if (isFileTerminalStatus(row.status)) return false;

  const next = resolveFileStateAfterJobAbort(row, { detachJobId });
  if (!next) return false;

  return applyAbortPatch(row, row.job_id ?? undefined, next);
}

/** 仅回收 scraping/organizing 卡住项；已 scraped/planned/done 不动 */
export function releaseStuckInflightFileState(fileId: number, detachJobId = false): boolean {
  const db = openDatabase();
  const row = db
    .prepare(`SELECT id, status, scraped_at, organized_at FROM files WHERE id = ?`)
    .get(fileId) as
    | { id: number; status: string; scraped_at: number | null; organized_at: number | null }
    | undefined;
  if (!row) return false;
  const stuckScraping = row.status === "scraping" && row.scraped_at == null;
  const stuckOrganizing = row.status === "organizing" && row.organized_at == null;
  if (!stuckScraping && !stuckOrganizing) return false;
  return releaseInflightFileState(fileId, detachJobId);
}

/** 修复 scraped_at / organized_at 已写入但 status 未更新的残留 */
export function recoverStaleInflightStatuses(): number {
  const db = openDatabase();
  const scraped = db
    .prepare(`UPDATE files SET status = 'scraped' WHERE status = 'scraping' AND scraped_at IS NOT NULL`)
    .run();
  const done = db
    .prepare(`UPDATE files SET status = 'done' WHERE status = 'organizing' AND organized_at IS NOT NULL`)
    .run();
  return Number(scraped.changes ?? 0) + Number(done.changes ?? 0);
}

/** 将 scrape_cache 已成功但 files 仍停留在 indexed/pending 的记录同步为 scraped（仅任务刮削批次内） */
export function reconcileScrapeCacheSuccessStates(jobId?: string): number {
  const db = openDatabase();
  const rows = jobId
    ? (db
        .prepare(
          `SELECT id, kind, code, status, file_mtime, file_size, scraped_at, organized_at, error, job_id, target_path
           FROM files
           WHERE job_id = ? AND status IN ('indexed', 'pending')`,
        )
        .all(jobId) as FileAbortRow[])
    : (db
        .prepare(
          `SELECT id, kind, code, status, file_mtime, file_size, scraped_at, organized_at, error, job_id, target_path
           FROM files
           WHERE status IN ('indexed', 'pending')`,
        )
        .all() as FileAbortRow[]);

  let changed = 0;
  for (const row of rows) {
    if (!hadScrapeSuccess(row)) continue;
    const patch: FileAbortPatch = {
      status: "scraped",
      error: null,
      scraped_at: row.scraped_at ?? Date.now(),
      organized_at: row.organized_at,
      target_path: row.target_path,
      job_id: row.job_id,
    };
    if (applyAbortPatch(row, row.job_id ?? undefined, patch)) changed += 1;
  }
  return changed;
}

/** 整理阶段结束后：仍为 scraped/planned 的条目标为失败（全流程须 done 或 failed） */
export function failJobScrapedWithoutDone(jobId: string, message = "整理阶段未完成"): number {
  const db = openDatabase();
  const ids = db
    .prepare(`SELECT id FROM files WHERE job_id = ? AND status IN ('scraped', 'planned')`)
    .all(jobId) as Array<{ id: number }>;
  if (!ids.length) return 0;
  const result = db
    .prepare(
      `UPDATE files
       SET status = 'failed',
           error = CASE WHEN error IS NULL OR error = '' THEN ? ELSE error END,
           organized_at = NULL
       WHERE job_id = ? AND status IN ('scraped', 'planned')`,
    )
    .run(message, jobId);
  const changed = Number(result.changes) || 0;
  if (changed > 0) {
    notifyFileChanges(
      ids.map((r) => r.id),
      { jobId, reason: "action" },
    );
  }
  return changed;
}

/** 回收任务下所有未完成文件（含慢池未纳入本批 rows 的条目） */
export function releaseJobInflightFiles(jobId: string, detachJobId = false): number {
  const db = openDatabase();
  const ids = db
    .prepare(
      `SELECT id FROM files WHERE job_id = ? AND status NOT IN ('done', 'failed', 'skipped')`,
    )
    .all(jobId) as Array<{ id: number }>;
  let changed = 0;
  for (const { id } of ids) {
    if (releaseInflightFileState(id, detachJobId)) changed += 1;
  }
  return changed;
}

const ACTIVE_JOB_STATUSES_SQL = `('running', 'queued')`;

/**
 * 回收「无有效任务」仍停留在流水线中途的文件（任务已删/已结束/已暂停等）。
 * 避免记录页长期显示「处理中」。
 */
export function revertOrphanPipelineFiles(): number {
  const db = openDatabase();
  const rows = db
    .prepare(
      `SELECT f.id, f.kind, f.code, f.status, f.file_mtime, f.file_size,
              f.scraped_at, f.organized_at, f.error, f.job_id, f.target_path
       FROM files f
       LEFT JOIN jobs j ON j.id = f.job_id
       WHERE f.status IN ('scraping', 'scraped', 'planned', 'organizing')
         AND (
           f.job_id IS NULL OR f.job_id = ''
           OR j.id IS NULL
           OR j.status NOT IN ${ACTIVE_JOB_STATUSES_SQL}
         )`,
    )
    .all() as FileAbortRow[];

  let changed = 0;
  for (const row of rows) {
    if (releaseInflightFileState(row.id, true)) changed += 1;
  }
  return changed;
}

/**
 * 刮削记录删除：
 * - 等待中 (indexed/pending) → 不操作（保留索引行）
 * - 其他状态 → 回退 indexed（等待中），保留索引行
 */
export function deleteOrRevertFileRecord(
  fileId: number,
): "reverted" | "skipped" | "missing" {
  const db = openDatabase();
  const row = db
    .prepare(`SELECT id, kind, status FROM files WHERE id = ?`)
    .get(fileId) as { id: number; kind: string; status: string } | undefined;
  if (!row) return "missing";

  if (isFileWaitingStatus(row.status)) {
    return "skipped";
  }

  deletePipelineHistory(fileId);

  const result = db
    .prepare(
      `UPDATE files SET
         status = 'indexed',
         error = NULL,
         scraped_at = NULL,
         organized_at = NULL,
         target_path = NULL,
         job_id = NULL
       WHERE id = ?`,
    )
    .run(fileId);
  if (Number(result.changes || 0) > 0) {
    notifyFileChanges(fileId, { kind: row.kind as KindId, reason: "action" });
    return "reverted";
  }
  return "missing";
}
