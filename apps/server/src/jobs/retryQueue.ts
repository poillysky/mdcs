import { openDatabase } from "../db/init.js";
import { notifyFileChanges } from "../files/events.js";
import type { KindId, JobRecord, JobStatus } from "../types.js";
import { resumeJob, refreshJobBroadcast } from "./scheduler.js";
import {
  loadJobOptions,
  mergeNumericIds,
  mergePriorityFileIds,
  patchJobOptionsInDb,
} from "./jobOptionsStore.js";
import { normalizeJobOptions } from "./options.js";

export type RescrapeEnqueueResult = {
  updatedIds: number[];
  jobId: string | null;
  /** 并入正在运行的原任务 */
  merged?: boolean;
  /** 拉起已停止的原任务 */
  resumed?: boolean;
  error?: "no_candidates" | "no_origin_job";
};

type FileRetryRow = { id: number; job_id: string | null; kind: KindId };

function rowToJob(row: Record<string, unknown>): JobRecord {
  let options;
  try {
    const raw = row.options_json ? JSON.parse(String(row.options_json)) : {};
    options = normalizeJobOptions(raw);
    if (!Object.keys(options).length) options = undefined;
  } catch {
    options = undefined;
  }
  const triggerRaw = row.trigger_source != null ? String(row.trigger_source).trim() : "manual";
  return {
    id: String(row.id),
    kinds: JSON.parse(String(row.kinds)) as KindId[],
    mode: row.mode as JobRecord["mode"],
    dryRun: Boolean(row.dry_run),
    options,
    triggerSource: triggerRaw === "monitor" ? "monitor" : "manual",
    status: row.status as JobStatus,
    total: Number(row.total),
    processed: Number(row.processed),
    failed: Number(row.failed),
    skipped: Number(row.skipped),
    message: row.message ? String(row.message) : undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function getJobRow(jobId: string): JobRecord | null {
  const db = openDatabase();
  const row = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(jobId) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToJob(row) : null;
}

function listRetryCandidates(ids: number[]): FileRetryRow[] {
  const db = openDatabase();
  const placeholders = ids.map(() => "?").join(",");
  return db
    .prepare(
      `SELECT id, job_id, kind FROM files
       WHERE id IN (${placeholders}) AND status IN ('failed', 'skipped')`,
    )
    .all(...ids) as FileRetryRow[];
}

/** 解析失败记录所属的原任务（优先 file.job_id，否则取同分区最近停止的任务） */
export function resolveOriginJobId(rows: FileRetryRow[]): string | null {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const jobId = row.job_id?.trim();
    if (!jobId) continue;
    counts.set(jobId, (counts.get(jobId) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [jobId, n] of counts) {
    if (n > bestN) {
      best = jobId;
      bestN = n;
    }
  }
  if (best && getJobRow(best)) return best;

  const kinds = [...new Set(rows.map((r) => r.kind))];
  const db = openDatabase();
  const candidates = db
    .prepare(
      `SELECT * FROM jobs
       WHERE mode IN ('full', 'scrape_only')
         AND status IN ('paused', 'cancelled', 'done', 'failed')
       ORDER BY updated_at DESC`,
    )
    .all() as Record<string, unknown>[];

  const kindSet = new Set(kinds);
  for (const row of candidates) {
    const job = rowToJob(row);
    if (job.kinds.some((k) => kindSet.has(k))) return job.id;
  }
  return null;
}

export function findActiveScrapeJob(kinds: KindId[]): JobRecord | null {
  const db = openDatabase();
  const rows = db
    .prepare(
      `SELECT * FROM jobs
       WHERE status IN ('running', 'queued')
         AND mode IN ('full', 'scrape_only')
       ORDER BY CASE WHEN status = 'running' THEN 0 ELSE 1 END, updated_at DESC`,
    )
    .all() as Record<string, unknown>[];

  const kindSet = new Set(kinds);
  for (const row of rows) {
    const job = rowToJob(row);
    if (job.kinds.some((k) => kindSet.has(k))) return job;
  }
  return null;
}

function patchRetryOptions(
  jobId: string,
  fileIds: number[],
  opts: { pauseWhenBatchDone: boolean },
): void {
  const sorted = [...fileIds].filter((id) => Number.isFinite(id)).sort((a, b) => a - b);
  if (!sorted.length) return;
  const current = loadJobOptions(jobId) ?? {};
  const prevSkip = new Set(current.resumeSkipPhases ?? []);
  prevSkip.add("scan");
  prevSkip.add("organize");

  patchJobOptionsInDb(jobId, {
    priorityFileIds: mergePriorityFileIds(current.priorityFileIds, sorted),
    forceScrapeFileIds: mergeNumericIds(current.forceScrapeFileIds, sorted),
    ...(current.fileIds?.length ? { fileIds: mergeNumericIds(current.fileIds, sorted) } : {}),
    ...(opts.pauseWhenBatchDone
      ? {
          retryBatchFileIds: sorted,
          closeWhenRetryBatchDone: true,
          resumeSkipPhases: [...prevSkip],
        }
      : {}),
  });
}

export function mergeRetryIntoActiveJob(jobId: string, fileIds: number[]): string | null {
  patchRetryOptions(jobId, fileIds, { pauseWhenBatchDone: false });
  return jobId;
}

export function resetFilesForRescrape(ids: number[], bindJobId: string | null): number[] {
  const db = openDatabase();
  const stmt = db.prepare(`
    UPDATE files SET
      status = 'indexed',
      error = NULL,
      scraped_at = NULL,
      organized_at = NULL,
      target_path = NULL,
      job_id = @job_id
    WHERE id = @id AND status IN ('failed', 'skipped')
  `);
  const updatedIds: number[] = [];
  for (const id of ids) {
    const r = stmt.run({ id, job_id: bindJobId });
    if (Number(r.changes || 0) > 0) updatedIds.push(id);
  }
  if (updatedIds.length) notifyFileChanges(updatedIds, { reason: "batch" });
  return updatedIds;
}

/** 失败重刮：拉起原任务；运行中则插队优先，已停则恢复并在批次完成后暂停 */
export async function enqueueFailedRescrape(ids: number[]): Promise<RescrapeEnqueueResult> {
  const candidates = listRetryCandidates(ids);
  if (!candidates.length) {
    return { updatedIds: [], jobId: null, error: "no_candidates" };
  }

  const originJobId = resolveOriginJobId(candidates);
  if (!originJobId) {
    return { updatedIds: [], jobId: null, error: "no_origin_job" };
  }

  const originJob = getJobRow(originJobId);
  if (!originJob) {
    return { updatedIds: [], jobId: null, error: "no_origin_job" };
  }

  const updatedIds = resetFilesForRescrape(
    candidates.map((r) => r.id),
    originJobId,
  );
  if (!updatedIds.length) {
    return { updatedIds: [], jobId: null };
  }

  const sortedIds = [...updatedIds].sort((a, b) => a - b);
  const isActive = originJob.status === "running" || originJob.status === "queued";

  if (isActive) {
    mergeRetryIntoActiveJob(originJobId, sortedIds);
    refreshJobBroadcast(originJobId);
    return { updatedIds, jobId: originJobId, merged: true };
  }

  patchRetryOptions(originJobId, sortedIds, { pauseWhenBatchDone: true });
  resumeJob(originJobId);
  refreshJobBroadcast(originJobId);
  return { updatedIds, jobId: originJobId, resumed: true };
}
