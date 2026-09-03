import fs from "node:fs";
import path from "node:path";
import { loadLibrariesConfig, pickKinds, getPathRoot } from "../config/loadConfig.js";
import { createJob, queryJobs } from "../jobs/scheduler.js";
import { organizeWalkFilter, passesMinSize, walkVideoFiles } from "../library/scanFilter.js";
import { PROJECT_ROOT, resolveFromRoot } from "../paths.js";
import { normalizeRelativePath } from "../security/pathPolicy.js";
import type { KindId } from "../types.js";
import { loadOpsConfig, onOpsConfigChange } from "./loadOps.js";
import type { MonitorEntry, OpsConfig } from "./types.js";

type Snapshot = Map<string, { mtime: number; size: number }>;

const snapshots = new Map<string, Snapshot>();
const lastTrigger = new Map<string, number>();
let pollTimer: ReturnType<typeof setInterval> | null = null;
const watchers = new Map<string, fs.FSWatcher>();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

function resolveMonitorPath(p: string): string {
  const t = p.trim();
  if (!t) return "";
  try {
    const rel = normalizeRelativePath(t);
    return resolveFromRoot(rel, getPathRoot());
  } catch {
    return path.isAbsolute(t) ? t : resolveFromRoot(t, getPathRoot());
  }
}

function listAutoEntries(): MonitorEntry[] {
  const lib = loadLibrariesConfig();
  const out: MonitorEntry[] = [];
  for (const [id, k] of Object.entries(lib.kinds)) {
    if (!k.enabled || !k.sourceRoot?.trim()) continue;
    out.push({
      id: `auto_${id}`,
      path: k.sourceRoot,
      kinds: [id as KindId],
      jobMode: "full",
    });
  }
  return out;
}

function activeEntries(cfg: OpsConfig): MonitorEntry[] {
  return cfg.monitor.entries.length > 0 ? cfg.monitor.entries : listAutoEntries();
}

function walkVideos(rootDir: string): string[] {
  const org = loadLibrariesConfig().organize;
  const filter = organizeWalkFilter(org);
  return walkVideoFiles(rootDir, filter).filter((abs) => passesMinSize(abs, filter.minBytes));
}

function takeSnapshot(rootAbs: string): Snapshot {
  const snap: Snapshot = new Map();
  for (const abs of walkVideos(rootAbs)) {
    try {
      const st = fs.statSync(abs);
      snap.set(abs, { mtime: Math.floor(st.mtimeMs), size: st.size });
    } catch {
      /* ignore */
    }
  }
  return snap;
}

function snapshotHasChanges(prev: Snapshot | undefined, next: Snapshot): boolean {
  if (!prev) return false;
  for (const [abs, meta] of next) {
    if (!prev.has(abs)) return true;
    const old = prev.get(abs)!;
    if (old.mtime !== meta.mtime || old.size !== meta.size) return true;
  }
  return false;
}

function hasDirectoryChanges(entryId: string, rootAbs: string): boolean {
  const next = takeSnapshot(rootAbs);
  const prev = snapshots.get(entryId);
  snapshots.set(entryId, next);
  return snapshotHasChanges(prev, next);
}

function resolveKinds(entry: MonitorEntry): KindId[] {
  if (entry.kinds.length) {
    return pickKinds(entry.kinds).map((k) => k.id);
  }
  return pickKinds(["*enabled"]).map((k) => k.id);
}

function hasActiveJob(kinds: KindId[], mode: string): boolean {
  const { jobs } = queryJobs({ page: 1, pageSize: 50 });
  const kindKey = [...kinds].sort().join(",");
  return jobs.some((j) => {
    if (j.status !== "queued" && j.status !== "running" && j.status !== "paused") return false;
    if (j.mode !== mode) return false;
    const jk = [...j.kinds].sort().join(",");
    return jk === kindKey || kinds.every((k) => j.kinds.includes(k));
  });
}

async function triggerEntry(entry: MonitorEntry, reason: string): Promise<void> {
  const kinds = resolveKinds(entry);
  if (!kinds.length) return;
  const now = Date.now();
  const last = lastTrigger.get(entry.id) || 0;
  if (now - last < 15_000) return;
  if (hasActiveJob(kinds, entry.jobMode)) return;

  lastTrigger.set(entry.id, now);
  try {
    const job = await createJob({
      kinds,
      mode: entry.jobMode,
      dryRun: false,
      remember: false,
      triggerSource: "monitor",
      options: { forceScan: false },
    });
    console.log(`[monitor] ${reason} → 任务 ${job.id}（${entry.jobMode} / ${kinds.join(",")})`);
  } catch (err) {
    console.warn(
      `[monitor] 创建任务失败: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function pollOnce(): Promise<void> {
  const cfg = loadOpsConfig();
  if (!cfg.monitor.enabled) return;
  for (const entry of activeEntries(cfg)) {
    const abs = resolveMonitorPath(entry.path);
    if (!abs || !fs.existsSync(abs)) continue;
    if (hasDirectoryChanges(entry.id, abs)) {
      await triggerEntry(entry, `检测到目录变更 ${entry.path}`);
    }
  }
}

function clearWatchers() {
  for (const w of watchers.values()) {
    try {
      w.close();
    } catch {
      /* ignore */
    }
  }
  watchers.clear();
}

function scheduleDebouncedPoll() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    void pollOnce();
  }, 3000);
}

function startWatchers(cfg: OpsConfig) {
  clearWatchers();
  if (!cfg.monitor.enabled || cfg.monitor.mode !== "performance") return;
  for (const entry of activeEntries(cfg)) {
    const abs = resolveMonitorPath(entry.path);
    if (!abs || !fs.existsSync(abs)) continue;
    try {
      const w = fs.watch(abs, { recursive: true }, () => scheduleDebouncedPoll());
      watchers.set(entry.id, w);
    } catch (err) {
      console.warn(
        `[monitor] 性能模式监听失败（${abs}），请改用兼容模式: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}

function restartFromConfig(cfg: OpsConfig) {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  clearWatchers();
  if (!cfg.monitor.enabled) {
    console.log("[monitor] 已停用");
    return;
  }
  if (cfg.monitor.mode === "compat") {
    pollTimer = setInterval(() => void pollOnce(), cfg.monitor.intervalSec * 1000);
    console.log(`[monitor] 兼容模式已启动，间隔 ${cfg.monitor.intervalSec}s`);
    void pollOnce();
  } else {
    startWatchers(cfg);
    console.log("[monitor] 性能模式已启动（FS 事件；仅适合本机原生目录）");
    void pollOnce();
  }
}

export function startMonitorService(): void {
  if (started) {
    restartFromConfig(loadOpsConfig());
    return;
  }
  started = true;
  onOpsConfigChange((cfg) => restartFromConfig(cfg));
  restartFromConfig(loadOpsConfig());
}

export function stopMonitorService(): void {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  if (debounceTimer) clearTimeout(debounceTimer);
  clearWatchers();
  started = false;
}

export async function runMonitorPollOnce(): Promise<void> {
  await pollOnce();
}

export { snapshotHasChanges, type Snapshot as MonitorSnapshot };
