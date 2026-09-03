import { kindLabel, ORGANIZE_MODE_LABELS } from "./labels";
import { formatRecordPaths, pickDisplayPath } from "./paths";
import type { JobOptions } from "./jobOptions";
import type { JobRow, KindRow } from "../types";

export function buildJobRecordsPath(job: JobRow, opts?: { status?: string }): string {
  const q = new URLSearchParams({ jobId: job.id });
  const status = opts?.status?.trim();
  if (status) q.set("status", status);
  return `/records?${q}`;
}

/** 任务进度 pill → 刮削记录 status 查询参数 */
export type JobProgressRecordsFilter =
  | "success"
  | "failed"
  | "waiting"
  | "processing"
  | "skipped";

export function jobProgressFilterToRecordsStatus(filter: JobProgressRecordsFilter): string {
  if (filter === "success") return "done";
  return filter;
}

export function buildKindRecordsPath(kind: KindRow | string): string {
  const id = typeof kind === "string" ? kind : kind.id;
  return `/records?kind=${encodeURIComponent(id)}`;
}

export function buildKindSourceRecordsPath(kind: KindRow): string {
  const root = kind.sourceRoot?.trim();
  if (!root) return buildKindRecordsPath(kind);
  const q = new URLSearchParams({
    kind: kind.id,
    sourceRoot: root,
  });
  return `/records?${q}`;
}

export function recordsPathForKindTask(kind: KindRow, jobs: JobRow[], active?: JobRow): string {
  const job = active ?? latestJobForKind(jobs, kind.id);
  if (job) return buildJobRecordsPath(job);
  if (kind.sourceRoot?.trim()) return buildKindSourceRecordsPath(kind);
  return buildKindRecordsPath(kind);
}

/** `job_1724502622974_a356eec8` → `974_a356eec8` */
export function jobShortId(id: string): string {
  const m = /^job_(\d+)_([a-f0-9]{8})$/i.exec(id);
  if (m) return `${m[1].slice(-3)}_${m[2]}`;
  const parts = id.split("_").filter(Boolean);
  if (parts.length >= 2) {
    const tail = parts[parts.length - 1];
    const prev = parts[parts.length - 2];
    return `${prev.slice(-3)}_${tail.slice(0, 8)}`;
  }
  return id.slice(-12);
}

function kindSummary(job: JobRow): string {
  if (!job.kinds.length) return "";
  if (job.kinds.length === 1) return kindLabel(job.kinds[0]);
  return job.kinds.map((k) => kindLabel(k)).join("、");
}

function fallbackDetail(job: JobRow): string {
  const kinds = kindSummary(job);
  if (job.status === "queued") return kinds ? `${kinds}: 排队中` : "排队中";
  if (job.status === "running" && job.total <= 0 && job.processed <= 0) {
    return kinds ? `${kinds}: 运行中` : "运行中";
  }
  const parts: string[] = [];
  if (job.total > 0 || job.processed > 0) {
    parts.push(`处理 ${job.processed}/${job.total || "—"}`);
  }
  if (job.skipped > 0) parts.push(`跳过 ${job.skipped}`);
  if (job.failed > 0) parts.push(`失败 ${job.failed}`);
  const stats = parts.length ? parts.join("，") : kinds ? "等待中" : "—";
  return kinds ? `${kinds}: ${stats}` : stats;
}

/** `974_a356eec8 日本有码: 扫描 85655，新增 85650，跳过 5` */
export function formatJobSummaryLine(job: JobRow): string {
  const shortId = jobShortId(job.id);
  const detail = job.message?.trim() || fallbackDetail(job);
  return `${shortId} ${detail}`;
}

export function activeJobForKind(jobs: JobRow[], kindId: string): JobRow | undefined {
  return jobs.find(
    (j) =>
      j.kinds.includes(kindId) &&
      (j.status === "running" || j.status === "queued" || j.status === "paused"),
  );
}

/** 该分区最近一条任务（不含已取消），用于刮削记录范围 */
export function latestJobForKind(jobs: JobRow[], kindId: string): JobRow | undefined {
  let best: JobRow | undefined;
  for (const j of jobs) {
    if (!j.kinds.includes(kindId)) continue;
    if (j.status === "cancelled") continue;
    if (!best || (j.createdAt ?? 0) > (best.createdAt ?? 0)) best = j;
  }
  return best;
}

export function formatJobDuration(job: JobRow, now = Date.now()): string {
  const start = job.createdAt;
  if (!start) return "—";
  const active = job.status === "running" || job.status === "queued";
  const end = active ? now : (job.updatedAt ?? now);
  const sec = Math.max(0, Math.floor((end - start) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function jobProgressStats(job: JobRow) {
  const failed = job.failed;
  const skipped = job.skipped;
  const success = Math.max(0, job.processed - failed);
  const total = job.total > 0 ? job.total : success + skipped + failed;
  return { success, skipped, failed, total };
}

export function resolveJobPaths(job: JobRow, kinds: KindRow[]) {
  const kindMap = new Map(kinds.map((k) => [k.id, k]));
  const matched = job.kinds.map((id) => kindMap.get(id)).filter((k): k is KindRow => Boolean(k));
  if (!matched.length) return { source: "—", library: "—" };

  const jobOpts = job.options as JobOptions | undefined;
  const scanPath = typeof jobOpts?.scanPath === "string" ? jobOpts.scanPath.trim() : "";
  const sources = matched.map((k, i) => {
    if (scanPath && matched.length === 1 && i === 0) {
      return pickDisplayPath(scanPath);
    }
    return pickDisplayPath(k.sourceRoot, k.sourceAbs);
  });
  const libraries = matched.map((k) => {
    const override = jobOpts?.organize?.libraryRoot?.trim();
    if (override && matched.length === 1) {
      return pickDisplayPath(override, k.libraryAbs || k.libraryRoot || override);
    }
    return pickDisplayPath(k.libraryRoot, k.libraryAbs);
  });

  if (sources.length === 1 && libraries.length === 1) {
    return {
      source: sources[0].display,
      library: libraries[0].display,
    };
  }

  return {
    source: sources.map((p) => p.display).join("\n"),
    library: libraries.map((p) => p.display).join("\n"),
  };
}

export function formatJobPathCellGroups(
  job: JobRow,
  kinds: KindRow[],
): Array<{ source: string; target?: string; title: string }> {
  const paths = resolveJobPaths(job, kinds);
  const srcLines = paths.source === "—" ? [] : paths.source.split("\n").filter(Boolean);
  const libLines = paths.library === "—" ? [] : paths.library.split("\n").filter(Boolean);
  if (!srcLines.length) return [{ source: "—", title: "" }];
  return srcLines.map((source, i) => {
    const lib = libLines[i] ?? libLines[0];
    return formatRecordPaths(source, lib && lib !== "—" ? lib : undefined);
  });
}

export function resolveOrganizeModeLabel(job: JobRow, kinds: KindRow[]): string {
  const jobOpts = job.options as JobOptions | undefined;
  if (jobOpts?.useGlobal?.organize === false && jobOpts.organize?.organizeMode) {
    return ORGANIZE_MODE_LABELS[jobOpts.organize.organizeMode] ?? jobOpts.organize.organizeMode;
  }
  if (job.kinds.length === 1) {
    const kind = kinds.find((k) => k.id === job.kinds[0]);
    if (kind && kind.useGlobalOrganize === false && kind.organizeMode) {
      return ORGANIZE_MODE_LABELS[kind.organizeMode] ?? kind.organizeMode;
    }
  }
  if (job.kinds.length === 1) {
    const kind = kinds.find((k) => k.id === job.kinds[0]);
    if (kind?.organizeMode) {
      return ORGANIZE_MODE_LABELS[kind.organizeMode] ?? kind.organizeMode;
    }
  }
  return ORGANIZE_MODE_LABELS.hardlink;
}

export function resolveKindPaths(kind: KindRow) {
  const source = pickDisplayPath(kind.sourceRoot, kind.sourceAbs);
  const library = pickDisplayPath(kind.libraryRoot, kind.libraryAbs);
  return {
    source: source.display,
    library: library.display,
  };
}

export function resolveKindOrganizeMode(kind: KindRow): string {
  const mode = kind.organizeMode || "hardlink";
  return ORGANIZE_MODE_LABELS[mode] ?? mode;
}

export function formatKindIndexStats(stats: Record<string, number>): string {
  const pending = stats.pending ?? 0;
  const done = stats.done ?? 0;
  const failed = stats.failed ?? 0;
  const parts: string[] = [];
  if (pending > 0) parts.push(`待处理 ${pending}`);
  if (done > 0) parts.push(`完成 ${done}`);
  if (failed > 0) parts.push(`失败 ${failed}`);
  return parts.length ? parts.join(" · ") : "暂无索引";
}

export function kindIndexProgressStats(stats: Record<string, number>) {
  const pending = stats.pending ?? 0;
  const done = stats.done ?? 0;
  const failed = stats.failed ?? 0;
  const skipped = stats.skipped ?? 0;
  /** 刮削+整理流水线进行中 */
  const processing =
    (stats.scraping ?? 0) +
    (stats.scraped ?? 0) +
    (stats.planned ?? 0) +
    (stats.organizing ?? 0);
  const total =
    stats.total ??
    pending +
      done +
      failed +
      skipped +
      processing +
      (stats.scraped ?? 0) +
      (stats.planned ?? 0);
  return { pending, done, failed, processing, total };
}

export function kindHasIndexProgress(kind: KindRow): boolean {
  return Boolean(kind.sourceRoot?.trim());
}

export type ProgressPillView = {
  success: number;
  middleLabel: "跳过" | "待处理";
  middle: number;
  queued: number;
  failed: number;
  processing: number;
  total: number;
};

export function emptyProgressPills(): ProgressPillView {
  return {
    success: 0,
    middleLabel: "待处理",
    middle: 0,
    queued: 0,
    failed: 0,
    processing: 0,
    total: 0,
  };
}

export function jobProgressPills(job: JobRow): ProgressPillView {
  const fs = job.fileStats;
  if (fs) {
    return {
      success: fs.success,
      middleLabel: "跳过",
      middle: fs.skipped,
      queued: fs.queued,
      failed: fs.failed,
      processing: fs.processing,
      total: fs.total,
    };
  }

  const stats = jobProgressStats(job);
  return {
    success: stats.success,
    middleLabel: "跳过",
    middle: stats.skipped,
    queued: 0,
    failed: stats.failed,
    processing: 0,
    total: stats.total,
  };
}

export function kindIndexProgressPills(stats: Record<string, number>): ProgressPillView {
  const index = kindIndexProgressStats(stats);
  return {
    success: index.done,
    middleLabel: "待处理",
    middle: index.pending,
    queued: 0,
    failed: index.failed,
    processing: index.processing,
    total: index.total,
  };
}
