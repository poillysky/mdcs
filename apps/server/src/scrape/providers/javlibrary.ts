import * as cheerio from "cheerio";
import { looksBlockedHtml } from "../network/flaresolverr.js";
import { getCachedSiteMirror, resolveSiteMirror } from "../network/siteMirror.js";
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

const DEFAULT_BASE = "https://www.javlibrary.com";
const FETCH_TIMEOUT_MS = 35000;

export type JavlibraryLang = "ja" | "cn" | "tw";

export function javlibraryLangPath(lang: JavlibraryLang): string {
  return lang;
}

export function javlibraryCodeToken(code: string): string {
  return stdCode(code).replace(/-/g, "").toUpperCase() + " ";
}

function sameNetloc(a: string, b: string): boolean {
  try {
    const ha = new URL(a).hostname.replace(/^www\./i, "");
    const hb = new URL(b).hostname.replace(/^www\./i, "");
    return ha === hb;
  } catch {
    return false;
  }
}

function isDetailUrl(url: string): boolean {
  return /\/\?v=jav/i.test(url) || /\/jav[a-z0-9]+\.html/i.test(url);
}

/** MDCX get_real_url / JavSP 搜索页匹配详情链 */
export function pickJavlibraryDetailUrl(
  html: string,
  code: string,
  origin: string,
): string | null {
  const $ = cheerio.load(html);
  const token = javlibraryCodeToken(code);
  const base = origin.replace(/\/$/, "");

  const titleLinks = $("#video_title h3 a");
  if (titleLinks.length) {
    let hit = "";
    titleLinks.each((_, el) => {
      const text = stripTags($(el).text());
      if (text.replace(/-/g, "").toUpperCase().includes(token.trim())) {
        const href = $(el).attr("href") || "";
        if (href) hit = href;
      }
    });
    if (hit) return absUrl(hit, base) || hit;
  }

  let fallback = "";
  const std = stdCode(code);
  $("div.video[id] a").each((_, el) => {
    const box = $(el).closest("div.video");
    const idText = stripTags(box.find("div.id").first().text());
    if (idText && codeKey(idText) !== codeKey(std)) return;
    const title = $(el).attr("title") || stripTags($(el).text());
    if (title && !title.replace(/-/g, "").toUpperCase().includes(token.trim())) return;
    if (/ブルーレイディスク/.test(title)) return;
    const href = $(el).attr("href") || "";
    if (href) fallback = absUrl(href, base) || href;
  });
  if (fallback) return fallback;

  $("a[href*='/?v=jav'], a[href*='.html']").each((_, el) => {
    const title = $(el).attr("title") || stripTags($(el).text());
    if (!title.replace(/-/g, "").toUpperCase().includes(token.trim())) return;
    if (/ブルーレイディスク/.test(title)) return;
    const href = $(el).attr("href") || "";
    if (href) fallback = absUrl(href, base) || href;
  });
  return fallback || null;
}

export function isJavlibraryDetailHtml(html: string): boolean {
  if (!html || html.length < 800) return false;
  if (/Just a moment|cf-browser-verification|Attention Required/i.test(html)) return false;
  return /id=["']video_title["']/.test(html) && /video_jacket_img|video_id/.test(html);
}

export function parseJavlibraryDetailHtml(
  html: string,
  detailUrl: string,
  code: string,
): ProviderResult | null {
  if (!isJavlibraryDetailHtml(html)) return null;
  const $ = cheerio.load(html);
  const std = stdCode(code);

  const pageNum = stripTags($("#video_id td.text").first().text());
  if (pageNum && codeKey(pageNum) !== codeKey(std)) return null;

  let title = stripTags($("#video_title h3 a").first().text());
  if (pageNum) title = title.replace(new RegExp(`^${pageNum}\\s*`), "").trim();
  title = cleanTitle(title, std);
  if (isJunkTitle(title)) title = "";

  const actors = $("#video_cast span.star a")
    .map((_, el) => stripTags($(el).text()))
    .get()
    .filter((n) => n && n.length <= 40);
  const uniqActors = [...new Set(actors)];

  const genres = $("#video_genres td.text span a")
    .map((_, el) => stripTags($(el).text()))
    .get()
    .filter(Boolean);
  const uniqGenres = [...new Set(genres)];

  const premiered = stripTags($("#video_date td.text").first().text()) || undefined;
  const studio = stripTags($("#video_maker td.text span a").first().text()) || undefined;
  const publisher = stripTags($("#video_label td.text span a").first().text()) || undefined;
  const runtimeRaw = stripTags($("#video_length span.text").first().text());
  const runtime = runtimeRaw ? Number.parseInt(runtimeRaw, 10) : undefined;
  const ratingRaw = stripTags($("#video_review span.score").first().text()).replace(/[()]/g, "");
  const rating = ratingRaw && !Number.isNaN(Number(ratingRaw)) ? Number(ratingRaw) : undefined;
  const votesRaw = stripTags($('a[href*="userswanted.php"]').first().text());
  const votes = votesRaw && /^\d+$/.test(votesRaw) ? Number(votesRaw) : undefined;
  const director = stripTags($("#video_director td.text span a").first().text()) || undefined;

  let cover: string | null = $("#video_jacket_img").attr("src") || "";
  if (cover.startsWith("//")) cover = `https:${cover}`;
  cover = absUrl(cover, detailUrl) || cover;
  if (cover && isJunkCoverUrl(cover)) cover = null;

  if (!title && !cover && !uniqActors.length) return null;

  const ratingFields =
    rating != null && Number.isFinite(rating)
      ? {
          ratingValue: rating,
          ratingMax: 5,
          ratingSource: "javlibrary",
          score: rating * 2,
          votes: votes != null ? String(votes) : undefined,
        }
      : {};

  return {
    source: "javlibrary",
    fields: {
      title: title || undefined,
      actors: uniqActors,
      genres: uniqGenres,
      premiered,
      studio,
      publisher,
      runtime: runtime && Number.isFinite(runtime) ? runtime : undefined,
      directors: director ? [director] : undefined,
      mosaic: "有码",
      ...ratingFields,
    },
    coverUrl: cover,
    ms: 0,
  };
}

function mirrorHostNeedsFlare(baseUrl: string): boolean {
  return /f101w|c97k|b47w/i.test(baseUrl);
}

async function fetchJavlibraryPage(
  url: string,
  site: Awaited<ReturnType<typeof prepareProviderFetch>>,
  extra: { signal?: AbortSignal; referer?: string },
) {
  const flareFirst = mirrorHostNeedsFlare(site.baseUrl);
  const page = await fetchPageForSite(url, site, {
    signal: extra.signal,
    referer: extra.referer,
    timeoutMs: FETCH_TIMEOUT_MS,
    viaFlare: flareFirst ? true : undefined,
    sourceId: flareFirst ? undefined : site.id,
  });
  if (!page?.html || looksBlockedHtml(page.html)) {
    throw new Error("仍是挑战页 / 无响应");
  }
  return page;
}

/** JavSP：CN 搜索一次；单结果 301 直达详情，否则再抓详情页 */
async function fetchJavlibraryCnDetail(
  site: Awaited<ReturnType<typeof prepareProviderFetch>>,
  code: string,
  signal?: AbortSignal,
): Promise<{ html: string; detailUrl: string; searchUrl: string } | null> {
  const base = site.baseUrl.replace(/\/$/, "").replace(/\/(ja|cn|tw)$/i, "");
  const langPath = "cn";
  const searchUrl = `${base}/${langPath}/vl_searchbyid.php?keyword=${encodeURIComponent(stdCode(code))}`;
  const searchPage = await fetchJavlibraryPage(searchUrl, site, {
    signal,
    referer: `${base}/${langPath}/`,
  });
  const finalUrl = searchPage.finalUrl || searchUrl;

  let detailUrl: string | null = null;
  let detailHtml = "";

  if (
    finalUrl !== searchUrl &&
    isDetailUrl(finalUrl) &&
    sameNetloc(finalUrl, searchUrl)
  ) {
    detailUrl = finalUrl;
    detailHtml = searchPage.html;
  } else if (isJavlibraryDetailHtml(searchPage.html)) {
    detailUrl = finalUrl;
    detailHtml = searchPage.html;
  } else {
    detailUrl = pickJavlibraryDetailUrl(searchPage.html, code, `${base}/${langPath}`);
    if (detailUrl) {
      const detailPage = await fetchJavlibraryPage(detailUrl, site, {
        signal,
        referer: searchUrl,
      });
      detailHtml = detailPage.html;
      detailUrl = detailPage.finalUrl || detailUrl;
    }
  }

  if (!detailUrl || !isJavlibraryDetailHtml(detailHtml)) return null;
  return { html: detailHtml, detailUrl, searchUrl };
}

async function resolveJavlibraryBase(
  site: Awaited<ReturnType<typeof prepareProviderFetch>>,
): Promise<string> {
  const cached = getCachedSiteMirror("javlibrary");
  if (cached) return cached.replace(/\/$/, "");
  try {
    const hit = await resolveSiteMirror("javlibrary", {
      preferred: site.baseUrl || DEFAULT_BASE,
      skipDiscover: true,
    });
    if (hit) return hit.replace(/\/$/, "");
  } catch {
    /* ignore */
  }
  return (site.baseUrl || DEFAULT_BASE).replace(/\/$/, "");
}

async function scrapeJavlibraryDetail(code: string, signal?: AbortSignal): Promise<ProviderResult> {
  const started = Date.now();
  const site = await prepareProviderFetch("javlibrary", DEFAULT_BASE);
  site.baseUrl = await resolveJavlibraryBase(site);
  if (!site.baseUrl) {
    return { source: "javlibrary", fields: {}, ms: Date.now() - started, error: "未配置网站地址" };
  }

  const cn = await fetchJavlibraryCnDetail(site, code, signal);
  if (!cn) {
    return { source: "javlibrary", fields: {}, ms: Date.now() - started, error: "未找到" };
  }

  const parsed = parseJavlibraryDetailHtml(cn.html, cn.detailUrl, code);
  if (!parsed) {
    return { source: "javlibrary", fields: {}, ms: Date.now() - started, error: "解析失败" };
  }

  const title = parsed.fields.title || "";
  return {
    ...parsed,
    fields: {
      ...parsed.fields,
      title,
      titleZh: title || undefined,
      website: cn.detailUrl.replace(site.baseUrl, DEFAULT_BASE),
    },
    ms: Date.now() - started,
  };
}

export const javlibraryProvider: ScrapeProvider = {
  id: "javlibrary",
  async scrape(ctx: ScrapeContext): Promise<ProviderResult | null> {
    try {
      return await scrapeJavlibraryDetail(ctx.code, ctx.signal);
    } catch (err) {
      return {
        source: "javlibrary",
        fields: {},
        ms: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
