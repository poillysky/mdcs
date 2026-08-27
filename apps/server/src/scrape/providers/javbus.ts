import * as cheerio from "cheerio";
import { fetchText } from "../network/fetch.js";
import { prepareProviderFetch, siteFetchOpts } from "./providerSite.js";
import { stripTags } from "./htmlUtils.js";
import type { ProviderResult, ScrapeContext, ScrapeProvider, ScrapeMeta } from "../types.js";

const JAVBUS = "https://www.javbus.com";

function uniq(names: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const n of names) {
    const t = n.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function formatImageUrl(src: string | undefined | null, base: string, pageUrl: string): string | null {
  if (!src) return null;
  try {
    return new URL(src, pageUrl || base).toString();
  } catch {
    if (src.startsWith("http")) return src;
    return `${base}${src.startsWith("/") ? "" : "/"}${src}`;
  }
}

function eachInfoParagraph($: cheerio.CheerioAPI, fn: (el: any) => void): void {
  const scoped = $(".container .movie .info p, .movie .info p");
  if (scoped.length) {
    scoped.each((_, el) => fn(el));
  } else {
    $("p").each((_, el) => fn(el));
  }
}

function findTextInfo($: cheerio.CheerioAPI, label: string, suffix = ""): string | undefined {
  let found: string | undefined;
  eachInfoParagraph($, (el) => {
    const text = $(el).text();
    if (text.includes(label)) {
      found = text.replace(label, "").replace(suffix, "").trim();
    }
  });
  return found;
}

function findLinkText($: cheerio.CheerioAPI, label: string): string | undefined {
  let found: string | undefined;
  eachInfoParagraph($, (el) => {
    const text = $(el).text();
    if (text.includes(label)) {
      found = $(el).find("a").first().text().trim() || undefined;
    }
  });
  return found;
}

/** MDCX xpath：//a[contains(@href, "/studio/")]/text() 等 */
function findLinkByHref($: cheerio.CheerioAPI, pathSegment: string): string | undefined {
  const t = $(`a[href*="${pathSegment}"]`).first().text().trim();
  return t || undefined;
}

function findDirectors($: cheerio.CheerioAPI): string[] {
  const names: string[] = [];
  const fromLabel =
    findLinkText($, "導演:") || findLinkText($, "导演:") || findLinkText($, "導演：") || findLinkText($, "导演：");
  if (fromLabel) names.push(fromLabel);
  $('a[href*="/director/"]').each((_, el) => {
    const n = $(el).text().trim();
    if (n && !names.includes(n)) names.push(n);
  });
  return uniq(names);
}

/** 对齐 MDCX getValidRelease */
export function normalizeJavbusPremiered(release: string): string | undefined {
  const normalized = release.replace(/\//g, "-").replace(/\./g, "-").trim();
  if (!normalized) return undefined;
  const m = normalized.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return undefined;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
  const iso = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const check = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(check.getTime())) return undefined;
  return iso;
}

export type JavbusParsedDetail = {
  fields: Partial<ScrapeMeta>;
  coverUrl: string | null;
};

/** 从详情 HTML 解析字段（L1 单测 + scrape 共用） */
export function parseJavbusDetailHtml(
  html: string,
  code: string,
  baseUrl: string,
  pageUrl?: string,
): JavbusParsedDetail | { error: string } {
  if (/Age Verification|年齡驗證|年龄验证/i.test(html) && !/bigImage/i.test(html)) {
    return { error: "需要年龄验证 Cookie（默认 existmag=all; age=verified; dv=1）" };
  }

  if (
    /404|找不到頁面|找不到页面|Page Not Found/i.test(html) &&
    !/bigImage|movie-title|class=["'][^"']*container/i.test(html)
  ) {
    return { error: "未找到影片" };
  }

  const id = code.toUpperCase();
  const url = pageUrl || `${baseUrl}/${encodeURIComponent(id)}`;

  const titleMatch =
    html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i) ||
    html.match(/property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
    html.match(/content=["']([^"']+)["']\s+property=["']og:title["']/i);
  let title = titleMatch?.[1] ? stripTags(titleMatch[1]) : "";
  if (title) {
    title = title.replace(new RegExp(`^${id}\\s*`, "i"), "").trim() || title;
  }
  if (!title) {
    return { error: "未找到标题" };
  }

  const actresses: string[] = [];
  const starRe =
    /<div[^>]*class=["'][^"']*star-name[^"']*["'][^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = starRe.exec(html)) !== null) {
    actresses.push(stripTags(m[1]));
  }
  if (!actresses.length) {
    const altRe = /\/star\/[^"']+["'][^>]*>([^<]+)</gi;
    while ((m = altRe.exec(html)) !== null) {
      actresses.push(stripTags(m[1]));
    }
  }

  let coverUrl: string | null = null;
  const big =
    html.match(/class=["']bigImage["'][^>]*href=["']([^"']+)["']/i) ||
    html.match(/href=["']([^"']+)["'][^>]*class=["']bigImage["']/i) ||
    html.match(/<a[^>]*class=["'][^"']*bigImage[^"']*["'][^>]*href=["']([^"']+)["']/i);
  if (big?.[1]) {
    coverUrl = formatImageUrl(big[1], baseUrl, url);
  } else {
    const og = html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (og?.[1]) coverUrl = og[1];
  }

  const $ = cheerio.load(html);
  const premieredRaw = findTextInfo($, "發行日期:") || findTextInfo($, "发行日期:");
  const premiered = premieredRaw ? normalizeJavbusPremiered(premieredRaw) : undefined;
  const runtimeText =
    findTextInfo($, "長度:", "分鐘") || findTextInfo($, "长度:", "分钟");
  const runtime = runtimeText ? Number(runtimeText) || null : null;
  const hasKana = /[\u3040-\u30ff]/.test(title);
  const hasHan = /[\u4e00-\u9fff]/.test(title);
  const isZh = hasHan && !hasKana;

  const actors = uniq(actresses);
  const genres = findGenres(html, $).filter((g) => !actors.includes(g));

  let plot = stripTags(
    html.match(/property=["']og:description["']\s+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/content=["']([^"']+)["']\s+property=["']og:description["']/i)?.[1] ||
      "",
  );
  if (plot.length < 12 || plot === title) plot = "";

  const studio =
    findLinkText($, "製作商:") ||
    findLinkText($, "制作商:") ||
    findLinkByHref($, "/studio/");
  const publisher =
    findLinkText($, "發行商:") ||
    findLinkText($, "发行商:") ||
    findLinkByHref($, "/label/") ||
    studio;
  const series = findLinkText($, "系列:") || findLinkByHref($, "/series/");
  const directors = findDirectors($);

  return {
    fields: {
      title,
      ...(isZh ? { titleZh: title } : {}),
      plot: plot || undefined,
      ...(plot && !isZh ? { originalPlot: plot } : {}),
      premiered,
      studio,
      publisher,
      series,
      directors: directors.length ? directors : undefined,
      actors,
      genres,
      runtime,
    },
    coverUrl,
  };
}

function findGenres(html: string, $: cheerio.CheerioAPI): string[] {
  const genres: string[] = [];
  const re = /<span[^>]*class=["'][^"']*genre[^"']*["'][^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const name = stripTags(m[1]);
    // 跳过导航「有碼類別」等
    if (!name || /類別|类别|Genre/i.test(name)) continue;
    genres.push(name);
  }
  if (genres.length) return uniq(genres);
  $(".movie .info span.genre a, .container .movie .info span.genre a").each((_, a) => {
    const name = $(a).text().trim();
    if (name && !/類別|类别/.test(name)) genres.push(name);
  });
  return uniq(genres);
}

/** 对齐色花 scrapeJavbus：regex 标题/封面/女优 + cheerio 补片商等 */
async function scrapeJavbusDetail(code: string, signal?: AbortSignal): Promise<ProviderResult> {
  const started = Date.now();
  const site = await prepareProviderFetch("javbus", JAVBUS);
  const base = site.baseUrl;
  if (!base) return { source: "javbus", fields: {}, ms: Date.now() - started, error: "未配置网站地址" };

  const id = code.toUpperCase();
  const url = `${base}/${encodeURIComponent(id)}`;
  const html = await fetchText(
    url,
    siteFetchOpts(site, { signal, referer: `${base}/`, timeoutMs: 30000 }),
  );

  const parsed = parseJavbusDetailHtml(html, code, base, url);
  if ("error" in parsed) {
    return { source: "javbus", fields: {}, ms: Date.now() - started, error: parsed.error };
  }

  return {
    source: "javbus",
    fields: parsed.fields,
    coverUrl: parsed.coverUrl,
    ms: Date.now() - started,
  };
}

export const javbusProvider: ScrapeProvider = {
  id: "javbus",
  async scrape(ctx: ScrapeContext): Promise<ProviderResult | null> {
    try {
      return await scrapeJavbusDetail(ctx.code, ctx.signal);
    } catch (err) {
      return {
        source: "javbus",
        fields: {},
        ms: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};

export const stubProvider = (id: string): ScrapeProvider => ({
  id,
  async scrape(): Promise<ProviderResult | null> {
    return {
      source: id,
      fields: {},
      ms: 0,
      error: "源暂未实现",
    };
  },
});
