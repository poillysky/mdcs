import { hostNeedsFlare } from "../flaresolverr.js";

/** HTML 上限（防异常大页 / 压缩炸弹撑爆 RSS） */
export const MAX_HTML_BYTES = Math.max(
  1_000_000,
  Math.min(
    12_000_000,
    Number(process.env.SCRAPE_MAX_HTML_BYTES || 3_000_000) || 3_000_000,
  ),
);
/** 单张封面上限 */
export const MAX_IMAGE_BYTES = Math.max(
  200_000,
  Math.min(
    20_000_000,
    Number(process.env.SCRAPE_MAX_IMAGE_BYTES || 5_000_000) || 5_000_000,
  ),
);

/** 同 host 限流：快源可并行；过盾站仍单飞（先建 cookie 再复用）。 */
type HostSem = {
  max: number;
  active: number;
  wait: Array<() => void>;
};
const hostSems = new Map<string, HostSem>();

/** 直连刚被 CF 打回（403）的 host：短时跳过直连，少烧无效请求 */
const directSkipUntil = new Map<string, number>();
const DIRECT_SKIP_MS = 3 * 60 * 1000;

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase() || "default";
  } catch {
    return "default";
  }
}

function hostMaxParallel(host: string): number {
  const h = host || "default";
  // 过盾站：必须串行，否则多开会话/空打 CF
  try {
    if (hostNeedsFlare(`https://${h}/`)) return 1;
  } catch {
    /* ignore */
  }
  // 默认 1：同站少堆 HTML；可用 SCRAPE_HOST_PARALLEL 覆盖（1–4）
  const n = Number(process.env.SCRAPE_HOST_PARALLEL || 1) || 1;
  return Math.max(1, Math.min(4, n));
}

/** 尽量排空 / 取消 undici 响应体，避免连接与缓冲滞留 */
export async function drainBody(res: {
  body?: { cancel?: () => Promise<unknown> | unknown } | null;
  arrayBuffer?: () => Promise<ArrayBuffer>;
}): Promise<void> {
  try {
    if (res.body && typeof res.body.cancel === "function") {
      await res.body.cancel();
      return;
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof res.arrayBuffer === "function") await res.arrayBuffer();
  } catch {
    /* ignore */
  }
}

export function contentLengthTooLarge(
  headers: { get: (n: string) => string | null },
  max: number,
): boolean {
  const cl = Number(headers.get("content-length") || 0);
  return Number.isFinite(cl) && cl > max;
}

export function markDirectSkip(host: string): void {
  if (!host) return;
  directSkipUntil.set(host, Date.now() + DIRECT_SKIP_MS);
}

export function shouldSkipDirect(host: string): boolean {
  const until = directSkipUntil.get(host) || 0;
  if (!until) return false;
  if (Date.now() >= until) {
    directSkipUntil.delete(host);
    return false;
  }
  return true;
}

export function clearDirectSkip(host: string): void {
  if (!host) return;
  directSkipUntil.delete(host);
}

export async function withHostGate<T>(host: string, fn: () => Promise<T>): Promise<T> {
  const key = host || "default";
  let sem = hostSems.get(key);
  if (!sem) {
    sem = { max: hostMaxParallel(key), active: 0, wait: [] };
    hostSems.set(key, sem);
  } else {
    sem.max = hostMaxParallel(key);
  }
  if (sem.active >= sem.max) {
    await new Promise<void>((resolve) => {
      sem!.wait.push(resolve);
    });
  }
  sem.active += 1;
  try {
    return await fn();
  } finally {
    sem.active = Math.max(0, sem.active - 1);
    const next = sem.wait.shift();
    if (next) next();
  }
}
