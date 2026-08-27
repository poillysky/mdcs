import { fetchText } from "../network/fetch.js";
import {
  absUrl,
  cleanTitle,
  codeKey,
  collectByRe,
  isJunkCoverUrl,
  isJunkTitle,
  pageMentionsCode,
  stdCode,
  stripTags,
} from "./htmlUtils.js";
import { parseCaribMovieKey } from "./carib.js";
import {
  isAioThinShell,
  mirrorNetcdnToDmm,
  parseAvmooExtrafanart,
  pickAvmooMoviePath,
} from "./avmoo.js";
import { prepareProviderFetch, siteFetchOpts } from "./providerSite.js";
import type { ProviderResult, ScrapeContext, ScrapeProvider } from "../types.js";

const DEFAULT_BASE = "https://avsox.click";
/** AIO SPA（与 Avmoo 同族）：搜索/详情均须 Flare 渲染 */
const AIO_WAIT_SEC = 3;

function aioDetailValue(html: string, label: string): string {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const plain = new RegExp(
    `detail-label[^>]*>\\s*${esc}\\s*:</span>\\s*<span[^>]*class=["'][^"']*detail-value[^"']*["'][^>]*>([\\s\\S]*?)</span>`,
    "i",
  );
  const linked = new RegExp(
    `detail-label[^>]*>\\s*${esc}\\s*:</span>\\s*<a[^>]*class=["'][^"']*detail-value[^"']*["'][^>]*>([\\s\\S]*?)</a>`,
    "i",
  );
  return stripTags(html.match(plain)?.[1] || html.match(linked)?.[1] || "");
}

/** 搜索词：CARIB-010117-339 → 优先 010117-339（AIO 无 CARIB 前缀） */
export function avsoxSearchQueries(code: string): string[] {
  const std = stdCode(code);
  const out: string[] = [];
  const carib = parseCaribMovieKey(code);
  if (carib) out.push(carib);
  if (!out.includes(std)) out.push(std);
  const m = std.match(/^([A-Z]{2,12})[-_]?(\d{6}-\d{3})$/i);
  if (m && !out.includes(m[2]!)) out.push(m[2]!);
  const compact = std.replace(/-/g, "");
  if (compact !== std && !out.includes(compact)) out.push(compact);
  return out;
}

function parseAvsoxExtrafanart(html: string, detailUrl: string): string[] {
  const sampleSection =
    html.match(/class=["']samples[^"']*["'][\s\S]*?<\/section>/i)?.[0] || "";
  if (sampleSection) {
    return parseAvmooExtrafanart(sampleSection, detailUrl);
  }
  const movieBlock =
    html.match(/class=["']movie-detail[\s\S]*?<section class=["']actresses/i)?.[0] || "";
  const urls = collectByRe(
    movieBlock,
    /<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp))["']/gi,
  )
    .map((u) => absUrl(u, detailUrl) || u)
    .filter(
      (u) =>
        u &&
        !/logo\.|avatar-square|iframe|recommendation|\/res\/img\//i.test(u) &&
        !/(?:1pondo|10musume|heydouga|pacopacomama|muramura|hitozumagiri|ave\/vodimages)/i.test(u),
    );
  return [...new Set(urls)].slice(0, 30);
}

export function avsoxCodesMatch(pageCode: string, code: string): boolean {
  const pk = codeKey(pageCode);
  if (!pk) return false;
  return avsoxSearchQueries(code).some((q) => codeKey(q) === pk);
}

export function isAvsoxSearchEmpty(html: string): boolean {
  return /没有结果|沒有結果|no results/i.test(html);
}

export function pickAvsoxMoviePath(html: string, code: string, lang = "cn"): string | null {
  for (const q of avsoxSearchQueries(code)) {
    const hit = pickAvmooMoviePath(html, q, lang);
    if (hit) return hit;
  }
  return null;
}

export function parseAvsoxDetailHtml(
  html: string,
  detailUrl: string,
  code: string,
): ProviderResult | null {
  if (isAioThinShell(html)) return null;

  const idSpan = aioDetailValue(html, "识别码") || aioDetailValue(html, "識別碼");
  if (idSpan && !avsoxCodesMatch(idSpan, code)) return null;
  if (
    !idSpan &&
    !avsoxSearchQueries(code).some((q) => pageMentionsCode(html, q))
  ) {
    return null;
  }

  const h1 = html.match(/class=["']movie-detail["'][\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "";
  let title = cleanTitle(h1.replace(new RegExp(`^${stdCode(code).replace(/-/g, "[-]?")}\\s*`, "i"), ""), code);
  for (const q of avsoxSearchQueries(code)) {
    title = title.replace(new RegExp(`^${q.replace(/-/g, "[-]?")}\\s*`, "i"), "").trim();
  }
  if (isJunkTitle(title)) title = "";

  const actressBlock = html.match(/class=["']actresses[\s\S]*?<\/section>/i)?.[0] || "";
  const actors = [
    ...collectByRe(actressBlock, /class=["']actress-name["'][^>]*>([^<]+)</gi),
    ...collectByRe(html, /class=["'][^"']*actress-name[^"']*["'][^>]*>([^<]+)</gi),
  ].filter((n) => n.length >= 1 && n.length <= 40);
  const uniqActors = [...new Set(actors)].slice(0, 20);

  const genreBlock =
    html.match(/detail-label[^>]*>\s*类别\s*:[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/i)?.[0] || html;
  const genres = collectByRe(genreBlock, /class=["']detail-link["'][^>]*>([^<]+)</gi)
    .map((g) => g.trim())
    .filter((g) => g && !/更多|全部/i.test(g));
  const uniqGenres = [...new Set(genres)].slice(0, 40);

  let series = aioDetailValue(html, "系列");
  if (series === "-" || series.length < 2 || isJunkTitle(series)) series = "";

  const studioRaw = aioDetailValue(html, "制作商") || aioDetailValue(html, "製作商") || "";
  const studio = studioRaw && studioRaw !== "-" ? studioRaw : "";
  const publisherRaw = aioDetailValue(html, "发行商") || aioDetailValue(html, "發行商") || "";
  const publisher = publisherRaw && publisherRaw !== "-" ? publisherRaw : undefined;

  const directorRaw = aioDetailValue(html, "导演") || aioDetailValue(html, "導演") || "";
  const directors = directorRaw && directorRaw !== "-" ? [directorRaw] : undefined;

  const premiered = (aioDetailValue(html, "发行时间") || aioDetailValue(html, "發行時間") || "").slice(0, 10);
  const runtime =
    Number((aioDetailValue(html, "长度") || aioDetailValue(html, "長度") || "").match(/(\d+)/)?.[1] || 0) ||
    null;

  let cover =
    html.match(/class=["'][^"']*poster-image[^"']*[\s\S]*?src=["']([^"']+)["']/i)?.[1] ||
    html.match(
      /(https?:\/\/[^"'>\s]+\/(?:digital\/video|storage\/caribbeancom|pics_dig\/digital\/video)\/[^"'>\s]+(?:pl|l_l)\.(?:jpg|jpeg|png|webp))/i,
    )?.[1] ||
    null;
  if (cover) cover = absUrl(cover, detailUrl) || cover;
  if (cover && isJunkCoverUrl(cover)) cover = null;

  const extrafanartUrls = parseAvsoxExtrafanart(html, detailUrl);

  if (!title && !cover && !uniqActors.length && !uniqGenres.length) return null;

  const dmmAlt = cover ? mirrorNetcdnToDmm(cover) : null;

  return {
    source: "avsox",
    fields: {
      title: title || undefined,
      titleZh: title || undefined,
      actors: uniqActors,
      genres: uniqGenres,
      series: series || undefined,
      studio: studio || undefined,
      publisher,
      directors,
      premiered: premiered || undefined,
      runtime: runtime && runtime > 0 ? runtime : null,
      website: detailUrl,
    },
    coverUrl: cover,
    alternateCoverUrls: dmmAlt && dmmAlt !== cover ? [dmmAlt] : undefined,
    extrafanartUrls: extrafanartUrls.length ? extrafanartUrls : undefined,
    ms: 0,
  };
}

async function scrapeAvsoxDetail(code: string, signal?: AbortSignal): Promise<ProviderResult> {
  const started = Date.now();
  const site = await prepareProviderFetch("avsox", DEFAULT_BASE);
  const base = site.baseUrl;
  if (!base) return { source: "avsox", fields: {}, ms: Date.now() - started, error: "未配置网站地址" };
  const lang = "cn";
  const queries = avsoxSearchQueries(code);

  let moviePath: string | null = null;
  let searchUrl = "";
  let searchHtml = "";

  for (const q of queries) {
    searchUrl = `${base}/${lang}/search/${encodeURIComponent(q)}`;
    searchHtml = await fetchText(
      searchUrl,
      siteFetchOpts(site, {
        signal,
        referer: `${base}/${lang}`,
        timeoutMs: 120000,
        waitInSeconds: AIO_WAIT_SEC,
      }),
    );
    if (isAvsoxSearchEmpty(searchHtml)) continue;
    moviePath = pickAvsoxMoviePath(searchHtml, code, lang);
    if (moviePath) break;
  }

  if (!moviePath) {
    return { source: "avsox", fields: {}, ms: Date.now() - started, error: "搜索无结果" };
  }
  const detailUrl = absUrl(moviePath, base);
  if (!detailUrl) {
    return { source: "avsox", fields: {}, ms: Date.now() - started, error: "详情链接无效" };
  }
  const detailHtml = await fetchText(
    detailUrl,
    siteFetchOpts(site, {
      signal,
      referer: searchUrl,
      timeoutMs: 120000,
      waitInSeconds: AIO_WAIT_SEC,
    }),
  );
  if (isAioThinShell(detailHtml)) {
    return { source: "avsox", fields: {}, ms: Date.now() - started, error: "详情页未渲染" };
  }
  const parsed = parseAvsoxDetailHtml(detailHtml, detailUrl, code);
  if (!parsed) {
    return { source: "avsox", fields: {}, ms: Date.now() - started, error: "未找到" };
  }
  return { ...parsed, ms: Date.now() - started };
}

export const avsoxProvider: ScrapeProvider = {
  id: "avsox",
  async scrape(ctx: ScrapeContext): Promise<ProviderResult | null> {
    try {
      return await scrapeAvsoxDetail(ctx.code, ctx.signal);
    } catch (err) {
      return {
        source: "avsox",
        fields: {},
        ms: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
