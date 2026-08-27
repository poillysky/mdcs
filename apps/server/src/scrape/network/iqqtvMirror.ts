/**
 * iQQTV 入口常 301 到新镜像（如 iqq5.xyz → iqqk4.quest）。
 * 跟随跳转并缓存可用基址；探测与刮削共用。
 */

import fs from "node:fs";
import path from "node:path";
import { fetchPage } from "./download.js";
import { looksBlockedHtml } from "./flaresolverr.js";
import { loadScrapeConfig, saveScrapeConfig } from "../../config/loadScrape.js";

/** 当前可用落地站靠前；旧入口仅作首次 301 发现 */
const ENTRY_SEEDS = [
  "https://iqqk4.quest/cn",
  "https://www.iqqk4.quest/cn",
  "https://iqq5.xyz/cn",
  "https://www.iqq5.xyz/cn",
  "https://iqq6.xyz/cn",
];

/** 已知只做跳转、不宜作为直连基址的入口 */
const REDIRECT_SEED_HOSTS = new Set([
  "iqq5.xyz",
  "iqq6.xyz",
  "iqqtv.net",
  "www.iqqtv.net",
]);

const TTL_MS = 6 * 60 * 60 * 1000;

type MirrorCache = {
  baseUrl: string;
  discoveredFrom?: string;
  updatedAt: string;
  expiresAt: number;
};

let storePath = "";
let memory: MirrorCache | null = null;
let resolving: Promise<string> | null = null;

function syncIqqtvBaseUrlToScrapeConfigIfNeeded(landedRoot: string): void {
  // 测试/未初始化场景：不写配置，避免污染真实 scrape.json
  if (!storePath) return;
  if (process.env.NODE_ENV === "test") return;

  const nextBaseUrl = `${landedRoot}/cn`;
  try {
    const cfg = loadScrapeConfig(true);
    const cur = cfg.providerSettings?.["iqqtv"]?.baseUrl?.trim() ?? "";
    if (cur === nextBaseUrl) return;

    // 只有当前配置为空或仍在“会 301 跳转的网关域名”上时，才覆盖。
    // 这样用户若手动填了别的可直连地址，不会被自动推翻。
    const shouldOverride = !cur || isIqqtvRedirectSeed(cur);
    if (!shouldOverride) return;

    const prevEntry = (cfg.providerSettings as any)?.["iqqtv"] ?? ({} as any);
    const nextProviderSettings = {
      ...(cfg.providerSettings ?? {}),
      iqqtv: { ...prevEntry, baseUrl: nextBaseUrl },
    };
    saveScrapeConfig({ ...cfg, providerSettings: nextProviderSettings });
  } catch {
    // 配置同步不影响主流程
  }
}

export function setIqqtvMirrorStorePath(filePath: string): void {
  storePath = String(filePath || "").trim();
  memory = null;
  loadFromDisk();
  const baseUrl = (memory as MirrorCache | null)?.baseUrl;
  if (baseUrl) syncIqqtvBaseUrlToScrapeConfigIfNeeded(baseUrl);
}

function loadFromDisk(): void {
  if (!storePath || !fs.existsSync(storePath)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(storePath, "utf8")) as MirrorCache;
    if (raw?.baseUrl && Number(raw.expiresAt) > Date.now()) {
      memory = raw;
    }
  } catch {
    /* ignore */
  }
}

function persist(cache: MirrorCache): void {
  memory = cache;
  if (storePath) {
    try {
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    fs.writeFileSync(storePath, JSON.stringify(cache, null, 2), "utf8");
    console.log(`[scrape] iqqtv mirror → ${cache.baseUrl}`);
  }
    catch (e) {
      console.warn(
        "[scrape] iqqtv-mirror.json write failed:",
        e instanceof Error ? e.message : e,
      );
    }
  }
  syncIqqtvBaseUrlToScrapeConfigIfNeeded(cache.baseUrl);
}

export function invalidateIqqtvMirror(): void {
  memory = null;
  if (storePath && fs.existsSync(storePath)) {
    try {
      fs.unlinkSync(storePath);
    } catch {
      /* ignore */
    }
  }
}

/** 规范化为 https://host （不含 /cn；刮削侧再拼 /cn） */
export function normalizeIqqtvRoot(raw: string): string {
  let b = String(raw || "")
    .trim()
    .replace(/\/$/, "");
  if (!b) return "";
  if (!/^https?:\/\//i.test(b)) b = `https://${b}`;
  try {
    const u = new URL(b);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (!host) return "";
    return `https://${host}`;
  } catch {
    return "";
  }
}

export function isIqqtvSiteHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  if (REDIRECT_SEED_HOSTS.has(h)) return true;
  return /^iqqk?\d+\.(xyz|quest|net|tv|cc|top|fun)$/i.test(h) || /^iqqtv\./i.test(h);
}

/** 旧入口域名：会 301，不能当直连基址 */
export function isIqqtvRedirectSeed(root: string): boolean {
  const host = normalizeIqqtvRoot(root).replace(/^https:\/\//i, "").toLowerCase();
  return REDIRECT_SEED_HOSTS.has(host);
}

export function rememberIqqtvMirror(baseUrl: string, from?: string): void {
  const n = normalizeIqqtvRoot(baseUrl);
  if (!n || isIqqtvRedirectSeed(n)) return;
  if (memory?.baseUrl === n && memory.expiresAt > Date.now()) return;
  persist({
    baseUrl: n,
    discoveredFrom: from || memory?.discoveredFrom,
    updatedAt: new Date().toISOString(),
    expiresAt: Date.now() + TTL_MS,
  });
  syncIqqtvBaseUrlToScrapeConfigIfNeeded(n);
}

/** 请求落地 URL 若已跳到新镜像，立刻写入缓存，后续直连 */
export function rememberIqqtvMirrorFromFinalUrl(finalUrl: string, from?: string): string | null {
  const n = normalizeIqqtvRoot(finalUrl);
  if (!n || isIqqtvRedirectSeed(n)) return null;
  try {
    const host = new URL(n).hostname;
    if (!isIqqtvSiteHost(host)) return null;
  } catch {
    return null;
  }
  rememberIqqtvMirror(n, from);
  return n;
}

function liveCachedRoot(): string | null {
  if (!memory?.baseUrl || memory.expiresAt <= Date.now()) return null;
  if (isIqqtvRedirectSeed(memory.baseUrl)) return null;
  return memory.baseUrl;
}

/** 仅读缓存，不触发网络发现（连通探测用） */
export function getCachedIqqtvRoot(): string | null {
  const hit = liveCachedRoot();
  if (hit) return hit;
  loadFromDisk();
  return liveCachedRoot();
}

function looksLikeIqqtv(html: string): boolean {
  if (!html || html.length < 800) return false;
  if (looksBlockedHtml(html) && html.length < 8000) return false;
  return /iqq|player\.php|search\.php|ga_name|tag-info/i.test(html);
}

async function probeRoot(root: string): Promise<string | null> {
  const cn = `${root}/cn`;
  const page = await fetchPage(`${cn}/`, {
    timeoutMs: 18000,
    referer: `${cn}/`,
    sourceId: "iqqtv",
    viaFlare: false,
    strictTimeout: true,
  });
  if (!page?.html || !looksLikeIqqtv(page.html)) return null;
  const landed = normalizeIqqtvRoot(page.finalUrl) || root;
  if (landed === root) return landed;
  // 入口已跳到新镜像，再确认落地站可用
  const again = await fetchPage(`${landed}/cn/`, {
    timeoutMs: 15000,
    referer: `${landed}/cn/`,
    sourceId: "iqqtv",
    viaFlare: false,
    strictTimeout: true,
  });
  if (again?.html && looksLikeIqqtv(again.html)) {
    return normalizeIqqtvRoot(again.finalUrl) || landed;
  }
  return landed;
}

async function discoverOnce(preferred?: string): Promise<string> {
  const seeds = [
    normalizeIqqtvRoot(preferred || ""),
    memory?.baseUrl ? normalizeIqqtvRoot(memory.baseUrl) : "",
    ...ENTRY_SEEDS.map(normalizeIqqtvRoot),
  ].filter(Boolean);
  const uniq = [...new Set(seeds)];

  for (const seed of uniq) {
    try {
      const hit = await probeRoot(seed);
      if (hit && !isIqqtvRedirectSeed(hit)) {
        persist({
          baseUrl: hit,
          discoveredFrom: preferred || ENTRY_SEEDS[0],
          updatedAt: new Date().toISOString(),
          expiresAt: Date.now() + TTL_MS,
        });
        return hit;
      }
      if (hit) return fallbackRoot(preferred);
    } catch {
      /* try next */
    }
  }

  return fallbackRoot(preferred);
}

function fallbackRoot(preferred?: string): string {
  const n =
    normalizeIqqtvRoot(preferred || "") ||
    normalizeIqqtvRoot(ENTRY_SEEDS[0]!) ||
    "https://iqqk4.quest";
  return isIqqtvRedirectSeed(n) ? "https://iqqk4.quest" : n;
}

/** 解析当前可用 iQQTV 根域名（自动跟 301 镜像，带磁盘缓存）。 */
export async function resolveIqqtvRoot(opts?: {
  preferred?: string;
  forceRefresh?: boolean;
}): Promise<string> {
  if (!opts?.forceRefresh) {
    const cached = liveCachedRoot();
    if (cached) return cached;
  }
  if (resolving) return resolving;
  resolving = discoverOnce(opts?.preferred)
    .catch(() => fallbackRoot(opts?.preferred))
    .finally(() => {
      resolving = null;
    });
  return resolving;
}
