/**
 * 兼容层：旧 flareGet / normalizeFlareUrl 走色花 flaresolverr。
 */
import { getNetworkConfig } from "../../config/loadScrape.js";
import { applyProxy, getActiveProxy, normalizeProxyUrl } from "./proxy.js";
import {
  applyFlareSolverr,
  fetchViaFlareSolverrFull,
  looksBlockedHtml,
  normalizeFlareUrl,
} from "./flaresolverr.js";

export { looksBlockedHtml, normalizeFlareUrl } from "./flaresolverr.js";

export type FlareResult = {
  ok: boolean;
  status: number;
  html: string;
  url: string;
  ms: number;
  error?: string;
};

/**
 * 经 FlareSolverr 取页（对齐色花：proxy:{url} + session）。
 */
export async function flareGet(
  url: string,
  opts?: {
    signal?: AbortSignal;
    timeoutMs?: number;
    flareUrl?: string;
    useProxy?: boolean;
    cookie?: string;
    noSessionRetry?: boolean;
  },
): Promise<FlareResult> {
  const started = Date.now();
  const cfg = getNetworkConfig();
  const flareUrl = normalizeFlareUrl(opts?.flareUrl) || normalizeFlareUrl(cfg.flareSolverrUrl);
  if (!flareUrl) {
    return {
      ok: false,
      status: 0,
      html: "",
      url,
      ms: Date.now() - started,
      error: "未配置 FlareSolverr",
    };
  }
  applyFlareSolverr(flareUrl);
  if (opts?.useProxy !== false) {
    const proxy = normalizeProxyUrl(getActiveProxy() || cfg.proxyUrl);
    if (proxy && proxy !== getActiveProxy()) applyProxy(proxy);
  }

  const timeout = Math.max(3000, opts?.timeoutMs ?? 60_000);
  try {
    const hit = await fetchViaFlareSolverrFull(url, {
      timeoutMs: timeout,
      cookie: opts?.cookie,
      useProxy: opts?.useProxy !== false,
      noSessionRetry: opts?.noSessionRetry,
    });
    if (looksBlockedHtml(hit.html)) {
      return {
        ok: false,
        status: 403,
        html: hit.html,
        url: hit.finalUrl || url,
        ms: Date.now() - started,
        error: "仍是挑战页（过盾未完成）",
      };
    }
    return {
      ok: true,
      status: 200,
      html: hit.html,
      url: hit.finalUrl || url,
      ms: Date.now() - started,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      html: "",
      url,
      ms: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
