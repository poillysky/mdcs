import { fetchText } from "../network/fetch.js";
import {
  absUrl,
  cleanTitle,
  codeKey,
  collectByRe,
  isJunkCoverUrl,
  isJunkTitle,
  stripTags,
} from "./htmlUtils.js";
import {
  isAioThinShell,
  mirrorNetcdnToDmm,
  parseAvmooExtrafanart,
  pickAvmooMoviePath,
} from "./avmoo.js";
import { prepareProviderFetch, siteFetchOpts } from "./providerSite.js";
import type { ProviderResult, ScrapeContext, ScrapeProvider } from "../types.js";

const DEFAULT_BASE = "https://avheat.shop";
/** AIO SPA（wav 与 Avmoo/AvSox 同族）：搜索/详情均须 Flare 渲染 */
const AIO_WAIT_SEC = 5;

/** 本地 STUDIO.YYYY.MM.DD → 已知 AIO 识别码 Series.YY.MM.DD（覆盖有限） */
const WESTERN_SERIES_BY_STUDIO: Record<string, string> = {
  wlt: "WeLiveTogether",
  welivetogether: "WeLiveTogether",
};

const WESTERN_STUDIO_ALIASES: Record<string, string> = {
  puretaboo: "Pure Taboo",
  rk: "Reality Kings",
};

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

/** 本地命名 STUDIO.YYYY.MM.DD → 站点识别码 Series.YY.MM.DD */
export function avheatSiteIdFromLocalCode(code: string): string | null {
  const m = code.match(/^([A-Za-z][A-Za-z0-9]*)\.(\d{4})\.(\d{2})\.(\d{2})$/);
  if (!m) return null;
  const [, studioKey, y, mo, d] = m;
  const series = WESTERN_SERIES_BY_STUDIO[studioKey.toLowerCase()];
  if (!series) return null;
  return `${series}.${y.slice(-2)}.${mo}.${d}`;
}

function extractIsoDateFromCode(code: string): string | null {
  const local = code.match(/^([A-Za-z][A-Za-z0-9]*)\.(\d{4})\.(\d{2})\.(\d{2})$/);
  if (local) return `${local[2]}-${local[3]}-${local[4]}`;
  const site = code.match(/^([A-Za-z][A-Za-z0-9]*)\.(\d{2})\.(\d{2})\.(\d{2})$/);
  if (!site) return null;
  const yy = Number(site[2]) >= 70 ? `19${site[2]}` : `20${site[2]}`;
  return `${yy}-${site[3]}-${site[4]}`;
}

/** 搜索词：优先站点识别码 Series.YY.MM.DD */
export function avheatSearchQueries(code: string): string[] {
  const raw = String(code || "").trim();
  const out: string[] = [raw];

  const siteId = raw.match(/^([A-Za-z][A-Za-z0-9]*)\.(\d{2})\.(\d{2})\.(\d{2})$/);
  if (siteId) {
    const [, series, yy, mo, d] = siteId;
    const y = Number(yy) >= 70 ? `19${yy}` : `20${yy}`;
    out.push(`${series} ${y}-${mo}-${d}`);
  }

  const fromLocal = avheatSiteIdFromLocalCode(raw);
  if (fromLocal) out.push(fromLocal);

  const dotDate = raw.match(/^([A-Za-z][A-Za-z0-9]*)\.(\d{4})\.(\d{2})\.(\d{2})$/);
  if (dotDate) {
    const [, studioKey, y, mo, d] = dotDate;
    const studio =
      WESTERN_STUDIO_ALIASES[studioKey.toLowerCase()] ||
      studioKey.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
    out.push(`${studio} ${y}-${mo}-${d}`, `${studioKey} ${y}-${mo}-${d}`);
  }

  return [...new Set(out.filter(Boolean))];
}

export function avheatCodesMatch(pageId: string, code: string, premiered?: string): boolean {
  const pk = codeKey(pageId);
  if (!pk) return false;
  if (avheatSearchQueries(code).some((q) => codeKey(q) === pk)) return true;
  const fromLocal = avheatSiteIdFromLocalCode(code);
  if (fromLocal && codeKey(fromLocal) === pk) return true;
  const iso = extractIsoDateFromCode(code);
  if (iso && premiered === iso) {
    const suffix = iso.slice(2).replace(/-/g, ".");
    return pk.includes(codeKey(suffix)) || pk.endsWith(codeKey(suffix.slice(-8)));
  }
  return false;
}

export function isAvheatSearchEmpty(html: string): boolean {
  return /没有结果|沒有結果|no results/i.test(html);
}

export function pickAvheatMoviePath(html: string, code: string, lang = "cn"): string | null {
  for (const q of avheatSearchQueries(code)) {
    const hit = pickAvmooMoviePath(html, q, lang);
    if (hit) return hit;
  }
  const iso = extractIsoDateFromCode(code);
  if (!iso) return null;
  const esc = iso.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const m of html.matchAll(
    new RegExp(
      `href=["']([^"']*/${lang}/movies/[^"'#]+)["'][\\s\\S]{0,1200}?movie-meta[\\s\\S]{0,300}?${esc}`,
      "gi",
    ),
  )) {
    const href = String(m[1] || "").trim();
    if (href) return href;
  }
  return null;
}

function parseAvheatTitle(h1: string, code: string): string {
  const raw = stripTags(h1);
  const scene = raw.split(/\s+-\s+/).pop() || raw;
  let title = cleanTitle(scene, code);
  for (const q of avheatSearchQueries(code)) {
    title = title.replace(new RegExp(`^${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i"), "").trim();
  }
  if (isJunkTitle(title)) return "";
  return title;
}

function parseAvheatExtrafanart(html: string, detailUrl: string): string[] {
  const sampleSection =
    html.match(/class=["']samples[^"']*["'][\s\S]*?<\/section>/i)?.[0] || "";
  if (sampleSection) return parseAvmooExtrafanart(sampleSection, detailUrl);
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
        !/logo\.|avatar-square|iframe|recommendation|\/res\/img\//i.test(u),
    );
  return [...new Set(urls)].slice(0, 30);
}

export function parseAvheatDetailHtml(
  html: string,
  detailUrl: string,
  code: string,
): ProviderResult | null {
  if (isAioThinShell(html)) return null;

  const pageId = aioDetailValue(html, "识别码") || aioDetailValue(html, "識別碼");
  const premiered = (aioDetailValue(html, "发行时间") || aioDetailValue(html, "發行時間") || "").slice(0, 10);
  if (pageId && !avheatCodesMatch(pageId, code, premiered || undefined)) return null;
  if (!pageId && !avheatSearchQueries(code).some((q) => html.includes(q))) return null;

  const h1 = html.match(/class=["']movie-detail["'][\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "";
  const title = parseAvheatTitle(h1, code);

  const actressBlock = html.match(/class=["']actresses[\s\S]*?<\/section>/i)?.[0] || "";
  const actors = [
    ...collectByRe(actressBlock, /class=["']actress-name["'][^>]*>([^<]+)</gi),
    ...collectByRe(html, /class=["'][^"']*actress-name[^"']*["'][^>]*>([^<]+)</gi),
  ].filter((n) => n.length >= 1 && n.length <= 60);
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

  const runtime =
    Number((aioDetailValue(html, "长度") || aioDetailValue(html, "長度") || "").match(/(\d+)/)?.[1] || 0) ||
    null;

  let cover =
    html.match(/class=["'][^"']*poster-image[^"']*[\s\S]*?q-img__image[^>]*src=["']([^"']+)["']/i)?.[1] ||
    html.match(/class=["'][^"']*poster-image[^"']*[\s\S]*?src=["']([^"']+)["']/i)?.[1] ||
    null;
  if (cover) cover = absUrl(cover, detailUrl) || cover;
  if (cover && isJunkCoverUrl(cover)) cover = null;

  const extrafanartUrls = parseAvheatExtrafanart(html, detailUrl);

  if (!title && !cover && !uniqActors.length && !uniqGenres.length) return null;

  const dmmAlt = cover ? mirrorNetcdnToDmm(cover) : null;

  return {
    source: "avheat",
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

async function scrapeAvheatDetail(code: string, signal?: AbortSignal): Promise<ProviderResult> {
  const started = Date.now();
  const site = await prepareProviderFetch("avheat", DEFAULT_BASE);
  const base = site.baseUrl;
  if (!base) return { source: "avheat", fields: {}, ms: Date.now() - started, error: "未配置网站地址" };
  const lang = "cn";
  const queries = avheatSearchQueries(code);

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
    if (isAvheatSearchEmpty(searchHtml)) continue;
    moviePath = pickAvheatMoviePath(searchHtml, code, lang);
    if (moviePath) break;
  }

  if (!moviePath) {
    return { source: "avheat", fields: {}, ms: Date.now() - started, error: "搜索无结果" };
  }
  const detailUrl = absUrl(moviePath, base);
  if (!detailUrl) {
    return { source: "avheat", fields: {}, ms: Date.now() - started, error: "详情链接无效" };
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
    return { source: "avheat", fields: {}, ms: Date.now() - started, error: "详情页未渲染" };
  }
  const parsed = parseAvheatDetailHtml(detailHtml, detailUrl, code);
  if (!parsed) {
    return { source: "avheat", fields: {}, ms: Date.now() - started, error: "未找到" };
  }
  return { ...parsed, ms: Date.now() - started };
}

export const avheatProvider: ScrapeProvider = {
  id: "avheat",
  async scrape(ctx: ScrapeContext): Promise<ProviderResult | null> {
    try {
      return await scrapeAvheatDetail(ctx.code, ctx.signal);
    } catch (err) {
      return {
        source: "avheat",
        fields: {},
        ms: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
