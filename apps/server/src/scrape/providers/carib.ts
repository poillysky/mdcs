import * as cheerio from "cheerio";
import { looksBlockedHtml } from "../network/flaresolverr.js";
import {
  absUrl,
  cleanTitle,
  collectByRe,
  isJunkCoverUrl,
  isJunkTitle,
  pickOgImage,
  pickOgTitle,
  stripTags,
} from "./htmlUtils.js";
import { fetchPageForSite, prepareProviderFetch, siteFetchOpts } from "./providerSite.js";
import type { ProviderResult, ScrapeContext, ScrapeProvider } from "../types.js";

const DEFAULT_BASE = "https://www.caribbeancom.com";
const STUDIO = "カリビアンコム";
const PLOT_BOILERPLATE =
  /動画詳細ページ|見放題|無修正動画|details?\s*page|sample\s*movie|お楽しみ/i;

/** CARIB-010117-339 → 010117-339 */
export function parseCaribMovieKey(code: string): string | null {
  const raw = String(code || "").trim();
  const m =
    raw.match(/^CARIB[-_]?(\d{6}-\d{3})$/i) ||
    raw.match(/^(\d{6}-\d{3})$/);
  return m ? m[1]! : null;
}

/** 番号 MMDDYY-NNN → 20YY-MM-DD（新版页无配信日字段时的兜底） */
export function parseCaribPremieredFromKey(key: string): string | undefined {
  const m = String(key || "").match(/^(\d{2})(\d{2})(\d{2})-\d{3}$/);
  if (!m) return undefined;
  const [, mm, dd, yy] = m;
  return `20${yy}-${mm!.padStart(2, "0")}-${dd!.padStart(2, "0")}`;
}

/** schema.org duration：T01H01M52S → 分钟 */
export function parseCaribIsoDuration(raw: string): number | undefined {
  const t = String(raw || "").trim();
  const m = t.match(/^T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
  if (!m) return undefined;
  const sec =
    Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
  return sec > 0 ? Math.max(1, Math.round(sec / 60)) : undefined;
}

export function caribDetailUrl(base: string, key: string): string {
  const b = String(base || DEFAULT_BASE).replace(/\/$/, "");
  return `${b}/moviepages/${key}/index.html`;
}

export function caribCoverUrl(base: string, key: string): string {
  return caribDetailUrl(base, key).replace(/\/index\.html$/i, "/images/l_l.jpg");
}

export function parseCaribActors(html: string): string[] {
  const $ = cheerio.load(html);
  const out: string[] = [];
  $("li.movie-spec").each((_, el) => {
    const label = stripTags($(el).find(".spec-title").first().text());
    if (!/出演|女優|スター|Actress/i.test(label)) return;
    $(el)
      .find('[itemprop="name"]')
      .each((__, nameEl) => {
        const n = stripTags($(nameEl).text());
        if (n && n.length >= 2 && n.length <= 40 && !out.includes(n)) out.push(n);
      });
  });
  return out.slice(0, 20);
}

export function parseCaribGenres(html: string): string[] {
  return [
    ...collectByRe(html, /itemprop=["']genre["'][^>]*>([^<]+)</gi),
  ]
    .map((g) => g.trim())
    .filter((g) => g && g.length <= 40)
    .filter((g, i, arr) => arr.indexOf(g) === i)
    .slice(0, 40);
}
function caribSpecMap(html: string): Map<string, string[]> {
  const $ = cheerio.load(html);
  const out = new Map<string, string[]>();
  $("li.movie-spec").each((_, el) => {
    const label = stripTags($(el).find(".spec-title").first().text());
    const links = $(el)
      .find(".spec-content a")
      .map((__, a) => stripTags($(a).text()))
      .get()
      .filter(Boolean);
    if (links.length) {
      out.set(label, links);
      return;
    }
    const plain = stripTags($(el).find(".spec-content").first().text());
    if (plain) out.set(label, [plain]);
  });
  return out;
}

function firstSpec(rows: Map<string, string[]>, ...labels: string[]): string {
  for (const label of labels) {
    for (const [k, vals] of rows) {
      if (k.includes(label) && vals[0]) return vals[0]!;
    }
  }
  return "";
}

export function parseCaribPlot(html: string): string {
  const $ = cheerio.load(html);
  let plot = stripTags($('p[itemprop="description"]').first().text());
  if (!plot || plot.length < 12 || PLOT_BOILERPLATE.test(plot)) {
    plot = stripTags($('meta[name="description"]').attr("content") || "");
  }
  if (!plot || plot.length < 12 || PLOT_BOILERPLATE.test(plot)) return "";
  return plot;
}

export function parseCaribTrailer(html: string): string | undefined {
  const m = html.match(/sample_flash_url\\?"\s*:\s*\\?"((?:https?:\\\/\\\/|https?:\/\/)[^"']+)\\?"/i);
  const raw = m?.[1]?.replace(/\\\//g, "/");
  if (raw && /^https?:\/\//i.test(raw)) return raw;
  const smovie = html.match(
    /(https?:\/\/smovie\.caribbeancom\.com\/sample\/movies\/\d{6}-\d{3}\/[^"'\s]+\.mp4)/i,
  )?.[1];
  return smovie || undefined;
}

/** ユーザー評価 ★★★★★ → 5/5 */
export function parseCaribRating(html: string): {
  ratingValue: number;
  ratingMax: number;
} | undefined {
  const $ = cheerio.load(html);
  const text = stripTags($(".meta-rating, .spec-content.rating").first().text());
  const stars = (text.match(/★/g) || []).length;
  if (stars >= 1 && stars <= 5) return { ratingValue: stars, ratingMax: 5 };
  const frac = text.match(/(\d+(?:\.\d+)?)\s*\/\s*5/);
  if (frac) {
    const val = Number(frac[1]);
    if (Number.isFinite(val) && val > 0 && val <= 5) return { ratingValue: val, ratingMax: 5 };
  }
  return undefined;
}

export function parseCaribExtrafanart(html: string, detailUrl: string): string[] {
  const urls = collectByRe(
    html,
    /fancy-gallery[^>]+href=["']([^"']+\/images\/l\/\d+\.jpg)["']/gi,
  );
  return [...new Set(urls.map((u) => absUrl(u, detailUrl) || u).filter(Boolean))].slice(
    0,
    30,
  );
}

export function isCaribDetailHtml(html: string, key: string): boolean {
  if (!html || html.length < 4000) return false;
  if (looksBlockedHtml(html)) return false;
  if (!/itemprop=["']name["']/.test(html) && !/movie-spec/.test(html)) return false;
  const pageId =
    html.match(/movie_id\\?"\s*:\s*\\?"(\d{6}-\d{3})/i)?.[1] ||
    html.match(/\/moviepages\/(\d{6}-\d{3})\//i)?.[1] ||
    "";
  return !pageId || pageId === key;
}

export function parseCaribDetailHtml(
  html: string,
  detailUrl: string,
  code: string,
): ProviderResult | null {
  const key = parseCaribMovieKey(code);
  if (!key || !isCaribDetailHtml(html, key)) return null;

  const $ = cheerio.load(html);
  let title = cleanTitle(
    stripTags($('h1[itemprop="name"]').first().text()) || pickOgTitle(html),
    code,
  );
  if (isJunkTitle(title)) title = "";

  const actors = parseCaribActors(html);
  const uniqActors = actors;

  const uniqGenres = parseCaribGenres(html);

  const rows = caribSpecMap(html);
  const series =
    firstSpec(rows, "シリーズ", "系列") ||
    collectByRe(html, /gaDetailEvent\('Series Name',\s*'([^']+)'/i)[0] ||
    "";

  const durationRaw =
    $('[itemprop="duration"]').attr("content") ||
    firstSpec(rows, "収録時間", "播放時間", "时长") ||
    "";
  const runtime = parseCaribIsoDuration(durationRaw) ||
    (() => {
      const m = durationRaw.match(/(\d{1,2}):(\d{2}):(\d{2})/);
      if (!m) return undefined;
      return parseCaribIsoDuration(`T${m[1]}H${m[2]}M${m[3]}S`);
    })();

  const plot = parseCaribPlot(html);
  const premiered = parseCaribPremieredFromKey(key);

  let cover: string | null =
    pickOgImage(html) ||
    html.match(/\/moviepages\/[\d-]+\/images\/l_l\.jpg/i)?.[0] ||
    `/moviepages/${key}/images/l_l.jpg`;
  cover = absUrl(cover, detailUrl) || cover;
  if (cover && isJunkCoverUrl(cover)) cover = null;

  const trailerUrl = parseCaribTrailer(html);
  const extrafanartUrls = parseCaribExtrafanart(html, detailUrl);
  const rating = parseCaribRating(html);

  if (!title && !cover && !uniqActors.length && !uniqGenres.length) return null;

  return {
    source: "carib",
    fields: {
      title: title || undefined,
      plot: plot || undefined,
      originalPlot: plot || undefined,
      actors: uniqActors,
      genres: uniqGenres,
      series: series || undefined,
      studio: STUDIO,
      premiered,
      runtime: runtime ?? null,
      trailerUrl,
      website: detailUrl,
      ...(rating
        ? {
            score: (rating.ratingValue / rating.ratingMax) * 10,
            ratingValue: rating.ratingValue,
            ratingMax: rating.ratingMax,
            ratingSource: "carib",
          }
        : {}),
    },
    coverUrl: cover,
    extrafanartUrls: extrafanartUrls.length ? extrafanartUrls : undefined,
    ms: 0,
  };
}

async function scrapeCaribDetail(code: string, signal?: AbortSignal): Promise<ProviderResult> {
  const started = Date.now();
  const key = parseCaribMovieKey(code);
  if (!key) {
    return { source: "carib", fields: {}, ms: Date.now() - started, error: "番号格式无效" };
  }

  const site = await prepareProviderFetch("carib", DEFAULT_BASE);
  const base = site.baseUrl;
  if (!base) {
    return { source: "carib", fields: {}, ms: Date.now() - started, error: "未配置网站地址" };
  }

  const detailUrl = caribDetailUrl(base, key);
  const page = await fetchPageForSite(
    detailUrl,
    site,
    siteFetchOpts(site, { signal, referer: `${base}/`, timeoutMs: 45000 }),
  );
  if (!page?.html) {
    return { source: "carib", fields: {}, ms: Date.now() - started, error: "请求失败" };
  }

  const parsed = parseCaribDetailHtml(page.html, page.finalUrl || detailUrl, code);
  if (!parsed) {
    return { source: "carib", fields: {}, ms: Date.now() - started, error: "未找到" };
  }
  return { ...parsed, ms: Date.now() - started };
}

export const caribProvider: ScrapeProvider = {
  id: "carib",
  async scrape(ctx: ScrapeContext): Promise<ProviderResult | null> {
    try {
      return await scrapeCaribDetail(ctx.code, ctx.signal);
    } catch (err) {
      return {
        source: "carib",
        fields: {},
        ms: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
