import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, ensureDir } from "../paths.js";

export type PipelineLogTone = "ok" | "warn" | "info" | "fail";

export type PipelineLogItem = {
  tone: PipelineLogTone;
  text: string;
};

export type PipelineLogStep = {
  title: string;
  done: boolean;
  items: PipelineLogItem[];
};

export type PipelineRunKind = "initial" | "retry" | "rescrape" | "reorganize";

export type PipelineRunRecord = {
  id: string;
  kind: PipelineRunKind;
  at: number;
  mode: "rescrape" | "reorganize";
  steps: PipelineLogStep[];
};

export type FilePipelineState = {
  active: boolean;
  mode: "rescrape" | "reorganize";
  kind: PipelineRunKind;
  startedAt: number;
  steps: PipelineLogStep[];
};

const PIPELINE_LOG_DIR = path.join(DATA_DIR, "pipeline-logs");
const MAX_RUNS = 30;

const store = new Map<number, FilePipelineState>();
const historyMem = new Map<number, PipelineRunRecord[]>();

function historyPath(fileId: number): string {
  return path.join(PIPELINE_LOG_DIR, `${fileId}.json`);
}

function readHistory(fileId: number): PipelineRunRecord[] {
  const cached = historyMem.get(fileId);
  if (cached) return cached;
  const file = historyPath(fileId);
  if (!fs.existsSync(file)) {
    historyMem.set(fileId, []);
    return [];
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as PipelineRunRecord[];
    const runs = Array.isArray(parsed) ? parsed : [];
    historyMem.set(fileId, runs);
    return runs;
  } catch {
    historyMem.set(fileId, []);
    return [];
  }
}

function writeHistory(fileId: number, runs: PipelineRunRecord[]): void {
  const trimmed = runs.slice(0, MAX_RUNS);
  historyMem.set(fileId, trimmed);
  ensureDir(PIPELINE_LOG_DIR);
  fs.writeFileSync(historyPath(fileId), `${JSON.stringify(trimmed, null, 2)}\n`, "utf8");
}

export function beginPipeline(
  fileId: number,
  mode: "rescrape" | "reorganize",
  kind?: PipelineRunKind,
): void {
  const resolvedKind =
    kind ?? (mode === "reorganize" ? "reorganize" : "rescrape");
  store.set(fileId, {
    active: true,
    mode,
    kind: resolvedKind,
    startedAt: Date.now(),
    steps: [],
  });
}

export function getPipeline(fileId: number): FilePipelineState | null {
  return store.get(fileId) ?? null;
}

export function getPipelineHistory(fileId: number): PipelineRunRecord[] {
  const runs = readHistory(fileId);
  if (!runs.length || runs.some((r) => r.kind === "initial")) return runs;
  // 旧归档只有 retry：把时间最早的一条标成首次
  let oldestIdx = 0;
  for (let i = 1; i < runs.length; i++) {
    if (runs[i]!.at < runs[oldestIdx]!.at) oldestIdx = i;
  }
  const next = runs.map((r, i) =>
    i === oldestIdx ? { ...r, kind: "initial" as const } : r,
  );
  writeHistory(fileId, next);
  return next;
}

export function endPipeline(fileId: number): void {
  const cur = store.get(fileId);
  if (!cur) return;
  if (cur.steps.length) {
    const runs = readHistory(fileId);
    runs.unshift({
      id: `${fileId}-${cur.startedAt}`,
      kind: cur.kind,
      at: cur.startedAt,
      mode: cur.mode,
      steps: cur.steps.map((step) => ({
        ...step,
        items: step.items.map((item) => ({ ...item })),
      })),
    });
    writeHistory(fileId, runs);
  }
  store.set(fileId, { ...cur, active: false });
}

export function clearPipeline(fileId: number): void {
  store.delete(fileId);
}

/** 删除文件记录时一并清理 pipeline 内存态与磁盘归档 */
export function deletePipelineHistory(fileId: number): void {
  store.delete(fileId);
  historyMem.delete(fileId);
  const file = historyPath(fileId);
  try {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {
    /* ignore */
  }
}

export function pushPipelineStep(fileId: number, step: PipelineLogStep): void {
  const cur = store.get(fileId);
  if (!cur) return;
  store.set(fileId, { ...cur, steps: [...cur.steps, step] });
}

export function appendPipelineItem(
  fileId: number,
  stepTitle: string,
  item: PipelineLogItem,
): void {
  const cur = store.get(fileId);
  if (!cur) return;
  store.set(fileId, {
    ...cur,
    steps: cur.steps.map((s) =>
      s.title === stepTitle ? { ...s, items: [...s.items, item] } : s,
    ),
  });
}

export function markPipelineStepDone(fileId: number, stepTitle: string): void {
  const cur = store.get(fileId);
  if (!cur) return;
  store.set(fileId, {
    ...cur,
    steps: cur.steps.map((s) => (s.title === stepTitle ? { ...s, done: true } : s)),
  });
}

export function replacePipelineStep(fileId: number, stepTitle: string, step: PipelineLogStep): void {
  const cur = store.get(fileId);
  if (!cur) return;
  const idx = cur.steps.findIndex((s) => s.title === stepTitle);
  if (idx < 0) {
    pushPipelineStep(fileId, step);
    return;
  }
  const steps = [...cur.steps];
  steps[idx] = step;
  store.set(fileId, { ...cur, steps });
}
