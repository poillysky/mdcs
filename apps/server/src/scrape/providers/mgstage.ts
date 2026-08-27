import * as cheerio from "cheerio";
import { fetchJson } from "../network/fetch.js";
import { looksBlockedHtml } from "../network/flaresolverr.js";
import {
  absUrl,
  cleanTitle,
  isJunkCoverUrl,
  pageMentionsCode,
  stdCode,
  stripTags,
} from "./htmlUtils.js";
import { fetchPageForSite, prepareProviderFetch, siteFetchOpts } from "./providerSite.js";
import type { ProviderResult, ScrapeContext, ScrapeProvider } from "../types.js";

const DEFAULT_BASE = "https://www.mgstage.com";

/** th 标签文本归一（去掉冒号/空白） */
export function normalizeMgstageLabel(raw: string): string {
  return stripTags(raw).replace(/[：:\s]/g, "");
}

/** 从 detail_data 表格按 th 标签取 td 文本 */
export function mgstageTableValue(html: string, label: string): string {
  const $ = cheerio.load(html);
  let out = "";
  $(".detail_data th").each((_, el) => {
    const th = normalizeMgstageLabel($(el).text());
    if (!th.includes(label)) return;
    const td = $(el).next("td");
    const links = td
      .find("a")
      .map((__, a) => stripTags($(a).text()).trim())
      .get()
      .filter(Boolean);
    out = links.length ? links.join(", ") : stripTags(td.text());
  });
  return out.replace(/\s+/g, " ").trim();
}

export function parseMgstageDate(raw?: string): string | undefined {
  const t = String(raw || "").trim();
  const m = t.match(/(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/);
  if (!m) return undefined;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

export function parseMgstageRuntime(raw?: string): number | undefined {
  const n = Number(String(raw || "").replace(/\D/g, ""));
  return n > 0 && n < 600 ? n : undefined;
}

export function parseMgstageActors(html: string): string[] {
  const raw = mgstageTableValue(html, "出演");
  if (!raw) return [];
  return raw
    .split(/[,、/]/)
    .map((s) => s.trim())
    .filter((s) => s && s.length <= 40);
}

export function parseMgstageGenres(html: string): string[] {
  const $ = cheerio.load(html);
  const out: string[] = [];
  $(".detail_data th").each((_, el) => {
    if (!normalizeMgstageLabel($(el).text()).includes("ジャンル")) return;
    $(el)
      .next("td")
      .find("a")
      .each((__, a) => {
        const g = stripTags($(a).text()).trim();
        if (g && !out.includes(g)) out.push(g);
      });
  });
  return out.slice(0, 40);
}

/** 对齐 MDCX getScore；优先读 td.review 文本，回退 star_* class */
export function parseMgstageRating(html: string): {
  ratingValue: number;
  ratingMax: number;
  score: number;
  votes?: string;
} | null {
  const $ = cheerio.load(html);
  const review = $(".detail_data td.review").first();
  const text = stripTags(review.text());
  const m = text.match(/([\d.]+)\s*\(\s*(\d+)\s*件\s*\)/);
  if (m) {
    const ratingValue = Number(m[1]);
    if (Number.isFinite(ratingValue) && ratingValue > 0) {
      return {
        ratingValue,
        ratingMax: 5,
        score: ratingValue * 2,
        votes: m[2],
      };
    }
  }
  const cls = review.find('span[class*="star_"]').attr("class") || "";
  const star = cls.match(/star_(\d{2})/);
  if (star) {
    const ratingValue = Number(star[1]) / 10;
    if (Number.isFinite(ratingValue) && ratingValue > 0) {
      return { ratingValue, ratingMax: 5, score: ratingValue * 2 };
    }
  }
  return null;
}

export function parseMgstageOutline(html: string): string {
  const $ = cheerio.load(html);
  const p = $("#introduction dd p.txt.introduction").first();
  if (p.length) return stripTags(p.text()).trim();
  const dd = $("#introduction dd").first();
  return stripTags(dd.text()).replace(/…すべてを見る/g, "").trim();
}

export function parseMgstageCover(html: string): string | null {
  const $ = cheerio.load(html);
  const href =
    $("#EnlargeImage").attr("href") ||
    $('a.link_magnify[href*="image.mgstage.com"]').first().attr("href") ||
    "";
  const u = href.startsWith("http") ? href : null;
  if (!u || isJunkCoverUrl(u)) return null;
  return u.replace(/^http:\/\//i, "https://");
}

export function parseMgstageExtrafanart(html: string): string[] {
  const $ = cheerio.load(html);
  const urls: string[] = [];
  $("#sample-photo a.sample_image").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (href.startsWith("http") && !urls.includes(href)) urls.push(href);
  });
  return urls.slice(0, 20);
}

export function pickMgstageDetailHref(html: string, code: string): string {
  const std = stdCode(code).toUpperCase();
  const re = new RegExp(`/product/product_detail/${std.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}/?`, "i");
  const m = html.match(re);
  if (m) return m[0].startsWith("/") ? m[0] : `/${m[0]}`;
  const generic = html.match(/href=["'](\/product\/product_detail\/[^"'/]+\/)[^"']*["']/i);
  return generic?.[1] || "";
}

export function parseMgstageDetailHtml(html: string, pageUrl: string, code: string): ProviderResult | null {
  if (!html || looksBlockedHtml(html)) return null;
  if (!pageMentionsCode(html, code) && !/detail_data|product_detail/i.test(html)) return null;

  const std = stdCode(code);
  const num = mgstageTableValue(html, "品番") || std;
  if (num && stdCode(num).toUpperCase() !== std.toUpperCase() && !pageUrl.toUpperCase().includes(std)) {
    return null;
  }

  const $ = cheerio.load(html);
  const rawTitle = stripTags($("h1.tag").first().text() || $("h1").first().text());
  const title = cleanTitle(rawTitle, std);
  const plot = parseMgstageOutline(html);
  const actors = parseMgstageActors(html);
  const genres = parseMgstageGenres(html);
  const studio = mgstageTableValue(html, "メーカー") || undefined;
  const publisher = mgstageTableValue(html, "レーベル") || undefined;
  const series = mgstageTableValue(html, "シリーズ") || undefined;
  const premiered =
    parseMgstageDate(mgstageTableValue(html, "配信開始日")) ||
    parseMgstageDate(mgstageTableValue(html, "商品発売日")) ||
    undefined;
  const runtime = parseMgstageRuntime(mgstageTableValue(html, "収録時間"));
  const rating = parseMgstageRating(html);
  let coverUrl = parseMgstageCover(html);
  const extrafanartUrls = parseMgstageExtrafanart(html);

  if (!title && !coverUrl && !actors.length && !plot) return null;

  return {
    source: "mgstage",
    fields: {
      title: title || undefined,
      plot: plot || undefined,
      originalPlot: plot || undefined,
      actors,
      genres,
      studio,
      publisher,
      series,
      premiered,
      runtime,
      score: rating?.score,
      ratingValue: rating?.ratingValue,
      ratingMax: rating?.ratingMax,
      ratingSource: rating ? "mgstage" : undefined,
      votes: rating?.votes,
      website: pageUrl,
      mosaic: "有码",
    },
    coverUrl,
    extrafanartUrls: extrafanartUrls.length ? extrafanartUrls : undefined,
    ms: 0,
  };
}

export function extractMgstageSamplePid(html: string): string | null {
  const m =
    html.match(/sampleplayer\.html\/([0-9a-f-]{36})/i) ||
    html.match(/review\.php\?pid=([0-9a-f-]{36})/i) ||
    html.match(/sampleplayer\/sampleRespons\.php\?pid=([0-9a-f-]{36})/i);
  return m?.[1] || null;
}

export async function fetchMgstageTrailer(
  html: string,
  base: string,
  site: Awaited<ReturnType<typeof prepareProviderFetch>>,
  referer: string,
  signal?: AbortSignal,
): Promise<string | undefined> {
  const pid = extractMgstageSamplePid(html);
  if (!pid) return undefined;
  const apiUrl = `${base.replace(/\/$/, "")}/sampleplayer/sampleRespons.php?pid=${encodeURIComponent(pid)}`;
  const data = await fetchJson<{ url?: string }>(
    apiUrl,
    siteFetchOpts(site, { signal, referer, timeoutMs: 15000, viaFlare: false }),
  );
  const raw = String(data?.url || "");
  const m = raw.match(/(https.+?)ism\/request/i) || raw.match(/(https.+\.mp4)/i);
  if (m?.[1]) return `${m[1]}mp4`;
  if (raw.startsWith("http") && raw.includes(".mp4")) return raw;
  return undefined;
}

async function fetchMgstageHtml(
  url: string,
  site: Awaited<ReturnType<typeof prepareProviderFetch>>,
  referer: string,
  signal?: AbortSignal,
): Promise<{ html: string; finalUrl: string } | null> {
  const page = await fetchPageForSite(
    url,
    site,
    {
      signal,
      referer,
      timeoutMs: 25000,
      viaFlare: false,
      strictTimeout: true,
    },
  );
  const html = page?.html || "";
  if (!html || html.length < 800) return null;
  return { html, finalUrl: page?.finalUrl || url };
}

async function scrapeMgstageDetail(code: string, signal?: AbortSignal): Promise<ProviderResult> {
  const started = Date.now();
  const site = await prepareProviderFetch("mgstage", DEFAULT_BASE);
  const base = site.baseUrl.replace(/\/$/, "");
  if (!base) return { source: "mgstage", fields: {}, ms: Date.now() - started, error: "未配置网站地址" };

  const std = stdCode(code).toUpperCase();
  const referer = `${base}/`;

  for (const path of [`/product/product_detail/${encodeURIComponent(std)}/`]) {
    const url = `${base}${path}`;
    const page = await fetchMgstageHtml(url, site, referer, signal);
    if (!page) continue;
    const parsed = parseMgstageDetailHtml(page.html, page.finalUrl, std);
    if (parsed?.fields.title || parsed?.coverUrl) {
      const trailerUrl = await fetchMgstageTrailer(page.html, base, site, page.finalUrl, signal);
      return {
        ...parsed,
        fields: { ...parsed.fields, trailerUrl },
        ms: Date.now() - started,
      };
    }
  }

  const searchUrl = `${base}/search/cSearch.php?search_word=${encodeURIComponent(std)}&type=top`;
  const searchPage = await fetchMgstageHtml(searchUrl, site, referer, signal);
  if (!searchPage) {
    return { source: "mgstage", fields: {}, ms: Date.now() - started, error: "搜索无响应" };
  }
  if (/該当する作品がありません/i.test(searchPage.html)) {
    return { source: "mgstage", fields: {}, ms: Date.now() - started, error: "未找到" };
  }

  const detailPath = pickMgstageDetailHref(searchPage.html, std);
  if (detailPath) {
    const detailUrl = absUrl(detailPath, base) || `${base}${detailPath}`;
    const detailPage = await fetchMgstageHtml(detailUrl, site, searchUrl, signal);
    if (detailPage) {
      const parsed = parseMgstageDetailHtml(detailPage.html, detailPage.finalUrl, std);
      if (parsed) {
        const trailerUrl = await fetchMgstageTrailer(detailPage.html, base, site, detailPage.finalUrl, signal);
        return {
          ...parsed,
          fields: { ...parsed.fields, trailerUrl },
          ms: Date.now() - started,
        };
      }
    }
  }

  return { source: "mgstage", fields: {}, ms: Date.now() - started, error: "未找到" };
}

export const mgstageProvider: ScrapeProvider = {
  id: "mgstage",
  async scrape(ctx: ScrapeContext): Promise<ProviderResult | null> {
    try {
      return await scrapeMgstageDetail(ctx.code, ctx.signal);
    } catch (err) {
      return {
        source: "mgstage",
        fields: {},
        ms: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
