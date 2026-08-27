import * as cheerio from "cheerio";
import { fetchText } from "../network/fetch.js";
import { fetchPageWithOpts } from "../network/fetch.js";
import { absUrl, cleanTitle, isJunkCoverUrl, isJunkTitle, stripTags } from "./htmlUtils.js";
import { prepareProviderFetch, siteFetchOpts } from "./providerSite.js";
import type { ProviderResult, ScrapeContext, ScrapeProvider } from "../types.js";

const DEFAULT_BASE = "http://hsck.net";

function normalizeCode(raw: string): string {
  return String(raw || "").trim().toUpperCase().replace(/_/g, "-");
}

function compactCode(raw: string): string {
  return normalizeCode(raw).replace(/[^A-Z0-9]/g, "");
}

function buildSearchCandidates(code: string): string[] {
  const norm = normalizeCode(code);
  const compact = compactCode(code);
  const m = norm.match(/^([A-Z]{2,10})-?(\d{2,6}(?:-\d+)?)$/);
  const out = new Set<string>([norm, compact]);
  if (m) {
    out.add(`${m[1]}-${m[2]}`);
    out.add(`${m[1]}${m[2]}`);
  }
  return [...out].filter(Boolean);
}

function parseGatewayBase(html: string): string | null {
  const m = html.match(/"(https?:\/\/[^"]+\?u=)\+window\.location/i);
  if (!m?.[1]) return null;
  const raw = m[1].replace(/\?u=$/i, "");
  try {
    return new URL(raw).origin + "/";
  } catch {
    return null;
  }
}

function buildGatewayUrl(baseUrl: string, gatewayBase: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${gatewayBase}?u=${encodeURIComponent(base + "/")}&p=${encodeURIComponent("/")}`;
}

export function parseHscangkuSearchHit(
  html: string,
  code: string,
  baseUrl: string,
): { detailUrl: string | null; coverUrl: string | null } {
  const $ = cheerio.load(html);
  const want = compactCode(code);
  let detailUrl = "";
  let coverUrl = "";
  $("a.stui-vodlist__thumb.lazyload, a.stui-vodlist__thumb").each((_, el) => {
    if (detailUrl) return;
    const href = String($(el).attr("href") || "").trim();
    const title = stripTags(String($(el).attr("title") || ""));
    if (!href) return;
    // 仅接受详情播放页；过滤分页/搜索链接，避免把 /vodsearch/... 误判成详情
    if (!/^\/(?:v\d+|vodplay)\/\d+-\d+-\d+\.html$/i.test(href)) return;
    const hay = compactCode(`${title} ${href}`);
    if (want && hay.includes(want)) {
      detailUrl = href;
      coverUrl =
        absUrl($(el).attr("data-original") || $(el).attr("data-src") || $(el).attr("src"), baseUrl) || "";
    }
  });
  return {
    detailUrl: absUrl(detailUrl, baseUrl),
    coverUrl: coverUrl || null,
  };
}

export function parseHscangkuDetail(html: string, detailUrl: string, code: string): Omit<ProviderResult, "source" | "ms"> | null {
  const $ = cheerio.load(html);
  const hrefKey = (detailUrl.split("/").pop() || "").replace(/\.[^.]+$/, "");
  let title =
    $("h3.title")
      .map((_, el) => stripTags($(el).text()))
      .get()
      .find((t) => t && !/目录|为你推荐/i.test(t)) ||
    stripTags($("title").first().text()).replace(/\s*-\s*黄色仓库.*$/i, "");
  title = cleanTitle(title, code);
  title = title.replace(new RegExp(`^${compactCode(code)}\\s*`, "i"), "").trim();
  if (!title || isJunkTitle(title)) title = "";

  const coverCandidates: string[] = [];
  const pushCover = (raw: string | undefined) => {
    const u = absUrl(String(raw || "").trim(), detailUrl);
    if (!u || isJunkCoverUrl(u)) return;
    if (!coverCandidates.includes(u)) coverCandidates.push(u);
  };
  $(`a[data-original][href*='${hrefKey}']`).each((_, el) => pushCover($(el).attr("data-original")));
  pushCover($("meta[property='og:image']").attr("content"));
  $(".stui-content__thumb img, .stui-vodlist__thumb img, img").each((_, el) => {
    pushCover($(el).attr("data-original"));
    pushCover($(el).attr("data-src"));
    pushCover($(el).attr("src"));
  });
  const coverUrl = coverCandidates[0] || null;

  if (!title && !coverUrl) return null;
  return {
    fields: {
      title: title || undefined,
      titleZh: title || undefined,
      website: detailUrl,
    },
    coverUrl,
    alternateCoverUrls: coverCandidates.slice(1, 6),
  };
}

async function scrapeHscangku(code: string, signal?: AbortSignal): Promise<ProviderResult> {
  const started = Date.now();
  const site = await prepareProviderFetch("hscangku", DEFAULT_BASE);
  const base = site.baseUrl || DEFAULT_BASE;

  let searchBase = base;
  let gatewayBase: string | null = null;
  try {
    const homeHtml = await fetchText(base, siteFetchOpts(site, { signal, referer: `${base}/`, timeoutMs: 20000 }));
    gatewayBase = parseGatewayBase(homeHtml);
    if (gatewayBase) {
      const gate = await fetchPageWithOpts(
        buildGatewayUrl(base, gatewayBase),
        {
          signal,
          referer: `${base}/`,
          timeoutMs: 25000,
          proxyUrlOverride: site.proxyUrlOverride,
          viaFlare: false,
        },
      );
      const finalUrl = String(gate?.finalUrl || "");
      if (finalUrl) {
        try {
          searchBase = new URL(finalUrl).origin;
        } catch {
          searchBase = base;
        }
      }
    }
  } catch {
    // 首页不通也继续试默认 search base
  }

  for (const q of buildSearchCandidates(code)) {
    const searchUrl = `${searchBase}/vodsearch/-------------.html?wd=${encodeURIComponent(q)}&submit=`;
    const searchPage = await fetchPageWithOpts(
      searchUrl,
      siteFetchOpts(site, { signal, referer: `${searchBase}/`, timeoutMs: 25000 }),
    );
    const searchHtml = searchPage?.html || "";
    const searchFinal = String(searchPage?.finalUrl || searchUrl);
    let searchFinalBase = searchBase;
    try {
      searchFinalBase = new URL(searchFinal).origin;
    } catch {
      // keep fallback
    }
    const hit = parseHscangkuSearchHit(searchHtml, code, searchFinalBase);
    const detailUrl = hit.detailUrl;
    if (!detailUrl) continue;
    const detailHtml = await fetchText(
      detailUrl,
      siteFetchOpts(site, { signal, referer: searchUrl, timeoutMs: 25000 }),
    );
    const parsed = parseHscangkuDetail(detailHtml, detailUrl, code);
    if (parsed?.fields.title || parsed?.coverUrl) {
      const betterCover =
        hit.coverUrl && !/\.gif(?:\?|$)/i.test(hit.coverUrl) ? hit.coverUrl : parsed.coverUrl;
      return {
        source: "hscangku",
        ...parsed,
        coverUrl: betterCover,
        ms: Date.now() - started,
      };
    }
  }

  return { source: "hscangku", fields: {}, ms: Date.now() - started, error: "未找到" };
}

export const hscangkuProvider: ScrapeProvider = {
  id: "hscangku",
  async scrape(ctx: ScrapeContext): Promise<ProviderResult | null> {
    try {
      return await scrapeHscangku(ctx.code, ctx.signal);
    } catch (err) {
      return {
        source: "hscangku",
        fields: {},
        ms: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};

