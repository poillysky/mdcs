import { createJob } from "../jobs/scheduler.js";
import type { JobMode, KindId } from "../types.js";
import { loadOpsConfig } from "./loadOps.js";

export type QbCompletedPayload = {
  category?: string;
  savePath?: string;
  name?: string;
  hash?: string;
  tags?: string;
};

export type QbHookResult = {
  triggered: boolean;
  reason?: string;
  jobId?: string;
};

/** qBittorrent 完成钩子：按分类过滤后建任务 */
export async function handleQbCompleted(payload: QbCompletedPayload): Promise<QbHookResult> {
  const cfg = loadOpsConfig();
  if (!cfg.qb.enabled) {
    return { triggered: false, reason: "qB 钩子未启用" };
  }

  const category = (payload.category || "").trim();
  if (cfg.qb.categories.length) {
    const hit = cfg.qb.categories.some((c) => c.toLowerCase() === category.toLowerCase());
    if (!hit) {
      return { triggered: false, reason: `分类未命中：${category || "(空)"}` };
    }
  }

  const kinds: string[] = cfg.qb.kinds.length ? cfg.qb.kinds : ["*enabled"];
  const mode: JobMode = cfg.qb.jobMode;
  const job = await createJob({
    kinds,
    mode,
    dryRun: false,
    remember: false,
    triggerSource: "qb",
  });

  return { triggered: true, jobId: job.id };
}

export function parseQbPayload(body: unknown, query: Record<string, unknown>): QbCompletedPayload {
  const src =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const pick = (key: string): string => {
    const v = src[key] ?? query[key];
    return typeof v === "string" ? v : v != null ? String(v) : "";
  };
  return {
    category: pick("category") || pick("Category") || pick("label") || pick("L"),
    savePath: pick("savePath") || pick("save_path") || pick("contentPath") || pick("F"),
    name: pick("name") || pick("torrentName") || pick("N"),
    hash: pick("hash") || pick("infohash_v1") || pick("I"),
    tags: pick("tags") || pick("G"),
  };
}

/** 仅供测试：分类是否命中 */
export function qbCategoryMatches(categories: string[], category: string): boolean {
  if (!categories.length) return true;
  const c = category.trim().toLowerCase();
  return categories.some((x) => x.toLowerCase() === c);
}

export type { KindId };
