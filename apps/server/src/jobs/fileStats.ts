import { openDatabase } from "../db/init.js";
import {
  FILE_PIPELINE_PROCESSING_COUNT_SQL,
  FILE_PIPELINE_WAITING_COUNT_SQL,
} from "../api/files/listFilters.js";
import { buildJobFilesScopeWhere, jobHasBoundedFileScope } from "./jobFilesScope.js";
import { countScopeWalkTotal } from "./scopeWalkTotal.js";
import type { JobRecord } from "../types.js";

export type JobFileStats = {
  /** 磁盘 walk 视频总数（scanPath 存在时）；否则库内范围条数或 job.total */
  total: number;
  /** 任务范围内刮削/整理终态成功（scraped、done）— 库内实数 */
  success: number;
  failed: number;
  /** 等待进入流水线（indexed / pending） */
  queued: number;
  /** 刮削+整理流水线进行中 — 与记录筛选「处理中」一致 */
  processing: number;
  skipped: number;
};

type JobStatsInput = Pick<JobRecord, "id" | "mode" | "total" | "skipped" | "kinds" | "options">;

/** 有界 scanPath/fileIds 范围内库内视频数（展示用索引 total 的兜底） */
export function countScopeIndexTotal(job: JobStatsInput): number | null {
  if (!jobHasBoundedFileScope(job)) return null;
  const scope = buildJobFilesScopeWhere(job);
  if (!scope) return null;

  const db = openDatabase();
  const row = db
    .prepare(`SELECT COUNT(*) AS c FROM files WHERE ${scope.sql}`)
    .get(...scope.params) as { c: number };
  return Number(row.c) || 0;
}

function countScopeProgress(job: JobStatsInput): Pick<JobFileStats, "success" | "failed" | "queued" | "processing"> | null {
  if (!jobHasBoundedFileScope(job)) return null;
  const scope = buildJobFilesScopeWhere(job);
  if (!scope) return null;

  const db = openDatabase();
  const pipelineComplete =
    job.mode === "full" || job.mode === "organize_only";
  const successSql = pipelineComplete
    ? `SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END)`
    : `SUM(CASE WHEN status IN ('scraped', 'done') THEN 1 ELSE 0 END)`;

  if (job.mode === "organize_only") {
    const row = db
      .prepare(
        `SELECT
          SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS success,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
          ${FILE_PIPELINE_WAITING_COUNT_SQL} AS queued,
          ${FILE_PIPELINE_PROCESSING_COUNT_SQL} AS processing
        FROM files WHERE ${scope.sql}`,
      )
      .get(...scope.params) as {
        success: number;
        failed: number;
        processing: number;
        queued: number;
      };
    return {
      success: Number(row.success) || 0,
      failed: Number(row.failed) || 0,
      queued: Number(row.queued) || 0,
      processing: Number(row.processing) || 0,
    };
  }

  const row = db
    .prepare(
      `SELECT
        ${successSql} AS success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
        ${FILE_PIPELINE_WAITING_COUNT_SQL} AS queued,
        ${FILE_PIPELINE_PROCESSING_COUNT_SQL} AS processing
      FROM files WHERE ${scope.sql}`,
    )
    .get(...scope.params) as {
      success: number;
      failed: number;
      queued: number;
      processing: number;
    };
  return {
    success: Number(row.success) || 0,
    failed: Number(row.failed) || 0,
    queued: Number(row.queued) || 0,
    processing: Number(row.processing) || 0,
  };
}

/** 按任务关联文件的真实状态汇总进度 */
export function computeJobFileStats(job: JobStatsInput): JobFileStats {
  const db = openDatabase();
  const pipelineComplete = job.mode === "full" || job.mode === "organize_only";
  const successSql = pipelineComplete
    ? `SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END)`
    : `SUM(CASE WHEN status IN ('scraped', 'done') THEN 1 ELSE 0 END)`;

  const agg = db
    .prepare(
      `SELECT
        COUNT(*) AS touched,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
        ${successSql} AS success,
        ${FILE_PIPELINE_WAITING_COUNT_SQL} AS queued,
        ${FILE_PIPELINE_PROCESSING_COUNT_SQL} AS processing
      FROM files WHERE job_id = ?`,
    )
    .get(job.id) as {
      touched: number;
      failed: number;
      success: number;
      queued: number;
      processing: number;
    };

  const organizeOnly = job.mode === "organize_only";
  let success = Number(agg.success) || 0;
  let failed = Number(agg.failed) || 0;
  let queued = Number(agg.queued) || 0;
  let processing = Number(agg.processing) || 0;
  const touched = Number(agg.touched) || 0;

  if (organizeOnly) {
    const org = db
      .prepare(
        `SELECT
          SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS success,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
          ${FILE_PIPELINE_WAITING_COUNT_SQL} AS queued,
          ${FILE_PIPELINE_PROCESSING_COUNT_SQL} AS processing
        FROM files WHERE job_id = ?`,
      )
      .get(job.id) as { success: number; failed: number; processing: number; queued: number };
    success = Number(org.success) || 0;
    failed = Number(org.failed) || 0;
    processing = Number(org.processing) || 0;
    queued = Number(org.queued) || 0;
  }

  const scopeProgress = countScopeProgress(job);
  if (scopeProgress != null) {
    success = scopeProgress.success;
    failed = scopeProgress.failed;
    queued = scopeProgress.queued;
    processing = scopeProgress.processing;
  } else if (!organizeOnly && job.skipped > 0) {
    success = Math.max(success, (Number(agg.success) || 0) + Number(job.skipped));
  }

  const skipped = job.skipped;

  const scopeIndex = countScopeIndexTotal(job);
  const scopeWalk = countScopeWalkTotal(job);

  let total: number;
  if (scopeWalk != null) {
    total = scopeWalk;
  } else if (scopeIndex != null) {
    total = scopeIndex;
  } else {
    total = job.total > 0 ? job.total : touched + job.skipped;
  }

  if (scopeWalk != null && scopeIndex != null) {
    queued += Math.max(0, scopeWalk - scopeIndex);
  }

  return { total, success, failed, queued, processing, skipped };
}

export function attachFileStats<T extends JobStatsInput>(jobs: T[]): (T & { fileStats: JobFileStats })[] {
  return jobs.map((job) => ({ ...job, fileStats: computeJobFileStats(job) }));
}

export function stripJobFileStats(job: JobRecord): JobRecord {
  const { fileStats: _drop, ...rest } = job;
  return rest;
}

export function enrichJobWithFileStats(job: JobRecord): JobRecord {
  return { ...stripJobFileStats(job), fileStats: computeJobFileStats(job) };
}
