/**
 * MDCS 取页入口：映射 access → 色花 fetchPage（curl→undici→Flare）。
 * 对外仍抛错（兼容现有 Provider）。
 */
import { getNetworkConfig } from "../../config/loadScrape.js";
import type { ProviderAccess } from "../providers/catalog.js";
import {
  fetchJson as downloadFetchJson,
  fetchPage,
  fetchPostForm as downloadFetchPostForm,
  type FetchPageResult,
} from "./download.js";
import { getCachedClearance, looksBlockedHtml, mergeCookieHeaders } from "./flaresolverr.js";
import { applyProxy, getActiveProxy, undiciGet } from "./proxy.js";

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export type FetchOpts = {
  signal?: AbortSignal;
  referer?: string;
  access?: ProviderAccess;
  timeoutMs?: number;
  cookie?: string;
  userAgent?: string;
  /** 传给 fetchPage / adaptive / Cookie 默认 */
  sourceId?: string;
  viaFlare?: boolean;
  strictTimeout?: boolean;
  waitInSeconds?: number;
  /** 测通：禁止 sessions.create */
  noSessionRetry?: boolean;
  /** 测通：忽略磁盘 clearance / Flare session，优先 curl 直链 */
  freshProbe?: boolean;
  /**
   * 空/缺省=跟随全局；字面量 "null"=本请求不强制改代理；
   * 其它 URL=临时切到该代理（仅本请求前后恢复）
   */
  proxyUrlOverride?: string;
};

export type { FetchPageResult };

function syncProxyFromConfig() {
  const { proxyUrl } = getNetworkConfig();
  if ((proxyUrl || "") !== getActiveProxy()) {
    applyProxy(proxyUrl);
  }
}

function normalizeAccess(access?: ProviderAccess): "proxy_adaptive" | "proxy_flare" {
  if (access === "proxy_flare") return "proxy_flare";
  return "proxy_adaptive";
}

/** access → viaFlare：仅强制过盾；自适应先代理/curl，遇盾再 Flare */
function viaFlareForAccess(access: "proxy_adaptive" | "proxy_flare"): boolean {
  return access === "proxy_flare";
}

async function withProxyOverride<T>(
  override: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const raw = (override || "").trim();
  if (!raw) {
    syncProxyFromConfig();
    return fn();
  }
  const prev = getActiveProxy();
  if (raw.toLowerCase() === "null") applyProxy("");
  else applyProxy(raw);
  try {
    return await fn();
  } finally {
    applyProxy(prev);
  }
}

export type FetchPageOpts = FetchOpts & {
  viaFlare?: boolean;
  strictTimeout?: boolean;
  waitInSeconds?: number;
  freshProbe?: boolean;
};

/**
 * 带 provider 站点参数（代理覆盖 / Cookie / UA / access）的取页。
 * 所有刮削、测通应优先走此入口，勿裸调 download.fetchPage。
 */
export async function fetchPageWithOpts(
  url: string,
  opts: FetchPageOpts = {},
): Promise<FetchPageResult | null> {
  const access = normalizeAccess(opts.access);
  const timeoutMs = opts.timeoutMs ?? getNetworkConfig().requestTimeoutSec * 1000;

  return withProxyOverride(opts.proxyUrlOverride, async () => {
    const viaFlare = opts.viaFlare ?? viaFlareForAccess(access);
    const page = await fetchPage(url, {
      timeoutMs,
      referer: opts.referer,
      cookie: opts.cookie,
      userAgent: opts.userAgent,
      sourceId: opts.sourceId,
      access,
      viaFlare,
      strictTimeout: opts.strictTimeout,
      waitInSeconds: opts.waitInSeconds,
      noSessionRetry: opts.noSessionRetry,
      freshProbe: opts.freshProbe,
    });
    if (opts.sourceId && page?.finalUrl) {
      const { rememberSiteMirrorFromFinalUrl } = await import("./siteMirror.js");
      rememberSiteMirrorFromFinalUrl(opts.sourceId, page.finalUrl, url);
    }
    return page;
  });
}

/**
 * 按 access 拉取文本（色花 fetchPage）：
 * - proxy_adaptive（含旧 proxy）：impersonate curl→短 undici，遇盾回落 Flare
 * - proxy_flare：同样先 impersonate curl（有 cf_clearance 则带凭证）；失败或 SPA 空壳再 Flare
 */
export async function fetchText(url: string, opts: FetchOpts = {}): Promise<string> {
  const access = normalizeAccess(opts.access);
  const timeoutMs = opts.timeoutMs ?? getNetworkConfig().requestTimeoutSec * 1000;

  return withProxyOverride(opts.proxyUrlOverride, async () => {
    const viaFlare = opts.viaFlare ?? viaFlareForAccess(access);
    const page = await fetchPage(url, {
      timeoutMs,
      referer: opts.referer,
      cookie: opts.cookie,
      userAgent: opts.userAgent,
      sourceId: opts.sourceId,
      access,
      viaFlare,
      strictTimeout: opts.strictTimeout,
      waitInSeconds: opts.waitInSeconds,
    });
    const html = page?.html || "";
    if (opts.sourceId && page?.finalUrl) {
      const { rememberSiteMirrorFromFinalUrl } = await import("./siteMirror.js");
      rememberSiteMirrorFromFinalUrl(opts.sourceId, page.finalUrl, url);
    }
    if (!html) {
      throw new Error(access === "proxy_flare" ? "过盾超时 / 无响应" : "超时 / 无响应");
    }
    if (looksBlockedHtml(html)) {
      throw new Error("仍是挑战页（过盾未完成）");
    }
    return html;
  });
}

export async function fetchJson<T = unknown>(url: string, opts: FetchOpts = {}): Promise<T | null> {
  return withProxyOverride(opts.proxyUrlOverride, async () => {
    const raw = await downloadFetchJson(url, {
      timeoutMs: opts.timeoutMs,
      referer: opts.referer,
    });
    return (raw as T) ?? null;
  });
}

export async function fetchPostForm(
  url: string,
  body: string,
  opts: FetchOpts = {},
): Promise<string> {
  const access = normalizeAccess(opts.access);
  if (access === "proxy_flare") {
    throw new Error("fetchPostForm 不支持 proxy_flare");
  }
  return withProxyOverride(opts.proxyUrlOverride, async () => {
    const html = await downloadFetchPostForm(url, body, {
      timeoutMs: opts.timeoutMs,
      referer: opts.referer,
      cookie: opts.cookie,
      sourceId: opts.sourceId,
    });
    if (!html) throw new Error(`HTTP POST 失败 ${url}`);
    return html;
  });
}

export async function fetchBuffer(
  url: string,
  opts?: {
    signal?: AbortSignal;
    timeoutMs?: number;
    referer?: string;
    cookie?: string;
    proxyUrlOverride?: string;
  },
): Promise<Buffer> {
  return withProxyOverride(opts?.proxyUrlOverride, async () => {
    const timeoutMs = opts?.timeoutMs ?? getNetworkConfig().requestTimeoutSec * 1000;
    const signal = opts?.signal
      ? AbortSignal.any([opts.signal, AbortSignal.timeout(timeoutMs)])
      : AbortSignal.timeout(timeoutMs);
    // 叠加 cf_clearance：同 host 页面已过盾时，图片请求也带上凭证，避免 403
    const cached = getCachedClearance(url);
    const cookie = mergeCookieHeaders(opts?.cookie, cached?.cookieHeader) || opts?.cookie || "";
    const userAgent = cached?.userAgent || DEFAULT_UA;
    const headers: Record<string, string> = { "user-agent": userAgent };
    try {
      headers.Referer = opts?.referer || `${new URL(url).origin}/`;
    } catch {
      if (opts?.referer) headers.Referer = opts.referer;
    }
    if (cookie) headers.Cookie = cookie;
    const res = await undiciGet(url, {
      signal,
      headers,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  });
}
