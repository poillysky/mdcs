import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { pickKinds } from "../config/loadConfig.js";
import { openDatabase } from "../db/init.js";
import { PROJECT_ROOT } from "../paths.js";
import { scanKind, scanKindAsync, resolveKindScanAbs, type ScanProgress } from "./scanner.js";
import { runScrapeDrainForKinds } from "../scrape/runner.js";
import { runOrganizeForKinds } from "../organize/runner.js";
import { normalizeJobOptions, type JobOptions } from "./options.js";
import {
  attachFileStats,
  computeJobFileStats,
  countScopeIndexTotal,
  enrichJobWithFileStats,
  stripJobFileStats,
} from "./fileStats.js";
import { reconcileJobFilesAfterAbort, releaseJobInflightFiles, reconcileScrapeCacheSuccessStates, failJobScrapedWithoutDone } from "./jobFiles.js";
import { areJobFileIdsTerminal, areRetryBatchTerminal, clearRetryBatchMarkers } from "./jobOptionsStore.js";
import { countScopeWalkTotal, invalidateScopeWalkCache } from "./scopeWalkTotal.js";
import { dispatchJobWebhooks } from "../ops/webhook.js";
import { loadOpsConfig, saveOpsConfig } from "../ops/loadOps.js";
import type {
  JobEvent,
  JobMode,
  JobRecord,
  JobStatus,
  JobTriggerSource,
  KindId,
  ScanResult,
} from "../types.js";

export type CreateJobInput = {
  kinds?: string[];
  mode: JobMode;
  dryRun?: boolean;
  options?: JobOptions;
  triggerSource?: JobTriggerSource;
  /** 是否写入「复用上次」快照；监控自动任务应关 */
  remember?: boolean;
};

const emitter = new EventEmitter();
const running = new Map<string, AbortController>();

function now() {
  return Date.now();
}

function emit(event: JobEvent) {
  emitter.emit("event", event);
}

function emitJobUpdate(job: JobRecord) {
  emitter.emit("job_update", enrichJobWithFileStats(job));
}

export function onJobUpdate(listener: (job: JobRecord) => void): () => void {
  emitter.on("job_update", listener);
  return () => emitter.off("job_update", listener);
}

function rowToJob(row: Record<string, unknown>): JobRecord {
  let options: JobOptions | undefined;
  try {
    const raw = row.options_json ? JSON.parse(String(row.options_json)) : {};
    options = normalizeJobOptions(raw);
    if (!Object.keys(options).length) options = undefined;
  } catch {
    options = undefined;
  }
  const triggerRaw = row.trigger_source != null ? String(row.trigger_source).trim() : "manual";
  const triggerSource: JobTriggerSource = triggerRaw === "monitor" ? "monitor" : "manual";
  return {
    id: String(row.id),
    kinds: JSON.parse(String(row.kinds)) as KindId[],
    mode: row.mode as JobMode,
    dryRun: Boolean(row.dry_run),
    options,
    triggerSource,
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

export function onJobEvent(listener: (event: JobEvent) => void): () => void {
  emitter.on("event", listener);
  return () => emitter.off("event", listener);
}

function getJobRaw(jobId: string): JobRecord | null {
  const db = openDatabase();
  const row = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(jobId) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToJob(row) : null;
}

export function getJob(jobId: string): JobRecord | null {
  const job = getJobRaw(jobId);
  return job ? enrichJobWithFileStats(job) : null;
}

/** 任务 options 变更后刷新订阅方（如失败重刮插队） */
export function refreshJobBroadcast(jobId: string): void {
  const job = getJob(jobId);
  if (job) emitJobUpdate(job);
}

export type JobQuery = {
  status?: string;
  mode?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

export function queryJobs(opts: JobQuery = {}): {
  jobs: JobRecord[];
  total: number;
  page: number;
  pageSize: number;
} {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const where: string[] = [];
  const params: (string | number)[] = [];

  if (opts.status) {
    where.push("status = ?");
    params.push(opts.status);
  }
  if (opts.mode) {
    where.push("mode = ?");
    params.push(opts.mode);
  }
  if (opts.q?.trim()) {
    where.push("(id LIKE ? OR IFNULL(message, '') LIKE ?)");
    const like = `%${opts.q.trim()}%`;
    params.push(like, like);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const db = openDatabase();

  const total = (
    db.prepare(`SELECT COUNT(*) AS c FROM jobs ${whereSql}`).get(...params) as { c: number }
  ).c;

  const rows = db
    .prepare(`SELECT * FROM jobs ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset) as Record<string, unknown>[];

  return { jobs: attachFileStats(rows.map(rowToJob)), total, page, pageSize };
}

export function listJobs(limit = 20): JobRecord[] {
  return queryJobs({ pageSize: limit }).jobs;
}

function updateJob(jobId: string, patch: Partial<JobRecord> & { message?: string }) {
  const db = openDatabase();
  const current = getJobRaw(jobId);
  if (!current) return;
  const next = { ...current, ...patch, updatedAt: now() };
  const fs = computeJobFileStats(next);
  next.processed = fs.success + fs.failed;
  next.failed = Math.max(next.failed, fs.failed);
  if (patch.total !== undefined) {
    next.total = patch.total;
  }
  db.prepare(`
    UPDATE jobs SET
      status = @status,
      total = @total,
      processed = @processed,
      failed = @failed,
      skipped = @skipped,
      message = @message,
      updated_at = @updated_at
    WHERE id = @id
  `).run({
    id: next.id,
    status: next.status,
    total: next.total,
    processed: next.processed,
    failed: next.failed,
    skipped: next.skipped,
    message: next.message ?? null,
    updated_at: next.updatedAt,
  });
  emitJobUpdate(next);
}

function throttleScanProgress(
  onProgress: (stats: ScanProgress) => void,
  intervalMs = 1000,
): (stats: ScanProgress) => void {
  let lastAt = 0;
  return (stats) => {
    const t = Date.now();
    if (t - lastAt < intervalMs) return;
    lastAt = t;
    onProgress(stats);
  };
}

type JobPhase = "scan" | "scrape" | "organize";

function patchJobOptions(jobId: string, patch: JobOptions): JobOptions | undefined {
  const current = getJobRaw(jobId);
  if (!current) return undefined;
  const options = { ...(current.options ?? {}), ...patch };
  const db = openDatabase();
  db.prepare(`UPDATE jobs SET options_json = ?, updated_at = ? WHERE id = ?`).run(
    JSON.stringify(options),
    now(),
    jobId,
  );
  return options;
}

function markPhaseComplete(jobId: string, phase: JobPhase): void {
  const job = getJobRaw(jobId);
  if (!job) return;
  const prev = job.options?.resumeSkipPhases ?? [];
  if (prev.includes(phase)) return;
  patchJobOptions(jobId, { resumeSkipPhases: [...prev, phase] });
}

function clearResumeSkipPhases(jobId: string): void {
  const job = getJobRaw(jobId);
  if (!job?.options?.resumeSkipPhases?.length) return;
  const { resumeSkipPhases: _drop, ...rest } = job.options;
  const db = openDatabase();
  db.prepare(`UPDATE jobs SET options_json = ?, updated_at = ? WHERE id = ?`).run(
    JSON.stringify(rest),
    now(),
    jobId,
  );
}

export async function createJob(input: CreateJobInput): Promise<JobRecord> {
  const kinds = pickKinds(input.kinds);
  if (!kinds.length) throw new Error("没有可用的分区（请检查 enabled 与 kinds 参数）");

  const id = `job_${now()}_${randomUUID().slice(0, 8)}`;
  const ts = now();
  const triggerSource: JobTriggerSource = input.triggerSource ?? "manual";
  const job: JobRecord = {
    id,
    kinds: kinds.map((k) => k.id),
    mode: input.mode,
    dryRun: Boolean(input.dryRun),
    options: normalizeJobOptions(input.options),
    triggerSource,
    status: "queued",
    total: 0,
    processed: 0,
    failed: 0,
    skipped: 0,
    createdAt: ts,
    updatedAt: ts,
  };

  const db = openDatabase();
  db.prepare(`
    INSERT INTO jobs (id, kinds, mode, dry_run, status, total, processed, failed, skipped, options_json, trigger_source, created_at, updated_at)
    VALUES (@id, @kinds, @mode, @dry_run, @status, @total, @processed, @failed, @skipped, @options_json, @trigger_source, @created_at, @updated_at)
  `).run({
    id: job.id,
    kinds: JSON.stringify(job.kinds),
    mode: job.mode,
    dry_run: job.dryRun ? 1 : 0,
    status: job.status,
    total: job.total,
    processed: job.processed,
    failed: job.failed,
    skipped: job.skipped,
    options_json: JSON.stringify(job.options ?? {}),
    trigger_source: job.triggerSource,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
  });

  if (input.remember !== false) {
    const kindsArg = Array.isArray(input.kinds) && input.kinds.length ? input.kinds : ["*enabled"];
    const lastJob = {
      kinds: kindsArg.map(String),
      mode: job.mode,
      dryRun: job.dryRun,
      options: (job.options ?? {}) as Record<string, unknown>,
      savedAt: ts,
    };
    setTimeout(() => {
      try {
        const cfg = loadOpsConfig();
        saveOpsConfig({ ...cfg, lastJob });
      } catch {
        /* 记忆失败不阻断建任务 */
      }
    }, 0);
  }

  emitJobUpdate(job);

  scheduleRunJob(job.id);

  return enrichJobWithFileStats(job);
}

function scheduleRunJob(jobId: string): void {
  // 延迟到下一轮事件循环，确保 POST /api/jobs 先返回再跑重扫描
  setTimeout(() => {
    void runJob(jobId).catch((err) => {
      updateJob(jobId, {
        status: "failed",
        message: err instanceof Error ? err.message : String(err),
      });
      emit({
        ts: new Date().toISOString(),
        level: "error",
        text: `任务失败: ${jobId}`,
        jobId,
      });
    });
  });
}

export async function runJob(jobId: string): Promise<void> {
  const job = getJob(jobId);
  if (!job) throw new Error("任务不存在");

  const ac = new AbortController();
  running.set(jobId, ac);

  const kinds = pickKinds(job.kinds);
  const results: ScanResult[] = [];
  let totalScanned = 0;
  let scanSkipped = 0;
  let failed = 0;
  let organizeProcessed = 0;
  const skipPhases = new Set(job.options?.resumeSkipPhases ?? []);
  const shouldScan =
    (job.mode === "scan_only" || job.mode === "full" || job.mode === "rescan") &&
    !skipPhases.has("scan");
  const shouldScrape =
    (job.mode === "scrape_only" || job.mode === "full") && !skipPhases.has("scrape");
  const parallelScanScrape = job.mode === "full" && shouldScan && shouldScrape;

  if (shouldScan) {
    invalidateScopeWalkCache(job);
    const startTotal = Math.max(
      countScopeWalkTotal(job, { fresh: true }) ?? 0,
      countScopeIndexTotal(job) ?? 0,
    );
    updateJob(jobId, {
      status: "running",
      skipped: 0,
      total: startTotal,
    });
  } else if (job.mode === "scrape_only") {
    const fileIds = Array.isArray(job.options?.fileIds)
      ? job.options.fileIds.filter((id): id is number => Number.isFinite(id))
      : [];
    const startTotal = Math.max(
      countScopeWalkTotal(job, { fresh: true }) ?? 0,
      countScopeIndexTotal(job) ?? 0,
    );
    updateJob(jobId, {
      status: "running",
      ...(fileIds.length
        ? { total: fileIds.length }
        : startTotal > 0
          ? { total: startTotal }
          : {}),
    });
  } else {
    invalidateScopeWalkCache(job);
    const startTotal = Math.max(
      countScopeWalkTotal(job, { fresh: true }) ?? 0,
      countScopeIndexTotal(job) ?? 0,
    );
    updateJob(jobId, {
      status: "running",
      ...(startTotal > 0 &&
      (job.mode === "full" || job.mode === "scan_only" || job.mode === "rescan")
        ? { total: startTotal }
        : {}),
    });
  }
  emit({ ts: new Date().toISOString(), level: "info", text: "任务开始", jobId });

  const shouldStopScrapeDrain = () => {
    const fresh = getJobRaw(jobId);
    if (!fresh?.options) return false;
    if (fresh.options.closeWhenRetryBatchDone) {
      return areRetryBatchTerminal(fresh.options);
    }
    return Boolean(
      fresh.options.closeWhenFileIdsDone && areJobFileIdsTerminal(fresh.options),
    );
  };

  const pauseRetryBatchIfDone = (): boolean => {
    const fresh = getJobRaw(jobId);
    if (!fresh?.options?.closeWhenRetryBatchDone) return false;
    if (!areRetryBatchTerminal(fresh.options)) return false;
    clearRetryBatchMarkers(jobId);
    updateJob(jobId, {
      status: "paused",
      message: "失败重刮已完成，任务已暂停",
    });
    emit({
      ts: new Date().toISOString(),
      level: "info",
      text: "失败重刮批次完成，任务已暂停",
      jobId,
    });
    return true;
  };

  try {
    if (parallelScanScrape) {
      const kindIds = kinds.map((k) => k.id);
      let scanComplete = false;

      emit({
        ts: new Date().toISOString(),
        level: "info",
        text: "索引与刮削并行执行",
        jobId,
      });

      const scrapePromise = runScrapeDrainForKinds(kindIds, {
        signal: ac.signal,
        jobId,
        force: Boolean(job.options?.forceScrape),
        jobOptions: job.options,
        chainOrganize: job.mode === "full",
        dryRun: job.dryRun,
        isScanComplete: () => scanComplete,
        onBatch: () => {
          reconcileScrapeCacheSuccessStates(jobId);
          updateJob(jobId, { skipped: scanSkipped, failed });
        },
        shouldStopDrain: shouldStopScrapeDrain,
        onProgress: (text) =>
          emit({
            ts: new Date().toISOString(),
            level: "info",
            text,
            jobId,
          }),
      });

      try {
        for (const kind of kinds) {
          if (ac.signal.aborted) break;
          const scanPath =
            typeof job.options?.scanPath === "string" ? job.options.scanPath.trim() : "";
          const scanLabel = scanPath || kind.sourceRoot;
          emit({
            ts: new Date().toISOString(),
            level: "info",
            text: `扫描 ${kind.label} (${scanLabel})`,
            jobId,
            kind: kind.id,
          });
          const scanAbs = scanPath ? resolveKindScanAbs(kind, scanPath) : undefined;
          const r = await scanKindAsync(kind, PROJECT_ROOT, {
            force: Boolean(job.options?.forceScan),
            jobId,
            scanAbs,
            signal: ac.signal,
            notifyChanges: false,
            onProgress: throttleScanProgress((stats) => {
              updateJob(jobId, {
                total: Math.max(totalScanned + stats.discovered, stats.discovered),
                skipped: scanSkipped + stats.skipped,
                failed,
              });
            }),
          });
          results.push(r);
          totalScanned += r.scanned;
          scanSkipped += r.skipped;
          updateJob(jobId, {
            total: totalScanned,
            skipped: scanSkipped,
            failed,
            message: `${kind.label}: 扫描 ${r.scanned}，新增 ${r.inserted}，跳过 ${r.skipped}`,
          });
          emit({
            ts: new Date().toISOString(),
            level: "ok",
            text: `${kind.label}: 扫描 ${r.scanned}，新增 ${r.inserted}，更新 ${r.updated}`,
            jobId,
            kind: kind.id,
          });
        }
        if (!ac.signal.aborted) {
          invalidateScopeWalkCache(job);
          markPhaseComplete(jobId, "scan");
        }
      } finally {
        scanComplete = true;
      }

      const scrapeResults = await scrapePromise;
      for (const r of scrapeResults) {
        failed += r.failed;
        emit({
          ts: new Date().toISOString(),
          level: r.failed ? "warn" : "ok",
          text: `${r.kind}: 刮削 ${r.scraped}/${r.total}，失败 ${r.failed}`,
          jobId,
          kind: r.kind,
        });
      }
      if (!ac.signal.aborted) markPhaseComplete(jobId, "scrape");
      updateJob(jobId, { total: totalScanned, skipped: scanSkipped, failed });
    } else {
      if (shouldScan) {
        for (const kind of kinds) {
          if (ac.signal.aborted) break;
          const scanPath =
            typeof job.options?.scanPath === "string" ? job.options.scanPath.trim() : "";
          const scanLabel = scanPath || kind.sourceRoot;
          emit({
            ts: new Date().toISOString(),
            level: "info",
            text: `扫描 ${kind.label} (${scanLabel})`,
            jobId,
            kind: kind.id,
          });
          const scanAbs = scanPath ? resolveKindScanAbs(kind, scanPath) : undefined;
          const r = await scanKindAsync(kind, PROJECT_ROOT, {
            force: job.mode === "rescan" || Boolean(job.options?.forceScan),
            jobId,
            scanAbs,
            signal: ac.signal,
            notifyChanges: false,
            onProgress: throttleScanProgress((stats) => {
              updateJob(jobId, {
                total: Math.max(totalScanned + stats.discovered, stats.discovered),
                skipped: scanSkipped + stats.skipped,
                failed,
              });
            }),
          });
          results.push(r);
          totalScanned += r.scanned;
          scanSkipped += r.skipped;
          updateJob(jobId, {
            total: totalScanned,
            skipped: scanSkipped,
            failed,
            message: `${kind.label}: 扫描 ${r.scanned}，新增 ${r.inserted}，跳过 ${r.skipped}`,
          });
          emit({
            ts: new Date().toISOString(),
            level: "ok",
            text: `${kind.label}: 扫描 ${r.scanned}，新增 ${r.inserted}，更新 ${r.updated}`,
            jobId,
            kind: kind.id,
          });
        }
        if (!ac.signal.aborted) {
          invalidateScopeWalkCache(job);
          markPhaseComplete(jobId, "scan");
        }
      } else if (
        (job.mode === "scan_only" || job.mode === "full" || job.mode === "rescan") &&
        skipPhases.has("scan")
      ) {
        emit({
          ts: new Date().toISOString(),
          level: "info",
          text: "跳过扫描（恢复任务：该阶段已完成）",
          jobId,
        });
      }

      if (shouldScrape) {
        const kindIds = kinds.map((k) => k.id);
        emit({
          ts: new Date().toISOString(),
          level: "info",
          text: `开始刮削 ${kindIds.length} 个分区`,
          jobId,
        });
        const scrapeResults = await runScrapeDrainForKinds(kindIds, {
          signal: ac.signal,
          jobId,
          force: Boolean(job.options?.forceScrape),
          jobOptions: job.options,
          chainOrganize: job.mode === "full",
          dryRun: job.dryRun,
          isScanComplete: () => true,
          onBatch: () => {
            reconcileScrapeCacheSuccessStates(jobId);
            updateJob(jobId, { skipped: scanSkipped, failed });
          },
          shouldStopDrain: shouldStopScrapeDrain,
          onProgress: (text) =>
            emit({
              ts: new Date().toISOString(),
              level: "info",
              text,
              jobId,
            }),
        });
        for (const r of scrapeResults) {
          failed += r.failed;
          emit({
            ts: new Date().toISOString(),
            level: r.failed ? "warn" : "ok",
            text: `${r.kind}: 刮削 ${r.scraped}/${r.total}，失败 ${r.failed}`,
            jobId,
            kind: r.kind,
          });
        }
        if (!ac.signal.aborted) markPhaseComplete(jobId, "scrape");
        updateJob(jobId, { total: totalScanned, skipped: scanSkipped, failed });
      } else if (
        (job.mode === "scrape_only" || job.mode === "full") &&
        skipPhases.has("scrape")
      ) {
        emit({
          ts: new Date().toISOString(),
          level: "info",
          text: "跳过刮削（恢复任务：该阶段已完成）",
          jobId,
        });
      }
    }

    if (pauseRetryBatchIfDone()) return;

    if (job.mode === "organize_only" || job.mode === "full") {
      if (skipPhases.has("organize")) {
        emit({
          ts: new Date().toISOString(),
          level: "info",
          text: "跳过整理（恢复任务：该阶段已完成）",
          jobId,
        });
      } else {
        const kindIds = kinds.map((k) => k.id);
        emit({
          ts: new Date().toISOString(),
          level: "info",
          text: `${job.dryRun ? "dry-run 整理" : "开始整理"} ${kindIds.length} 个分区`,
          jobId,
        });
        const orgResults = await runOrganizeForKinds(kindIds, {
          signal: ac.signal,
          dryRun: job.dryRun,
          jobId,
          jobOptions: job.options,
          onProgress: (text) =>
            emit({
              ts: new Date().toISOString(),
              level: "info",
              text,
              jobId,
            }),
        });
        for (const r of orgResults) {
          organizeProcessed += r.organized + r.failed;
          failed += r.failed;
          emit({
            ts: new Date().toISOString(),
            level: r.failed ? "warn" : "ok",
            text: `${r.kind}: 整理 ${r.organized}/${r.total}，跳过 ${r.skipped}，失败 ${r.failed}${job.dryRun ? "（dry-run）" : ""}`,
            jobId,
            kind: r.kind,
          });
        }
        if (job.mode === "full" && !job.dryRun) {
          const stranded = failJobScrapedWithoutDone(jobId);
          if (stranded > 0) {
            failed += stranded;
            emit({
              ts: new Date().toISOString(),
              level: "warn",
              text: `${stranded} 条刮削后未完成整理，已标为失败`,
              jobId,
            });
          }
        }
        if (!ac.signal.aborted) markPhaseComplete(jobId, "organize");
      }
    }

    if (!ac.signal.aborted) clearResumeSkipPhases(jobId);

    if (ac.signal.aborted) {
      const raw = getJobRaw(jobId);
      releaseJobInflightFiles(jobId, raw?.status === "cancelled");
      reconcileJobFilesAfterAbort(jobId, { detachJobId: raw?.status === "cancelled" });
    }

    const fs = computeJobFileStats({
      id: jobId,
      mode: job.mode,
      total: totalScanned,
      skipped: scanSkipped,
      kinds: job.kinds,
      options: job.options,
    });

    const ephemeralRetry = Boolean(getJobRaw(jobId)?.options?.closeWhenFileIdsDone);

    updateJob(jobId, {
      status: ac.signal.aborted ? "cancelled" : "done",
      total: fs.total,
      processed: fs.success + fs.failed,
      failed: fs.failed,
      skipped: fs.skipped,
      message:
        ephemeralRetry
          ? `失败重刮完成，成功 ${fs.success}，失败 ${fs.failed}`
          : job.mode === "scan_only" || job.mode === "rescan"
          ? `扫描完成，共 ${fs.total} 个视频文件，已索引 ${fs.queued + fs.success}`
          : job.mode === "scrape_only"
            ? `刮削完成，成功 ${fs.success}，失败 ${fs.failed}`
            : job.mode === "organize_only"
              ? `${job.dryRun ? "dry-run " : ""}整理完成，成功 ${organizeProcessed - failed}，失败 ${fs.failed}`
              : job.mode === "full"
                ? `全流程完成，刮削成功 ${fs.success}，失败 ${fs.failed}${job.dryRun ? "（含 dry-run 整理）" : ""}`
                : "阶段功能待接入",
    });
    emit({
      ts: new Date().toISOString(),
      level: "ok",
      text: "任务完成",
      jobId,
    });
    const doneJob = getJob(jobId);
    if (doneJob && !ac.signal.aborted) {
      void dispatchJobWebhooks(doneJob);
    }
  } catch (err) {
    releaseJobInflightFiles(jobId, false);
    reconcileJobFilesAfterAbort(jobId, { detachJobId: false });
    updateJob(jobId, {
      status: "failed",
      message: err instanceof Error ? err.message : String(err),
    });
    const failedJob = getJob(jobId);
    if (failedJob) void dispatchJobWebhooks(failedJob);
    throw err;
  } finally {
    running.delete(jobId);
  }

  return;
}

export function pauseJob(jobId: string): JobRecord | null {
  const ac = running.get(jobId);
  if (ac) ac.abort();
  releaseJobInflightFiles(jobId);
  reconcileJobFilesAfterAbort(jobId, { detachJobId: false });
  updateJob(jobId, { status: "paused" });
  return getJob(jobId);
}

export function cancelJob(jobId: string): JobRecord | null {
  const ac = running.get(jobId);
  if (ac) ac.abort();
  releaseJobInflightFiles(jobId, true);
  reconcileJobFilesAfterAbort(jobId, { detachJobId: true });
  updateJob(jobId, { status: "cancelled" });
  return getJob(jobId);
}

export function resumeJob(jobId: string): JobRecord | null {
  const job = getJob(jobId);
  if (!job) return null;
  updateJob(jobId, { status: "queued" });
  scheduleRunJob(jobId);
  return getJob(jobId);
}

export function deleteJob(jobId: string): boolean {
  const job = getJob(jobId);
  if (!job) return false;
  if (job.status === "running" || job.status === "queued") {
    throw new Error("请先停止任务");
  }

  const ac = running.get(jobId);
  if (ac) {
    ac.abort();
    running.delete(jobId);
  }

  releaseJobInflightFiles(jobId, true);
  reconcileJobFilesAfterAbort(jobId, { detachJobId: true });

  const db = openDatabase();
  db.prepare(`DELETE FROM jobs WHERE id = ?`).run(jobId);
  return true;
}
