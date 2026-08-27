import * as cheerio from "cheerio";
import { looksBlockedHtml } from "../network/flaresolverr.js";
import {
  absUrl,
  cleanTitle,
  codeKey,
  isJunkCoverUrl,
  isJunkTitle,
  pickOgImage,
  stdCode,
  stripTags,
} from "./htmlUtils.js";
import { fetchPageForSite, prepareProviderFetch } from "./providerSite.js";
import type { ProviderResult, ScrapeContext, ScrapeProvider } from "../types.js";

const DEFAULT_BASE = "https://missav123.com";
const DETAIL_SUFFIX_RE =
  /-(?:uncensored-leak|uncensored|chinese-subtitle|english-subtitle|chinese|english)$/i;

/** 详情 URL 路径 token：compact / hyphen 小写 */
export function missAvPathCodes(code: string): string[] {
  const std = stdCode(code);
  const out = new Set<string>();
  out.add(std.replace(/-/g, "").toLowerCase());
  out.add(std.toLowerCase());
  if (/^FC2/i.test(std)) {
    out.add(std.replace(/\s+/g, "-").toLowerCase());
  }
  return [...out];
}

export function isMissAvDetailHtml(html: string, code: string): boolean {
  if (!html || html.length < 5000) return false;
  if (looksBlockedHtml(html)) return false;
  if (!/property=["']og:type["']\s+content=["']video\.other["']/i.test(html)) return false;
  const std = stdCode(code);
  const pageCode =
    html.match(/<span>番号:<\/span>\s*<span[^>]*>([^<]+)</i)?.[1]?.trim() ||
    html.match(/dvdId:\s*['"]([^'"]+)['"]/i)?.[1]?.trim() ||
    "";
  if (pageCode && codeKey(pageCode) !== codeKey(std)) return false;
  const token = std.replace(/-/g, "[-]?");
  return new RegExp(token, "i").test(html.slice(0, 80000));
}

/** 搜索页挑详情链：优先有码正片，排除无码泄漏/字幕变体 */
export function pickMissAvDetailHref(html: string, code: string): string {
  const std = stdCode(code).toLowerCase();
  const compact = std.replace(/-/g, "");
  const hrefs = [
    ...html.matchAll(/href=["']([^"']+\/cn\/[^"'#?]+)["']/gi),
  ].map((m) => m[1]!);

  const scored = [...new Set(hrefs)].map((h) => {
    const path = h.split("?")[0]!.toLowerCase();
    const slug = path.split("/").pop() || "";
    let score = 0;
    if (DETAIL_SUFFIX_RE.test(slug)) score -= 80;
    if (slug === std || slug === compact) score += 100;
    else if (slug.startsWith(std) || slug.startsWith(compact)) score += 40;
    if (/\/cn\/search\//i.test(path)) score -= 50;
    if (/-uncensored-leak/i.test(slug)) score -= 30;
    if (/-chinese-subtitle|-english-subtitle/i.test(slug)) score -= 10;
    if (/\/dm\d+\/cn\//i.test(path)) score += 5;
    return { h, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].h : "";
}

function normalizeMissAvLabel(raw: string): string {
  return stripTags(raw).replace(/[:：\s]/g, "");
}

function missAvLabelHit(key: string, labels: string[]): boolean {
  const k = normalizeMissAvLabel(key);
  return labels.some((l) => k.includes(normalizeMissAvLabel(l)));
}

function parseMissAvLabelLinks(html: string, labels: string[]): string[] {
  const $ = cheerio.load(html);
  const out: string[] = [];
  $("div.text-secondary").each((_, el) => {
    const spans = $(el).find("span");
    const key = stripTags(spans.first().text());
    if (!missAvLabelHit(key, labels)) return;
    $(el)
      .find("a.text-nord13")
      .each((__, a) => {
        let t = stripTags($(a).text());
        t = t.replace(/\s*\([^)]*\)\s*$/, "").trim();
        if (t && !out.includes(t)) out.push(t);
      });
  });
  return out;
}

function parseMissAvInlineValue(html: string, labels: string[]): string {
  const $ = cheerio.load(html);
  let out = "";
  $("div.text-secondary").each((_, el) => {
    const spans = $(el).find("span");
    const key = stripTags(spans.first().text());
    if (!missAvLabelHit(key, labels)) return;
    const font = $(el).find("span.font-medium").first();
    if (font.length) out = stripTags(font.text());
    else {
      const raw = stripTags($(el).text());
      const stripped = labels.reduce((s, l) => s.replace(new RegExp(`^${l}[:：]?`), ""), raw);
      out = stripped.trim();
    }
  });
  return out.trim();
}

function parseMissAvPlot(html: string): string {
  const og =
    html.match(/property=["']og:description["']\s+content=["']([^"']+)["']/i)?.[1] ||
    html.match(/content=["']([^"']+)["']\s+property=["']og:description["']/i)?.[1] ||
    "";
  let plot = stripTags(og).trim();
  const $ = cheerio.load(html);
  const block = $("div.line-clamp-2, div.line-clamp-none").first();
  const fromBody = stripTags(block.text()).trim();
  if (fromBody.length > plot.length) plot = fromBody;
  plot = plot.replace(/^\[[^\]]+\]\s*/, "").trim();
  if (plot.length < 20 || /免费高清|MissAV|在线看/i.test(plot) && plot.length < 60) return "";
  return plot;
}

function parseMissAvTitleFromH1(html: string, code: string): string {
  const $ = cheerio.load(html);
  const raw = stripTags($("h1.text-base, h1").first().text());
  const std = stdCode(code);
  let title = raw.replace(new RegExp(`^${std.replace(/-/g, "[-]?")}\\s*`, "i"), "").trim();
  title = title.replace(/\s*[-–—]\s*[^-–—]+$/, "").trim();
  return cleanTitle(title, std);
}

export function parseMissAvMosaic(html: string, pageUrl: string): string {
  if (/-uncensored-leak|无码影片/i.test(`${pageUrl} ${html.slice(0, 12000)}`)) return "无码";
  if (/国产|chinese-av|chinese_av/i.test(html.slice(0, 15000))) return "国产";
  return "有码";
}

export function parseMissAvDetailHtml(
  html: string,
  pageUrl: string,
  code: string,
): ProviderResult | null {
  if (!isMissAvDetailHtml(html, code)) return null;

  const std = stdCode(code);
  const titleZh = parseMissAvTitleFromH1(html, std);
  const originaltitle = parseMissAvInlineValue(html, ["标题", "標題"]) || undefined;
  const title = titleZh || originaltitle || undefined;
  if (title && isJunkTitle(title)) return null;

  const actors = parseMissAvLabelLinks(html, ["女优", "女優"]).slice(0, 20);
  const genres = parseMissAvLabelLinks(html, ["类型", "類型"]).slice(0, 40);
  const directors = parseMissAvLabelLinks(html, ["导演", "導演"]).slice(0, 5);
  const series = parseMissAvInlineValue(html, ["系列"]) || undefined;
  const studio = parseMissAvInlineValue(html, ["发行商", "發行商", "片商"]) || undefined;
  const publisher =
    parseMissAvInlineValue(html, ["标籤", "標籤", "标签", "Label"]) || undefined;
  const premiered =
    html.match(/property=["']og:video:release_date["']\s+content=["']([^"']+)["']/i)?.[1] ||
    parseMissAvInlineValue(html, ["发行日期", "發行日期", "上映日期"]).slice(0, 10) ||
    undefined;
  const durRaw =
    html.match(/property=["']og:video:duration["']\s+content=["'](\d+)["']/i)?.[1] || "";
  const runtimeSec = Number(durRaw) || 0;
  const runtime = runtimeSec > 0 ? Math.max(1, Math.round(runtimeSec / 60)) : undefined;
  const plot = parseMissAvPlot(html);

  let cover: string | null = pickOgImage(html) || "";
  if (cover) cover = absUrl(cover, pageUrl) || cover;
  if (cover && isJunkCoverUrl(cover)) cover = null;

  const mosaic = parseMissAvMosaic(html, pageUrl);

  if (!title && !cover && !actors.length && !genres.length && !plot) return null;

  return {
    source: "miss_av",
    fields: {
      title: title || undefined,
      titleZh: titleZh || title || undefined,
      originalTitle: originaltitle || undefined,
      plot: plot || undefined,
      originalPlot: plot || undefined,
      actors,
      genres,
      directors: directors.length ? directors : undefined,
      studio: studio || undefined,
      publisher: publisher || undefined,
      series: series || undefined,
      premiered: premiered || undefined,
      runtime,
      mosaic,
      website: pageUrl,
    },
    coverUrl: cover,
    ms: 0,
  };
}

async function fetchMissAvDetailPage(
  url: string,
  site: Awaited<ReturnType<typeof prepareProviderFetch>>,
  referer: string,
  signal?: AbortSignal,
): Promise<{ html: string; finalUrl: string } | null> {
  const page = await fetchPageForSite(url, site, {
    signal,
    referer,
    timeoutMs: 90000,
    strictTimeout: false,
  });
  const html = page?.html || "";
  if (!html || html.length < 5000) return null;
  return { html, finalUrl: page?.finalUrl || url };
}

async function scrapeMissAvDetail(code: string, signal?: AbortSignal): Promise<ProviderResult> {
  const started = Date.now();
  const std = stdCode(code);
  if (!std) {
    return { source: "miss_av", fields: {}, ms: Date.now() - started, error: "番号为空" };
  }

  const site = await prepareProviderFetch("miss_av", DEFAULT_BASE);
  const base = site.baseUrl.replace(/\/$/, "");
  if (!base) {
    return { source: "miss_av", fields: {}, ms: Date.now() - started, error: "未配置网站地址" };
  }

  const referer = `${base}/cn/`;

  for (const pathCode of missAvPathCodes(std)) {
    const url = `${base}/cn/${encodeURIComponent(pathCode)}`;
    const page = await fetchMissAvDetailPage(url, site, referer, signal);
    if (!page) continue;
    const parsed = parseMissAvDetailHtml(page.html, page.finalUrl, std);
    if (parsed) return { ...parsed, ms: Date.now() - started };
  }

  const searchUrl = `${base}/cn/search/${encodeURIComponent(std)}`;
  const searchPage = await fetchMissAvDetailPage(searchUrl, site, referer, signal);
  if (!searchPage) {
    return { source: "miss_av", fields: {}, ms: Date.now() - started, error: "搜索无响应" };
  }

  const detailPath = pickMissAvDetailHref(searchPage.html, std);
  if (!detailPath) {
    return { source: "miss_av", fields: {}, ms: Date.now() - started, error: "未找到" };
  }

  const detailUrl = absUrl(detailPath, base) || detailPath;
  const detailPage = await fetchMissAvDetailPage(detailUrl, site, searchUrl, signal);
  if (!detailPage) {
    return { source: "miss_av", fields: {}, ms: Date.now() - started, error: "详情页无响应" };
  }

  const parsed = parseMissAvDetailHtml(detailPage.html, detailPage.finalUrl, std);
  if (!parsed) {
    return { source: "miss_av", fields: {}, ms: Date.now() - started, error: "解析失败" };
  }
  return { ...parsed, ms: Date.now() - started };
}

export const missAvProvider: ScrapeProvider = {
  id: "miss_av",
  async scrape(ctx: ScrapeContext): Promise<ProviderResult | null> {
    try {
      return await scrapeMissAvDetail(ctx.code, ctx.signal);
    } catch (err) {
      return {
        source: "miss_av",
        fields: {},
        ms: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
