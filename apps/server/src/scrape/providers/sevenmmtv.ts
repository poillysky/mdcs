import * as cheerio from "cheerio";
import { fetchPostForm } from "../network/fetch.js";
import { looksBlockedHtml } from "../network/flaresolverr.js";
import {
  absUrl,
  cleanTitle,
  isJunkCoverUrl,
  isJunkTitle,
  pageMentionsCode,
  pickOgImage,
  pickOgTitle,
  stripTags,
} from "./htmlUtils.js";
import { fetchPageForSite, prepareProviderFetch, resolveProviderSite, siteFetchOpts } from "./providerSite.js";
import type { ProviderResult, ScrapeContext, ScrapeProvider } from "../types.js";

const DEFAULT_BASE = "https://7mmtv.sx/zh";

/** 色花 pickDetailHref：有码优先，reducing-mosaic 垫底 */
export function pickSevenmmtvDetailHref(html: string, code: string): string {
  const hrefs = [
    ...html.matchAll(
      /href=["']([^"']*\/(?:censored|chinese|amateurjav|uncensored|reducing-mosaic|amateur)_content\/\d+\/[^"']+)["']/gi,
    ),
  ].map((m) => m[1]!);
  const codeRe = code.replace(/-/g, "[-]?");
  const scored = [...new Set(hrefs)].map((h) => {
    let score = 0;
    if (/censored_content/i.test(h) && !/reducing/i.test(h)) score += 50;
    if (/chinese_content/i.test(h)) score += 40;
    if (/amateurjav_content/i.test(h)) score += 30;
    if (/uncensored_content/i.test(h)) score += 20;
    if (/reducing-mosaic/i.test(h)) score += 5;
    if (new RegExp(codeRe, "i").test(h)) score += 20;
    return { h, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.h || "";
}

/** MDCX get_title — 多行 h1 压成单行并去番号前缀 */
export function normalizeSevenmmtvTitle(raw: string, webNumber: string): string {
  let title = String(raw || "").replace(/\s+/g, " ").trim();
  if (webNumber) {
    title = title.replace(new RegExp(`^${webNumber.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\s*`, "i"), "").trim();
  }
  return title.replace(/\s*[-|｜]\s*7mmtv.*$/i, "").trim();
}

/** MDCX get_outline */
export function parseSevenmmtvOutline(html: string): string {
  const $ = cheerio.load(html);
  const block = $(".video-introduction-images-text");
  if (!block.length) return "";
  const raw = block.html() || "";
  const withBreaks = raw.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n");
  const parts = withBreaks
    .replace(/<[^>]+>/g, "")
    .split(/\n+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return parts.join("\n");
}

function detectSevenmmtvMosaic(html: string, code: string): string {
  const crumb = stripTags(html.match(/<ol[^>]*class=["'][^"']*breadcrumb[^"']*["'][\s\S]*?<\/ol>/i)?.[0] || "");
  if (/無碼AV|国产影片|國產影片/i.test(crumb)) return "无码";
  if (/有碼AV|有码AV|素人AV/i.test(crumb)) return "有码";
  return /^FC2/i.test(code) ? "无码" : "有码";
}

/** 色花 parse + MDCX 字段 */
export function parseSevenmmtvDetail(html: string, pageUrl: string, code: string): ProviderResult | null {
  if (!html || looksBlockedHtml(html)) return null;
  if (!pageMentionsCode(html, code) && !/fullvideo-title/i.test(html)) return null;

  const $ = cheerio.load(html);
  const webNumber =
    stripTags($(".d-flex.mb-4 span").first().text()) ||
    stripTags(html.match(/<span[^>]*class=["'][^"']*text-muted[^"']*["'][^>]*>([^<]+)<\/span>/i)?.[1] || "") ||
    code;

  let title = normalizeSevenmmtvTitle(
    cleanTitle($("h1.fullvideo-title, h1").first().text() || pickOgTitle(html) || "", code),
    webNumber,
  );
  if (!title || isJunkTitle(title) || /Watch JAV Online|^搜索/i.test(title)) return null;

  const actors = $(".fullvideo-idol a, a[href*='_avperformer/']")
    .map((_, el) => stripTags($(el).text()).replace(/（.+）/g, "").split(/\s+/)[0] || "")
    .get()
    .filter((n) => n && n.length <= 40 && !/女優|女优|演員|演员/i.test(n));
  const uniqActors = [...new Set(actors)].slice(0, 20);

  const genres = $(".categories a, a[href*='_category/']")
    .map((_, el) => stripTags($(el).text()))
    .get()
    .filter((g) => g && g.length <= 20 && !/高畫質|高清|DMM獨家|切卡|VR|4K/i.test(g))
    .slice(0, 40);
  const uniqGenres = [...new Set(genres)];

  const attrValue = (label: RegExp): string => {
    let out = "";
    $(".fullvideo-attr .row, .fullvideo-attr").each((_, el) => {
      const lab = stripTags($(el).find("strong").first().text());
      if (!label.test(lab)) return;
      const $col = $(el).children().eq(1);
      out =
        stripTags($col.find("a").first().text()) ||
        stripTags($col.text()) ||
        stripTags($(el).find("a").first().text()) ||
        out;
    });
    return out;
  };

  const publisher = attrValue(/發行商|发行商|Issuer/i);
  const studio = attrValue(/製作商|制作商|Maker|メーカー/i);
  const directors = [attrValue(/導演|导演|Director/i)].filter((d) => d && !/^N\/A$|^----$/i.test(d));

  let premiered = "";
  let runtime: number | null = null;
  $(".fullvideo-details .text-muted, .d-flex .text-muted").each((_, el) => {
    const t = stripTags($(el).text());
    const dm = t.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (dm) premiered = `${dm[1]}-${dm[2]}-${dm[3]}`;
    const rm = t.match(/(\d+)\s*分/) || t.match(/(\d+)\s*min/i);
    if (rm) runtime = Number(rm[1]) || null;
  });

  let cover =
    $(".content_main_cover img").attr("src") ||
    $(".mvspan_2_s_k_i_p_cover img").attr("src") ||
    html.match(/class=["']player-cover["'][^>]*><a><img src=["']([^"']+)["']/i)?.[1] ||
    pickOgImage(html);
  if (cover) cover = absUrl(cover, pageUrl);
  if (cover && isJunkCoverUrl(cover)) cover = null;

  const extrafanartUrls = [
    ...html.matchAll(/<img[^>]+(?:data-src|src)=["'](https?:\/\/[^"']+\.(?:jpe?g|png|webp))["']/gi),
  ]
    .map((m) => m[1]!)
    .filter((u) => /pics\.dmm|digital\/video|7mmtv/i.test(u))
    .filter((u, i, arr) => arr.indexOf(u) === i)
    .slice(0, 20);

  const plot = parseSevenmmtvOutline(html);

  if (!title && !cover && !uniqActors.length && !plot) return null;

  return {
    source: "sevenmmtv",
    fields: {
      title,
      titleZh: title,
      originalTitle: title,
      plot: plot || undefined,
      actors: uniqActors,
      genres: uniqGenres,
      directors,
      studio: studio || undefined,
      publisher: publisher || undefined,
      premiered: premiered || undefined,
      runtime: runtime && runtime > 0 ? runtime : undefined,
      mosaic: detectSevenmmtvMosaic(html, code),
      website: pageUrl,
    },
    coverUrl: cover,
    extrafanartUrls: extrafanartUrls.length ? extrafanartUrls : undefined,
    ms: 0,
  };
}

async function searchSevenmmtvDetailPath(
  root: string,
  code: string,
  site: ReturnType<typeof resolveProviderSite>,
): Promise<string> {
  const pageOpts = siteFetchOpts(site, {
    timeoutMs: 20000,
    viaFlare: false,
    strictTimeout: true,
  });

  for (const searchUrl of [
    `${root}/zh/searchall_search/all/${encodeURIComponent(code)}/1.html`,
    `${root}/zh/searchform_search/all/${encodeURIComponent(code)}/1.html`,
  ]) {
    const page = await fetchPageForSite(searchUrl, site, { ...pageOpts, referer: `${root}/zh/` });
    const html = page?.html || "";
    if (!html || looksBlockedHtml(html)) continue;
    const path = pickSevenmmtvDetailHref(html, code);
    if (path) return path;
  }

  try {
    const body = new URLSearchParams({
      search_keyword: code,
      search_type: "searchall",
      op: "search",
    }).toString();
    const searchHtml = await fetchPostForm(`${root}/zh/searchform_search/all/index.html`, body, {
      ...pageOpts,
      referer: `${root}/zh/`,
    });
    if (searchHtml && !looksBlockedHtml(searchHtml)) {
      return pickSevenmmtvDetailHref(searchHtml, code);
    }
  } catch {
    /* POST 失败则放弃 */
  }
  return "";
}

async function scrapeSevenmmtvDetail(code: string, signal?: AbortSignal): Promise<ProviderResult> {
  const started = Date.now();
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) {
    return { source: "sevenmmtv", fields: {}, ms: Date.now() - started, error: "番号为空" };
  }

  const site = await prepareProviderFetch("sevenmmtv", DEFAULT_BASE);
  const root = site.baseUrl.replace(/\/zh$/i, "").replace(/\/$/, "");
  if (!root) {
    return { source: "sevenmmtv", fields: {}, ms: Date.now() - started, error: "未配置网站地址" };
  }

  const detailPath = await searchSevenmmtvDetailPath(root, normalized, site);
  if (!detailPath) {
    return { source: "sevenmmtv", fields: {}, ms: Date.now() - started, error: "搜索无结果" };
  }

  const detailUrl = absUrl(detailPath, root);
  if (!detailUrl) {
    return { source: "sevenmmtv", fields: {}, ms: Date.now() - started, error: "详情链接无效" };
  }

  const detailPage = await fetchPageForSite(
    detailUrl,
    site,
    {
      signal,
      referer: `${root}/zh/`,
      timeoutMs: 25000,
      viaFlare: false,
      strictTimeout: true,
    },
  );
  const html = detailPage?.html || "";
  if (!html) {
    return { source: "sevenmmtv", fields: {}, ms: Date.now() - started, error: "详情页无响应" };
  }

  const parsed = parseSevenmmtvDetail(html, detailPage?.finalUrl || detailUrl, normalized);
  if (!parsed) {
    return { source: "sevenmmtv", fields: {}, ms: Date.now() - started, error: "未找到" };
  }
  return { ...parsed, ms: Date.now() - started };
}

export const sevenmmtvProvider: ScrapeProvider = {
  id: "sevenmmtv",
  async scrape(ctx: ScrapeContext): Promise<ProviderResult | null> {
    try {
      return await scrapeSevenmmtvDetail(ctx.code, ctx.signal);
    } catch (err) {
      return {
        source: "sevenmmtv",
        fields: {},
        ms: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
