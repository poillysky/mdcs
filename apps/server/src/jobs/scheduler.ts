import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { pickKinds } from "../config/loadConfig.js";
import { openDatabase } from "../db/init.js";
import { PROJECT_ROOT } from "../paths.js";
import { scanKind } from "./scanner.js";
import { runScrapeForKinds } from "../scrape/runner.js";
import { runOrganizeForKinds } from "../organize/runner.js";
import { normalizeJobOptions, type JobOptions } from "./options.js";
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
  /** 是否写入「复用上次」快照；监控/qB 自动任务应关 */
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
  emitter.emit("job_update", job);
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
  const triggerSource: JobTriggerSource =
    triggerRaw === "monitor" || triggerRaw === "qb" ? triggerRaw : "manual";
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

export function getJob(jobId: string): JobRecord | null {
  const db = openDatabase();
  const row = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(jobId) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToJob(row) : null;
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

  return { jobs: rows.map(rowToJob), total, page, pageSize };
}

export function listJobs(limit = 20): JobRecord[] {
  return queryJobs({ pageSize: limit }).jobs;
}

function updateJob(jobId: string, patch: Partial<JobRecord> & { message?: string }) {
  const db = openDatabase();
  const current = getJob(jobId);
  if (!current) return;
  const next = { ...current, ...patch, updatedAt: now() };
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
    try {
      const cfg = loadOpsConfig();
      const kindsArg = Array.isArray(input.kinds) && input.kinds.length ? input.kinds : ["*enabled"];
      saveOpsConfig({
        ...cfg,
        lastJob: {
          kinds: kindsArg.map(String),
          mode: job.mode,
          dryRun: job.dryRun,
          options: (job.options ?? {}) as Record<string, unknown>,
          savedAt: ts,
        },
      });
    } catch {
      /* 记忆失败不阻断建任务 */
    }
  }

  emitJobUpdate(job);

  void runJob(job.id).catch((err) => {
    updateJob(job.id, {
      status: "failed",
      message: err instanceof Error ? err.message : String(err),
    });
    emit({
      ts: new Date().toISOString(),
      level: "error",
      text: `任务失败: ${job.id}`,
      jobId: job.id,
    });
  });

  return job;
}

export async function runJob(jobId: string): Promise<void> {
  const job = getJob(jobId);
  if (!job) throw new Error("任务不存在");

  const ac = new AbortController();
  running.set(jobId, ac);
  updateJob(jobId, { status: "running" });
  emit({ ts: new Date().toISOString(), level: "info", text: "任务开始", jobId });

  const kinds = pickKinds(job.kinds);
  const results: ScanResult[] = [];
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  try {
    if (job.mode === "scan_only" || job.mode === "full" || job.mode === "rescan") {
      for (const kind of kinds) {
        if (ac.signal.aborted) break;
        emit({
          ts: new Date().toISOString(),
          level: "info",
          text: `扫描 ${kind.label} (${kind.sourceRoot})`,
          jobId,
          kind: kind.id,
        });
        const r = scanKind(kind, PROJECT_ROOT, {
          force: job.mode === "rescan" || Boolean(job.options?.forceScan),
          jobId,
        });
        results.push(r);
        processed += r.scanned;
        skipped += r.skipped;
        updateJob(jobId, {
          total: processed,
          processed,
          skipped,
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
    }

    if (job.mode === "scrape_only" || job.mode === "full") {
      const kindIds = kinds.map((k) => k.id);
      emit({
        ts: new Date().toISOString(),
        level: "info",
        text: `开始刮削 ${kindIds.length} 个分区`,
        jobId,
      });
      const scrapeResults = await runScrapeForKinds(kindIds, {
        signal: ac.signal,
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
      for (const r of scrapeResults) {
        processed += r.scraped + r.failed;
        failed += r.failed;
        skipped += r.skipped;
        emit({
          ts: new Date().toISOString(),
          level: r.failed ? "warn" : "ok",
          text: `${r.kind}: 刮削 ${r.scraped}/${r.total}，失败 ${r.failed}`,
          jobId,
          kind: r.kind,
        });
      }
    }

    if (job.mode === "organize_only" || job.mode === "full") {
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
        processed += r.organized + r.failed;
        failed += r.failed;
        skipped += r.skipped;
        emit({
          ts: new Date().toISOString(),
          level: r.failed ? "warn" : "ok",
          text: `${r.kind}: 整理 ${r.organized}/${r.total}，跳过 ${r.skipped}，失败 ${r.failed}${job.dryRun ? "（dry-run）" : ""}`,
          jobId,
          kind: r.kind,
        });
      }
    }

    updateJob(jobId, {
      status: ac.signal.aborted ? "cancelled" : "done",
      total: processed,
      processed,
      failed,
      skipped,
      message:
        job.mode === "scan_only" || job.mode === "rescan"
          ? `扫描完成，共 ${processed} 个视频文件`
          : job.mode === "scrape_only"
            ? `刮削完成，成功 ${processed - failed}，失败 ${failed}`
            : job.mode === "organize_only"
              ? `${job.dryRun ? "dry-run " : ""}整理完成，成功 ${processed - failed}，失败 ${failed}`
              : job.mode === "full"
                ? `全流程完成，处理 ${processed}，失败 ${failed}${job.dryRun ? "（含 dry-run 整理）" : ""}`
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
  updateJob(jobId, { status: "paused" });
  return getJob(jobId);
}

export function cancelJob(jobId: string): JobRecord | null {
  const ac = running.get(jobId);
  if (ac) ac.abort();
  updateJob(jobId, { status: "cancelled" });
  return getJob(jobId);
}

export function resumeJob(jobId: string): JobRecord | null {
  const job = getJob(jobId);
  if (!job) return null;
  updateJob(jobId, { status: "queued" });
  void runJob(jobId);
  return getJob(jobId);
}

export function deleteJob(jobId: string): boolean {
  const job = getJob(jobId);
  if (!job) return false;
  if (job.status === "running" || job.status === "queued") {
    throw new Error("请先终止任务");
  }

  const ac = running.get(jobId);
  if (ac) {
    ac.abort();
    running.delete(jobId);
  }

  const db = openDatabase();
  db.prepare(`DELETE FROM jobs WHERE id = ?`).run(jobId);
  return true;
}
