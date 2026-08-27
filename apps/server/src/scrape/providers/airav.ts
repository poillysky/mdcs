import { looksBlockedHtml } from "../network/flaresolverr.js";
import {
  airavDetailCodeOk,
  airavIoProvider,
  parseAiravIoDetail,
} from "./airav_io.js";
import { pageMentionsCode } from "./htmlUtils.js";
import { fetchPageForSite, prepareProviderFetch } from "./providerSite.js";
import type { ProviderResult, ScrapeContext, ScrapeProvider } from "../types.js";

const WIKI_DEFAULT = "https://www.airav.wiki";

/** 色花 scrapeAiravWiki：wiki /video/{CODE} 回退 */
export async function scrapeAiravWikiFallback(
  code: string,
  signal?: AbortSignal,
): Promise<ProviderResult | null> {
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) return null;

  const site = await prepareProviderFetch("airav", WIKI_DEFAULT);
  const wikiBase = site.baseUrl.replace(/\/$/, "");
  const page = await fetchPageForSite(
    `${wikiBase}/video/${encodeURIComponent(normalized)}`,
    site,
    {
      signal,
      referer: `${wikiBase}/`,
      timeoutMs: 20000,
      viaFlare: false,
      strictTimeout: true,
    },
  );
  const html = page?.html || "";
  const landed = page?.finalUrl || `${wikiBase}/video/${normalized}`;
  if (!html || looksBlockedHtml(html)) return null;
  if (
    /找不到|404|Not Found|521:\s*Web server/i.test(html.slice(0, 2500)) &&
    !/video-title|og:title|番[号號]/i.test(html)
  ) {
    return null;
  }
  if (!airavDetailCodeOk(html, normalized) && !pageMentionsCode(html, normalized)) {
    return null;
  }
  const parsed = parseAiravIoDetail(html, landed, normalized);
  if (!parsed || (!parsed.fields.title && !parsed.coverUrl)) return null;
  return { ...parsed, source: "airav", ms: 0, fields: parsed.fields ?? {} };
}

async function scrapeAiravDetail(code: string, signal?: AbortSignal): Promise<ProviderResult> {
  const started = Date.now();
  const ctx: ScrapeContext = {
    code,
    kind: "japan_censored",
    metaSources: [],
    coverSources: [],
    signal,
  };

  const fromIo = await airavIoProvider.scrape(ctx);
  if (fromIo && !fromIo.error && (fromIo.fields.title || fromIo.coverUrl)) {
    return { ...fromIo, source: "airav", ms: Date.now() - started };
  }

  const fallback = await scrapeAiravWikiFallback(code, signal);
  if (fallback) {
    return { ...fallback, ms: Date.now() - started };
  }

  return {
    source: "airav",
    fields: {},
    ms: Date.now() - started,
    error: fromIo?.error || "未找到",
  };
}

export const airavProvider: ScrapeProvider = {
  id: "airav",
  async scrape(ctx: ScrapeContext): Promise<ProviderResult | null> {
    try {
      return await scrapeAiravDetail(ctx.code, ctx.signal);
    } catch (err) {
      return {
        source: "airav",
        fields: {},
        ms: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
