import { FILE_STATUS_LABELS, ORGANIZE_MODE_LABELS } from "../../lib/labels";
import { formatRecordPaths } from "../../lib/paths";
import type { FileRow, KindRow } from "../../types";

export const RECORDS_STATUS_OPTIONS = [
  { value: "", label: "全部" },
  { value: "done", label: "成功" },
  { value: "failed", label: "失败" },
  { value: "skipped", label: "取消" },
  { value: "pending", label: "等待中" },
  { value: "scraping", label: "处理中" },
  { value: "planned", label: "重新整理排队中" },
  { value: "organizing", label: "重新整理中" },
] as const;

export const RECORDS_TABLE_STATUS_LABELS: Record<string, string> = {
  ...FILE_STATUS_LABELS,
  done: "成功",
  failed: "失败",
  skipped: "取消",
  pending: "等待中",
  scraping: "处理中",
  scraped: "处理中",
  planned: "重新整理排队中",
  organizing: "重新整理中",
};

export function formatRecordTime(ms?: number | null): string {
  if (!ms) return "—";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function formatRecordPathCells(f: FileRow): { text: string; title: string } {
  return formatRecordPaths(f.source_path, f.target_path ?? undefined);
}

export function organizeModeForFile(f: FileRow, kinds: KindRow[]): string {
  const k = kinds.find((row) => row.id === f.kind);
  if (!k) return "—";
  return ORGANIZE_MODE_LABELS[k.organizeMode] ?? k.organizeMode;
}

export function triggerLabel(f: FileRow, kinds: KindRow[]): string {
  if (f.triggerSource === "monitor") return "监控";
  if (f.triggerSource === "qb") return "qB";
  if (f.triggerSource === "manual") return "手动";
  const k = kinds.find((row) => row.id === f.kind);
  if (k?.enabled && k.sourceRoot?.trim()) return "监控";
  return "手动";
}

export function recordStatusClass(status: string): string {
  if (status === "done") return "records-pill records-pill--success";
  if (status === "failed") return "records-pill records-pill--error";
  if (status === "pending" || status === "scraping" || status === "organizing" || status === "planned") {
    return "records-pill records-pill--processing";
  }
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
    status === "scraping" ||
    status === "organizing" ||
    status === "planned"
  );
}

export function isFileReorganizable(file: FileRow): boolean {
  return Boolean(file.code?.trim());
}

export function isFileRetryable(status: string): boolean {
  return status === "failed" || status === "skipped";
}
