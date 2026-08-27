import * as cheerio from "cheerio";
import { looksBlockedHtml } from "../network/flaresolverr.js";
import {
  absUrl,
  cleanTitle,
  codeKey,
  isJunkCoverUrl,
  isJunkTitle,
  stdCode,
  stripTags,
} from "./htmlUtils.js";
import { fetchPageForSite, prepareProviderFetch } from "./providerSite.js";
import type { ProviderResult, ScrapeContext, ScrapeProvider } from "../types.js";

/** 123AV（原 NJAV）· JavSP 基址已迁移 */
const DEFAULT_BASE = "https://123av.com/ja";
const DETAIL_SUFFIX_RE = /-(?:uncensored-leaked|uncensored-leak|english-subtitle|chinese-subtitle)$/i;

export function njavLocaleBase(baseUrl: string): string {
  const raw = String(baseUrl || DEFAULT_BASE).replace(/\/$/, "");
  if (/\/(ja|en|cn|zh|ko)(?:\/|$)/i.test(raw)) return raw;
  return `${raw}/ja`;
}

export function njavSearchUrl(base: string, code: string): string {
  return `${njavLocaleBase(base)}/search?keyword=${encodeURIComponent(stdCode(code))}`;
}

/** JavSP：搜索页挑详情；123AV 用 /ja/v/{slug} */
export function pickNjavDetailHref(html: string, code: string): string {
  const std = stdCode(code).toLowerCase();
  const compact = std.replace(/-/g, "");
  const hrefs = [
    ...html.matchAll(/href=["']([^"']+\/v\/[^"'#?]+)["']/gi),
    ...html.matchAll(/href=["']([^"']+\/videos\/[^"'#?]+)["']/gi),
    ...html.matchAll(
      /class=["'][^"']*(?:box-item|detail)[^"']*["'][^>]*>[\s\S]*?href=["']([^"']+)["']/gi,
    ),
  ].map((m) => m[1]!);

  const scored = [...new Set(hrefs)].map((h) => {
    const path = h.split("?")[0]!.toLowerCase();
    const slug = path.split("/").pop() || "";
    let score = 0;
    if (DETAIL_SUFFIX_RE.test(slug)) score -= 80;
    if (slug === std || slug === compact) score += 100;
    else if (slug.startsWith(std) || slug.startsWith(compact)) score += 40;
    if (/\/search\//i.test(path)) score -= 50;
    if (/uncensored/i.test(slug)) score -= 20;
    return { h, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].h : "";
}

export function isNjavDetailHtml(html: string, code: string): boolean {
  if (!html || html.length < 4000) return false;
  if (looksBlockedHtml(html)) return false;
  if (/123av\.com に移転|moved__title|404 — 123AV/i.test(html.slice(0, 12000))) return false;
  const std = stdCode(code);
  const pageCode =
    stripTags(html.match(/<dt>コード<\/dt>\s*<dd[^>]*>([^<]+)</i)?.[1] || "") ||
    stripTags(html.match(/<dt>代码<\/dt>\s*<dd[^>]*>([^<]+)</i)?.[1] || "") ||
    "";
  if (pageCode && codeKey(pageCode) !== codeKey(std)) return false;
  return (
    /class=["']watch__title["']/.test(html) ||
    /class=["']watch__info-row["']/.test(html) ||
    (/id=["']player["']/.test(html) && /detail-item/.test(html))
  );
}

function parseNjavDuration(raw: string): number | undefined {
  const t = String(raw || "").trim();
  if (!t) return undefined;
  const parts = t.split(":").map((x) => Number(x));
  if (parts.some((n) => Number.isNaN(n))) return undefined;
  let sec = 0;
  if (parts.length === 3) sec = parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  else if (parts.length === 2) sec = parts[0]! * 60 + parts[1]!;
  else sec = parts[0]! * 60;
  return sec > 0 ? Math.max(1, Math.round(sec / 60)) : undefined;
}

function parseNjavInfoRows(html: string): Map<string, string[]> {
  const $ = cheerio.load(html);
  const out = new Map<string, string[]>();
  $("div.watch__info-row").each((_, el) => {
    const key = stripTags($(el).find("dt").first().text());
    const chips = $(el)
      .find("dd a.chip")
      .map((__, a) => stripTags($(a).text()))
      .get()
      .filter(Boolean);
    if (chips.length) {
      out.set(key, chips);
      return;
    }
    const plain = stripTags(
      $(el).find("dd").first().clone().children().remove().end().text(),
    );
    if (plain) out.set(key, [plain]);
  });
  return out;
}

/** 旧 NJAV DOM（JavSP detail-item）回退 */
function parseNjavLegacyRows(html: string): Map<string, string[]> {
  const $ = cheerio.load(html);
  const out = new Map<string, string[]>();
  $("div.detail-item > div").each((_, el) => {
    const spans = $(el).find("span");
    const key = stripTags(spans.first().text()).replace(/[:：\s]/g, "");
    const links = spans
      .eq(1)
      .find("a")
      .map((__, a) => stripTags($(a).text()))
      .get()
      .filter(Boolean);
    const plain = stripTags(spans.eq(1).text());
    if (/女優|女优|Actress/i.test(key)) out.set("出演者", links.length ? links : [plain].filter(Boolean));
    else if (/ジャンル|类型|Genre/i.test(key)) out.set("ジャンル", links);
    else if (/メーカー|片商|Maker/i.test(key)) out.set("メーカー", [plain || links[0] || ""].filter(Boolean));
    else if (/シリーズ|系列|Series/i.test(key)) out.set("シリーズ", [plain || links[0] || ""].filter(Boolean));
    else if (/コード|番号|Code/i.test(key)) out.set("コード", [plain].filter(Boolean));
    else if (/公開日|发行|Release/i.test(key)) out.set("発売日", [plain].filter(Boolean));
    else if (/再生時間|时长|Duration/i.test(key)) out.set("再生時間", [plain].filter(Boolean));
  });
  return out;
}

function firstRow(map: Map<string, string[]>, ...keys: string[]): string {
  for (const k of keys) {
    const v = map.get(k)?.[0]?.trim();
    if (v) return v;
  }
  return "";
}

function rowList(map: Map<string, string[]>, ...keys: string[]): string[] {
  for (const k of keys) {
    const v = map.get(k);
    if (v?.length) return v;
  }
  return [];
}

function parseNjavCover(html: string, pageUrl: string): string | null {
  const decoded = html.replace(/\\u002F/gi, "/").replace(/\\u0026/gi, "&");
  const m =
    decoded.match(/https?:\/\/icdn\.123av\.me\/[^"'\\\s]+cover\.jpg[^"'\\\s]*/i) ||
    decoded.match(/poster=https%3A%2F%2Ficdn\.123av\.me[^"'\\]+cover\.jpg[^"'\\]*/i);
  if (m) {
    let url = m[0];
    if (url.startsWith("poster=")) url = decodeURIComponent(url.slice("poster=".length));
    return absUrl(url, pageUrl) || url;
  }
  const $ = cheerio.load(html);
  const poster = $("#player").attr("data-poster") || "";
  if (poster) return absUrl(poster, pageUrl);
  return null;
}

function parseNjavTitle(html: string, code: string): string {
  const $ = cheerio.load(html);
  const raw =
    stripTags($("h1.watch__title").first().text()) ||
    stripTags($("h1").first().text()) ||
    (html.match(/<title>([^<]+)<\/title>/i)?.[1] || "").replace(/\s*—\s*123AV.*/i, "");
  const std = stdCode(code);
  let title = raw.replace(new RegExp(`^${std.replace(/-/g, "[-]?")}\\s*[—–-]\\s*`, "i"), "").trim();
  title = title.replace(new RegExp(`^${std.replace(/-/g, "[-]?")}\\s*`, "i"), "").trim();
  return cleanTitle(title, std);
}

export function parseNjavMosaic(html: string, pageUrl: string): string {
  const slug = pageUrl.split("?")[0]!.split("/").pop()?.toLowerCase() || "";
  if (/uncensored-leak|uncensored-leaked/i.test(slug)) return "无码";
  if (/fc2|heyzo|1pondo|caribbeancom|10musume|tokyo-hot/i.test(slug)) return "无码";

  const rows = parseNjavInfoRows(html);
  const type = firstRow(rows, "タイプ", "类型", "Type").toLowerCase();
  if (/uncensored|無検閲|无码|無碼/.test(type)) return "无码";
  if (/chinese|国产|國產/.test(type)) return "国产";
  if (/censored|検閲済|有码|有碼/.test(type)) return "有码";
  if (/uncensored/i.test(slug)) return "无码";
  return "有码";
}

export function parseNjavDetailHtml(
  html: string,
  pageUrl: string,
  code: string,
): ProviderResult | null {
  if (!isNjavDetailHtml(html, code)) return null;

  const std = stdCode(code);
  let rows = parseNjavInfoRows(html);
  if (!rows.size) rows = parseNjavLegacyRows(html);

  const title = parseNjavTitle(html, std);
  if (title && isJunkTitle(title)) return null;

  const actors = rowList(rows, "出演者", "女優", "女优", "Actress").slice(0, 20);
  const genres = [
    ...rowList(rows, "ジャンル", "类型", "Genre"),
    ...rowList(rows, "タグ", "标签", "Tag"),
  ]
    .filter((g, i, a) => g && a.indexOf(g) === i)
    .slice(0, 40);
  const studio = firstRow(rows, "メーカー", "片商", "Maker") || undefined;
  const series = firstRow(rows, "シリーズ", "系列", "Series") || undefined;
  const premiered = firstRow(rows, "発売日", "发行日", "Release", "公開日").slice(0, 10) || undefined;
  const runtime = parseNjavDuration(firstRow(rows, "再生時間", "时长", "Duration"));

  const $ = cheerio.load(html);
  let plot = stripTags($("div.description p").first().text());
  if (!plot || plot.length < 12) plot = "";

  let cover = parseNjavCover(html, pageUrl);
  if (cover && isJunkCoverUrl(cover)) cover = null;

  const mosaic = parseNjavMosaic(html, pageUrl);

  if (!title && !cover && !actors.length && !genres.length) return null;

  return {
    source: "njav",
    fields: {
      title: title || undefined,
      titleZh: title || undefined,
      originalTitle: title || undefined,
      plot: plot || undefined,
      actors,
      genres,
      studio,
      series,
      premiered,
      runtime,
      mosaic,
      website: pageUrl,
    },
    coverUrl: cover,
    ms: 0,
  };
}

async function fetchNjavPage(
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
  if (!html || html.length < 2000) return null;
  return { html, finalUrl: page?.finalUrl || url };
}

async function scrapeNjavDetail(code: string, signal?: AbortSignal): Promise<ProviderResult> {
  const started = Date.now();
  const std = stdCode(code);
  if (!std) {
    return { source: "njav", fields: {}, ms: Date.now() - started, error: "番号为空" };
  }

  const site = await prepareProviderFetch("njav", DEFAULT_BASE);
  const base = njavLocaleBase(site.baseUrl);
  if (!base) {
    return { source: "njav", fields: {}, ms: Date.now() - started, error: "未配置网站地址" };
  }

  const referer = `${base}/`;
  const searchUrl = njavSearchUrl(base, std);
  const searchPage = await fetchNjavPage(searchUrl, site, referer, signal);
  if (!searchPage) {
    return { source: "njav", fields: {}, ms: Date.now() - started, error: "搜索无响应" };
  }

  const detailPath = pickNjavDetailHref(searchPage.html, std);
  if (!detailPath) {
    return { source: "njav", fields: {}, ms: Date.now() - started, error: "未找到" };
  }

  const detailUrl = absUrl(detailPath, `${base}/`) || detailPath;
  const detailPage = await fetchNjavPage(detailUrl, site, searchUrl, signal);
  if (!detailPage) {
    return { source: "njav", fields: {}, ms: Date.now() - started, error: "详情页无响应" };
  }

  const parsed = parseNjavDetailHtml(detailPage.html, detailPage.finalUrl, std);
  if (!parsed) {
    return { source: "njav", fields: {}, ms: Date.now() - started, error: "解析失败" };
  }
  return { ...parsed, ms: Date.now() - started };
}

export const njavProvider: ScrapeProvider = {
  id: "njav",
  async scrape(ctx: ScrapeContext): Promise<ProviderResult | null> {
    try {
      return await scrapeNjavDetail(ctx.code, ctx.signal);
    } catch (err) {
      return {
        source: "njav",
        fields: {},
        ms: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
