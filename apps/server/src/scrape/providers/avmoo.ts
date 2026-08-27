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
import { prepareProviderFetch, siteFetchOpts } from "./providerSite.js";
import type { ProviderResult, ScrapeContext, ScrapeProvider } from "../types.js";

const DEFAULT_BASE = "https://avmoo.shop";
/** AIO 详情为 Quasar SPA：须等 FS 渲染，否则 cookie-direct 仅 ~1.5KB 空壳 */
const AIO_DETAIL_WAIT_SEC = 3;

/**
 * jp.netcdn.space 为 Avmoo 原图床；同路径 pics.dmm.co.jp 仅作下载失败时的 alternate。
 */
export function mirrorNetcdnToDmm(url: string): string | null {
  if (!url || !/netcdn\.space/i.test(url)) return null;
  return url.replace(/https?:\/\/[^/]*netcdn\.space/i, "https://pics.dmm.co.jp");
}

/** AIO SPA 未渲染（仅 shell，无 movie-detail） */
export function isAioThinShell(html: string): boolean {
  if (!html) return true;
  if (/class=["']movie-detail["']/.test(html)) return false;
  if (/detail-label/.test(html)) return false;
  if (html.length < 2000) return true;
  return html.length < 4000;
}

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

export function pickAvmooMoviePath(html: string, code: string, lang = "cn"): string | null {
  const std = stdCode(code);
  const codePat = std.replace(/-/g, "[-]?");
  for (const m of html.matchAll(
    new RegExp(
      `href=["']([^"']*/${lang}/movies/[^"'#]+)["'][\\s\\S]{0,1200}?movie-meta[\\s\\S]{0,300}?<span[^>]*>\\s*${codePat}\\s*</span>`,
      "gi",
    ),
  )) {
    const href = String(m[1] || "").trim();
    if (href) return href;
  }
  const codeRe = new RegExp(codePat, "i");
  for (const m of html.matchAll(
    new RegExp(`href=["']([^"']*/${lang}/movies/[^"'#]+)["']([\\s\\S]{0,800})`, "gi"),
  )) {
    const href = String(m[1] || "").trim();
    if (href && codeRe.test(`${href} ${m[2] || ""}`)) return href;
  }
  return null;
}

export function parseAvmooExtrafanart(html: string, detailUrl: string): string[] {
  const sampleSection =
    html.match(/class=["']samples[^"']*["'][\s\S]*?<\/section>/i)?.[0] ||
    html.match(/class=["']sample-grid[^"']*["'][\s\S]*?<\/div>/i)?.[0] ||
    "";
  const urls = collectByRe(sampleSection || html, /<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp))["']/gi);
  const merged = urls
    .map((u) => absUrl(u, detailUrl) || u)
    .filter((u) => u && !/iframe\.html/i.test(u));
  return [...new Set(merged)].slice(0, 30);
}

export function parseAvmooDetailHtml(
  html: string,
  detailUrl: string,
  code: string,
): ProviderResult | null {
  if (isAioThinShell(html)) return null;

  const idSpan =
    aioDetailValue(html, "识别码") ||
    aioDetailValue(html, "識別碼");
  if (idSpan && codeKey(idSpan) !== codeKey(code)) return null;
  if (!pageMentionsCode(html, code) && !idSpan) return null;

  const h1 = html.match(/class=["']movie-detail["'][\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "";
  let title = cleanTitle(h1 || "", code);
  if (isJunkTitle(title)) title = "";

  const actors = [
    ...collectByRe(html, /class=["'][^"']*actress-name[^"']*["'][^>]*>([^<]+)</gi),
    ...collectByRe(html, /href=["'][^"']*\/(?:cn\/)?actresses\/[^"']+["'][^>]*>([^<]+)</gi),
  ].filter((n) => n.length >= 1 && n.length <= 40);
  const uniqActors = [...new Set(actors)].slice(0, 20);

  const genreBlock = html.match(/detail-label[^>]*>\s*类别\s*:[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/i)?.[0] || html;
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
    html.match(/class=["'][^"']*poster-image[^"']*["'][\s\S]*?src=["']([^"']+)["']/i)?.[1] ||
    html.match(
      /(https?:\/\/[^"'>\s]+\/(?:digital\/video|pics_dig\/digital\/video)\/[^"'>\s]+pl\.(?:jpg|jpeg|png|webp))/i,
    )?.[1] ||
    null;
  if (cover) cover = absUrl(cover, detailUrl) || cover;
  if (cover && isJunkCoverUrl(cover)) cover = null;

  const extrafanartUrls = parseAvmooExtrafanart(html, detailUrl);

  if (!title && !cover && !uniqActors.length && !uniqGenres.length) return null;

  const dmmAlt = cover ? mirrorNetcdnToDmm(cover) : null;
  const thumbAlt = cover?.replace(/pl\.(jpe?g|png|webp)$/i, "ps.$1") || undefined;

  return {
    source: "avmoo",
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
    alternateCoverUrls: [
      ...(dmmAlt && dmmAlt !== cover ? [dmmAlt] : []),
      ...(thumbAlt && thumbAlt !== cover ? [thumbAlt] : []),
    ].filter(Boolean),
    extrafanartUrls: extrafanartUrls.length ? extrafanartUrls : undefined,
    ms: 0,
  };
}

async function scrapeAvmooDetail(code: string, signal?: AbortSignal): Promise<ProviderResult> {
  const started = Date.now();
  const std = stdCode(code);
  const site = await prepareProviderFetch("avmoo", DEFAULT_BASE);
  const base = site.baseUrl;
  if (!base) return { source: "avmoo", fields: {}, ms: Date.now() - started, error: "未配置网站地址" };
  const lang = "cn";
  const searchUrl = `${base}/${lang}/search/${encodeURIComponent(std)}`;
  const searchHtml = await fetchText(
    searchUrl,
    siteFetchOpts(site, { signal, referer: `${base}/${lang}`, timeoutMs: 60000 }),
  );
  const moviePath = pickAvmooMoviePath(searchHtml, std, lang);
  if (!moviePath) {
    return { source: "avmoo", fields: {}, ms: Date.now() - started, error: "搜索无结果" };
  }
  const detailUrl = absUrl(moviePath, base);
  if (!detailUrl) {
    return { source: "avmoo", fields: {}, ms: Date.now() - started, error: "详情链接无效" };
  }
  const detailHtml = await fetchText(
    detailUrl,
    siteFetchOpts(site, {
      signal,
      referer: searchUrl,
      timeoutMs: 90000,
      waitInSeconds: AIO_DETAIL_WAIT_SEC,
    }),
  );
  if (isAioThinShell(detailHtml)) {
    return { source: "avmoo", fields: {}, ms: Date.now() - started, error: "详情页未渲染" };
  }
  const parsed = parseAvmooDetailHtml(detailHtml, detailUrl, std);
  if (!parsed) {
    return { source: "avmoo", fields: {}, ms: Date.now() - started, error: "未找到" };
  }
  return { ...parsed, ms: Date.now() - started };
}

export const avmooProvider: ScrapeProvider = {
  id: "avmoo",
  async scrape(ctx: ScrapeContext): Promise<ProviderResult | null> {
    try {
      return await scrapeAvmooDetail(ctx.code, ctx.signal);
    } catch (err) {
      return {
        source: "avmoo",
        fields: {},
        ms: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
