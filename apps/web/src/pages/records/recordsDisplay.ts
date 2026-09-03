import { FILE_STATUS_LABELS, ORGANIZE_MODE_LABELS } from "../../lib/labels";
import { isFilePipelineProcessing, isFilePipelineWaiting } from "../../lib/filePipelineStatus";
import { formatRecordPaths } from "../../lib/paths";
import type { FileRow, KindRow } from "../../types";

export const RECORDS_STATUS_OPTIONS = [
  { value: "", label: "全部" },
  { value: "done", label: "成功" },
  { value: "failed", label: "失败" },
  { value: "skipped", label: "取消" },
  /** 尚未进入刮削+整理流水线 */
  { value: "waiting", label: "等待中" },
  /** 刮削+整理流水线进行中 */
  { value: "processing", label: "处理中" },
] as const;

/** @deprecated 使用 isFilePipelineProcessing */
export function isFileScrapingActive(
  status: string,
  file?: Pick<FileRow, "scraped_at" | "organized_at">,
): boolean {
  return isFilePipelineProcessing(status, file);
}

/** @deprecated 使用 isFilePipelineProcessing */
export function isFileActivelyProcessing(
  status: string,
  file?: Pick<FileRow, "scraped_at" | "organized_at">,
): boolean {
  return isFilePipelineProcessing(status, file);
}

export function isFileWaiting(status: string): boolean {
  return isFilePipelineWaiting(status);
}

export function isFileScrapeQueued(status: string): boolean {
  return isFilePipelineWaiting(status);
}

export function recordTableStatusLabel(
  status: string,
  file?: Pick<FileRow, "scraped_at" | "organized_at">,
): string {
  if (status === "done") return "成功";
  if (status === "failed") return "失败";
  if (status === "skipped") return "取消";
  if (isFilePipelineProcessing(status, file)) return "处理中";
  if (isFilePipelineWaiting(status)) return "等待中";
  return FILE_STATUS_LABELS[status] ?? status;
}

export const RECORDS_TABLE_STATUS_LABELS: Record<string, string> = {
  done: "成功",
  failed: "失败",
  skipped: "取消",
  indexed: "等待中",
  pending: "等待中",
  scraping: "处理中",
  scraped: "处理中",
  planned: "处理中",
  organizing: "处理中",
};

export function formatRecordTime(ms?: number | null): string {
  if (!ms) return "—";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function formatRecordPathCells(
  f: FileRow,
  kinds?: KindRow[],
): {
  source: string;
  target?: string;
  title: string;
} {
  const libraryRoot = kinds?.find((k) => k.id === f.kind)?.libraryRoot;
  return formatRecordPaths(f.source_path, f.target_path ?? undefined, libraryRoot);
}

export function organizeModeForFile(f: FileRow, kinds: KindRow[]): string {
  const k = kinds.find((row) => row.id === f.kind);
  if (!k) return "—";
  return ORGANIZE_MODE_LABELS[k.organizeMode] ?? k.organizeMode;
}

/** 解析任务来源：来自 jobs.trigger_source；无 job 关联时默认手动 */
export function resolveTriggerSource(f: FileRow): "manual" | "monitor" {
  return f.triggerSource === "monitor" ? "monitor" : "manual";
}

export function triggerLabel(f: FileRow): string {
  return resolveTriggerSource(f) === "monitor" ? "监控" : "手动";
}

export function triggerPillClass(f: FileRow): string {
  const source = resolveTriggerSource(f);
  if (source === "monitor") {
    return "records-pill records-pill--trigger records-pill--source-monitor";
  }
  return "records-pill records-pill--trigger records-pill--source-manual";
}

export function recordStatusClass(
  status: string,
  file?: Pick<FileRow, "scraped_at" | "organized_at">,
): string {
  if (status === "done") return "records-pill records-pill--success";
  if (status === "failed") return "records-pill records-pill--error";
  if (isFilePipelineProcessing(status, file)) return "records-pill records-pill--processing";
  if (isFilePipelineWaiting(status)) return "records-pill records-pill--waiting";
  return "records-pill records-pill--muted";
}

export function isRecordsRowInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      'input, button, a, label, .records-actions-menu, .records-actions-dropdown, .records-col-check, .records-col-op',
    ),
  );
}

export function isFileStopable(status: string): boolean {
  return (
    status === "pending" ||
    status === "planned" ||
    status === "scraping" ||
    status === "organizing"
  );
}

export function isFileReorganizable(file: FileRow): boolean {
  return Boolean(file.code?.trim());
}

export function isFileRetryable(status: string): boolean {
  return status === "failed" || status === "skipped";
}
