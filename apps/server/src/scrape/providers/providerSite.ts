import { loadScrapeConfig } from "../../config/loadScrape.js";
import {
  fetchPageWithOpts,
  type FetchOpts,
  type FetchPageResult,
} from "../network/fetch.js";
import { resolveSiteMirror } from "../network/siteMirror.js";
import type { SourceId } from "../types.js";
import {
  getCatalogEntry,
  normalizeProviderAccess,
  type NormalizedProviderAccess,
} from "./catalog.js";

export type ResolvedProviderSite = {
  id: SourceId;
  baseUrl: string;
  access: NormalizedProviderAccess;
  cookie?: string;
  userAgent?: string;
  proxyUrlOverride?: string;
  cooldownSec: number;
  overrideRetry: boolean;
  retry: number;
};

/** 每源上次发请求时间（冷却） */
const lastHitAt = new Map<string, number>();

/**
 * 合并 catalog 默认与 scrape.json.providerSettings。
 * 优先用镜像缓存（skipDiscover，探活/刮削共用）。
 */
export function resolveProviderSite(id: SourceId, fallbackBase = ""): ResolvedProviderSite {
  const entry = getCatalogEntry(id);
  const site = loadScrapeConfig().providerSettings?.[id];
  const preferred = (site?.baseUrl || entry?.defaultUrl || fallbackBase || "").replace(/\/$/, "");
  const cookie = site?.cookie?.trim() || entry?.defaultCookie?.trim() || undefined;
  return {
    id,
    baseUrl: preferred,
    access: normalizeProviderAccess(entry?.access),
    cookie,
    userAgent: site?.userAgent?.trim() || undefined,
    proxyUrlOverride: site?.proxyUrl?.trim() || undefined,
    cooldownSec: site?.cooldownSec ?? entry?.defaultCooldownSec ?? 0,
    overrideRetry: Boolean(site?.overrideRetry),
    retry: Math.max(0, site?.retry ?? 0),
  };
}

/** 本源失败重试次数：overrideRetry 时用卡片值，否则全局 providerRetryDefault */
export function resolveProviderRetry(id: SourceId): number {
  const site = loadScrapeConfig().providerSettings?.[id];
  if (site?.overrideRetry) return Math.max(0, site.retry ?? 0);
  return Math.max(0, loadScrapeConfig().providerRetryDefault ?? 0);
}

export async function respectProviderCooldown(id: SourceId, cooldownSec: number): Promise<void> {
  if (cooldownSec <= 0) return;
  const last = lastHitAt.get(id) ?? 0;
  const wait = last + cooldownSec * 1000 - Date.now();
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastHitAt.set(id, Date.now());
}

/** 冷却 + 镜像基址（只读缓存，不强制全量发现） */
export async function prepareProviderFetch(
  id: SourceId,
  fallbackBase = "",
): Promise<ResolvedProviderSite> {
  const site = resolveProviderSite(id, fallbackBase);
  await respectProviderCooldown(id, site.cooldownSec);
  try {
    const mirrored = await resolveSiteMirror(id, {
      preferred: site.baseUrl || undefined,
      skipDiscover: true,
    });
    if (mirrored) {
      site.baseUrl = mirrored.replace(/\/$/, "");
    }
  } catch {
    /* 镜像解析失败则沿用 preferred */
  }
  return site;
}

export function siteFetchOpts(site: ResolvedProviderSite, extra: FetchOpts = {}): FetchOpts {
  return {
    access: site.access,
    cookie: site.cookie,
    userAgent: site.userAgent,
    proxyUrlOverride: site.proxyUrlOverride,
    sourceId: site.id,
    ...extra,
  };
}

/** 刮削/测通统一取页：代理覆盖 + Cookie + UA + access */
export async function fetchPageForSite(
  url: string,
  site: ResolvedProviderSite,
  extra: FetchOpts & {
    viaFlare?: boolean;
    strictTimeout?: boolean;
    waitInSeconds?: number;
  } = {},
): Promise<FetchPageResult | null> {
  return fetchPageWithOpts(url, siteFetchOpts(site, extra));
}
