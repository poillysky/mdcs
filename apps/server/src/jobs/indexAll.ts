import { EventEmitter } from "node:events";
import { pickKinds } from "../config/loadConfig.js";
import { PROJECT_ROOT } from "../paths.js";
import { scanKindAsync } from "./scanner.js";
import type { KindId } from "../types.js";

export type IndexAllStatus = {
  running: boolean;
  kindTotal: number;
  kindIndex: number;
  currentKind?: KindId;
  currentLabel?: string;
  discovered: number;
  inserted: number;
  updated: number;
  skipped: number;
  message?: string;
  error?: string;
};

const emitter = new EventEmitter();

let status: IndexAllStatus = idleStatus();
let abort: AbortController | null = null;
let emitTimer: ReturnType<typeof setTimeout> | null = null;

function idleStatus(): IndexAllStatus {
  return {
    running: false,
    kindTotal: 0,
    kindIndex: 0,
    discovered: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
  };
}

function emitStatusNow() {
  emitter.emit("update", { ...status });
}

function emitStatus() {
  if (emitTimer) return;
  emitTimer = setTimeout(() => {
    emitTimer = null;
    emitStatusNow();
  }, 500);
}

export function getIndexAllStatus(): IndexAllStatus {
  return { ...status };
}

export function onIndexAllUpdate(listener: (status: IndexAllStatus) => void): () => void {
  emitter.on("update", listener);
  return () => emitter.off("update", listener);
}

/** 后台全量索引（不创建 jobs 任务） */
export function startIndexAll(kindIds: string[]): IndexAllStatus {
  if (status.running) {
    throw new Error("全量索引正在进行中");
  }
  const kinds = pickKinds(kindIds.length ? kindIds : ["*enabled"]);
  if (!kinds.length) {
    throw new Error("没有可索引的分区");
  }

  abort = new AbortController();
  status = {
    running: true,
    kindTotal: kinds.length,
    kindIndex: 0,
    discovered: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    message: "准备扫描…",
  };
  emitStatusNow();

  void (async () => {
    try {
      let discovered = 0;
      for (let i = 0; i < kinds.length; i++) {
        if (abort?.signal.aborted) break;
        const kind = kinds[i]!;
        status.kindIndex = i + 1;
        status.currentKind = kind.id;
        status.currentLabel = kind.label;
        status.message = `扫描 ${kind.label}…`;
        emitStatus();

        const r = await scanKindAsync(kind, PROJECT_ROOT, {
          signal: abort?.signal,
          notifyChanges: false,
          onProgress: (stats) => {
            status.discovered = discovered + stats.discovered;
            emitStatus();
          },
        });
        discovered += r.scanned;
        status.discovered = discovered;
        status.inserted += r.inserted;
        status.updated += r.updated;
        status.skipped += r.skipped;
        status.message = `${kind.label}: 扫描 ${r.scanned}，新增 ${r.inserted}，跳过 ${r.skipped}`;
        emitStatusNow();
      }
      status.running = false;
      status.message = `全量索引完成，共 ${status.discovered} 个文件（新增 ${status.inserted}）`;
    } catch (err) {
      status.running = false;
      status.error = err instanceof Error ? err.message : String(err);
      status.message = status.error;
    } finally {
      abort = null;
      emitStatusNow();
    }
  })();

  return getIndexAllStatus();
}
