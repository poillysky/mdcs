import { EventEmitter } from "node:events";
import type { KindId } from "../types.js";

export type FileChangeReason = "scan" | "scrape" | "organize" | "action" | "batch";

export type FileChangeEvent = {
  ids: number[];
  kind?: KindId;
  jobId?: string;
  reason?: FileChangeReason;
  ts: number;
};

const emitter = new EventEmitter();
const pendingIds = new Set<number>();
let pendingMeta: Pick<FileChangeEvent, "kind" | "jobId" | "reason"> = {};
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const FLUSH_MS = 200;

function flush() {
  flushTimer = null;
  if (!pendingIds.size) return;
  const event: FileChangeEvent = {
    ids: [...pendingIds],
    ...pendingMeta,
    ts: Date.now(),
  };
  pendingIds.clear();
  pendingMeta = {};
  emitter.emit("change", event);
}

/** 文件行变更后通知（合并 200ms 内的多次更新再推送） */
export function notifyFileChanges(
  ids: number | number[],
  meta?: Pick<FileChangeEvent, "kind" | "jobId" | "reason">,
): void {
  const list = (Array.isArray(ids) ? ids : [ids]).filter((id) => Number.isFinite(id) && id > 0);
  if (!list.length) return;
  for (const id of list) pendingIds.add(id);
  if (meta?.kind) pendingMeta.kind = meta.kind;
  if (meta?.jobId) pendingMeta.jobId = meta.jobId;
  if (meta?.reason) pendingMeta.reason = meta.reason;
  if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_MS);
}

export function onFileChange(listener: (event: FileChangeEvent) => void): () => void {
  emitter.on("change", listener);
  return () => emitter.off("change", listener);
}
