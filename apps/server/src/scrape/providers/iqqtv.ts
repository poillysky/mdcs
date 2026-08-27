import * as cheerio from "cheerio";
import { rememberIqqtvMirrorFromFinalUrl } from "../network/iqqtvMirror.js";
import {
  absUrl,
  isJunkCoverUrl,
  isJunkTitle,
  pageMentionsCode,
  pickOgImage,
  stdCode,
  stripTags,
} from "./htmlUtils.js";
import { fetchPageForSite, prepareProviderFetch } from "./providerSite.js";
import type { ProviderResult, ScrapeContext, ScrapeMeta, ScrapeProvider } from "../types.js";

const DEFAULT_ROOT = "https://iqqk4.quest";

const TITLE_TRAILING_MARKERS = new Set(["HD", "FHD", "UHD", "SD", "VR", "2K", "4K", "720P", "1080P", "2160P"]);
const OUTLINE_PREFIX = /^(?:简介|簡介|介绍|介紹|紹介)\s*[:：]?\s*/;
const JUNK_TITLE_RE = /克破|无码破解|無碼破解|无码流出|無碼流出|马赛克破坏|馬賽克破壞/i;

/** MDCX number.match_number */
export function matchIqqtvNumber(text: string, number: string): boolean {
  const hay = String(text || "");
  const num = String(number || "").trim();
  if (!num) return false;
  if (/^\d/.test(num)) return hay.toUpperCase().includes(num.toUpperCase());
  const esc = num.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  return new RegExp(`(?<![A-Z0-9])${esc}(?![A-Z0-9])`, "i").test(hay);
}

export function junkIqqtvTitle(title: string): boolean {
  return JUNK_TITLE_RE.test(title);
}

/** MDCX get_real_title */
export function getIqqtvRealTitle(title: string): string {
  const parts = title.trim().split(/\s+/);
  if (parts.length > 1 && TITLE_TRAILING_MARKERS.has(parts[parts.length - 1]!.toUpperCase())) {
    parts.pop();
  }
  return parts.join(" ").trim();
}

const WEB_NUMBER_PREFIX =
  /^(?:_?1pondo|1pon|caribbeancom(?:pr)?|carib|pacopacomama|pacoma|paco|10musume|10mu)[_-]*/i;
const WEB_NUMBER_SUFFIX = /^(?=.*\d)[a-z0-9]+(?:[-_][a-z0-9]+)*$/i;

function cleanIqqtvWebNumberToken(value: string): string {
  let result = String(value || "").trim();
  result = result.replace(/-PPV$/i, "");
  result = result.replace(WEB_NUMBER_PREFIX, "");
  return result.trim().replace(/^[_-]+/, "");
}

function sameIqqtvWebNumber(left: string, right: string): boolean {
  const a = cleanIqqtvWebNumberToken(left).replace(/[-_]/g, "").toUpperCase();
  const b = cleanIqqtvWebNumberToken(right).replace(/[-_]/g, "").toUpperCase();
  return Boolean(a && b && a === b);
}

function looksLikeIqqtvWebNumber(value: string): boolean {
  return WEB_NUMBER_SUFFIX.test(cleanIqqtvWebNumberToken(value));
}

/** MDCX remove_web_number_suffix */
export function removeIqqtvWebNumberSuffix(title: string, number: string): string {
  const t = title.trim();
  if (!t) return "";
  const parts = t.split(/\s+/);
  if (parts.length < 2) return t;
  const suffix = parts[parts.length - 1]!;
  if (looksLikeIqqtvWebNumber(suffix) && sameIqqtvWebNumber(suffix, number)) {
    return parts.slice(0, -1).join(" ").trim();
  }
  return t;
}

function cleanIqqtvPageTitle(raw: string, number: string): string {
  let title = getIqqtvRealTitle(removeIqqtvWebNumberSuffix(raw.trim(), number));
  title = title.replace(/\s*iQQTV\s*.*$/i, "").trim();
  if (!title || isJunkTitle(title) || junkIqqtvTitle(title)) return "";
  return title;
}

/** MDCX getOutline */
export function parseIqqtvOutline(html: string): string {
  const $ = cheerio.load(html);
  let result = stripTags($('div[class*="intro"]').find("p").text());
  if (!result) {
    $("p").each((_, el) => {
      if (result) return;
      const t = stripTags($(el).text());
      if (/简介|簡介|介绍|介紹|紹介/.test(t)) result = t;
    });
  }
  result = result.replace(/[\r\n\t]/g, "").replace(OUTLINE_PREFIX, "");
  result = result.split("*根据分发")[0]!.trim();
  if (!result || junkIqqtvTitle(result)) return "";
  return result.length >= 2 ? result : "";
}

/** MDCX get_real_url */
export function getIqqtvRealUrl(html: string, number: string): string {
  const $ = cheerio.load(html);
  const num = number.replace(/FC2/i, "").replace(/-PPV/i, "");
  let found = "";
  $("span.title").each((_, el) => {
    if (found) return;
    const href = $(el).find("a").attr("href") || "";
    const title = $(el).find("a").attr("title") || "";
    if (!href || !title) return;
    if (!matchIqqtvNumber(title, num) || junkIqqtvTitle(title)) return;
    found = href;
  });
  return found;
}

export type IqqtvParsedDetail = {
  fields: Partial<ScrapeMeta>;
  coverUrl: string | null;
};

/** 详情页 HTML 解析（L1 单测 + scrape 共用） */
export function parseIqqtvDetailHtml(html: string, code: string, pageUrl: string): IqqtvParsedDetail {
  const std = stdCode(code);
  const $ = cheerio.load(html);
  const rawTitle = stripTags($("h1.h4.b").first().text());
  const title = cleanIqqtvPageTitle(rawTitle, std);

  const actors: string[] = [];
  $('a[href*="actor"] span').each((_, el) => {
    const n = stripTags($(el).text());
    if (n && n.length < 40 && !actors.includes(n)) actors.push(n);
  });

  const genres: string[] = [];
  $('.tag-info a[href*="tag"], a[href*="s_type=tag"]').each((_, el) => {
    const n = stripTags($(el).text());
    if (!n || n.length > 24 || /更多|全部|类别/i.test(n) || genres.includes(n)) return;
    genres.push(n);
  });

  let studio = stripTags($('a[href*="fac"] [itemprop="name"]').first().text());
  if (studio.length > 60) studio = "";

  let series = stripTags($('a[href*="series"]').first().text());
  if (series.length < 2 || isJunkTitle(series)) series = "";

  const plot = parseIqqtvOutline(html);
  const dateRaw = stripTags($("div.date").first().text()).replace(/\//g, "-");
  const dm = dateRaw.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  const premiered = dm
    ? `${dm[1]}-${dm[2]!.padStart(2, "0")}-${dm[3]!.padStart(2, "0")}`
    : undefined;

  let cover = pickOgImage(html) || absUrl($('img[itemprop="image"]').first().attr("src"), pageUrl);
  if (cover && isJunkCoverUrl(cover)) cover = null;

  return {
    fields: {
      title: title || undefined,
      plot: plot || undefined,
      actors,
      genres,
      studio: studio || undefined,
      series: series || undefined,
      premiered,
      website: pageUrl,
    },
    coverUrl: cover,
  };
}

function langBases(root: string): { jp: string; cn: string } {
  const base = root.replace(/\/$/, "");
  if (/\/cn$/i.test(base)) {
    return { jp: base.replace(/\/cn$/i, "/jp"), cn: base };
  }
  return { jp: `${base}/jp`, cn: `${base}/cn` };
}

async function scrapeIqqtvDetail(code: string, signal?: AbortSignal): Promise<ProviderResult> {
  const started = Date.now();
  const site = await prepareProviderFetch("iqqtv", DEFAULT_ROOT);
  let root = site.baseUrl;
  if (!root) return { source: "iqqtv", fields: {}, ms: Date.now() - started, error: "未配置网站地址" };
  let { jp: jpBase, cn: cnBase } = langBases(root);
  const std = stdCode(code);

  const searchUrl = `${jpBase}/search.php?kw=${encodeURIComponent(std)}`;
  let searchHtml: string;
  try {
    const searchPage = await fetchPageForSite(searchUrl, site, {
      signal,
      referer: `${jpBase}/`,
      timeoutMs: 20000,
    });
    searchHtml = searchPage?.html || "";
    const landed = rememberIqqtvMirrorFromFinalUrl(searchPage?.finalUrl || "", searchUrl);
    if (landed) {
      root = `${landed}/cn`;
      site.baseUrl = root;
      ({ jp: jpBase, cn: cnBase } = langBases(root));
    }
  } catch (err) {
    return {
      source: "iqqtv",
      fields: {},
      ms: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  if (!searchHtml || searchHtml.length < 400) {
    return { source: "iqqtv", fields: {}, ms: Date.now() - started, error: "搜索无响应" };
  }

  const detailPath = getIqqtvRealUrl(searchHtml, std);
  if (!detailPath) {
    return { source: "iqqtv", fields: {}, ms: Date.now() - started, error: "搜索无结果" };
  }

  const rel = detailPath.replace(/^\/(cn|jp)\//i, "");
  const jpUrl = absUrl(`/jp/${rel}`, `${jpBase}/`) || `${jpBase}/${rel}`;
  const cnUrl = absUrl(`/cn/${rel}`, `${cnBase}/`) || `${cnBase}/${rel}`;

  let jpHtml: string;
  let cnHtml: string;
  try {
    const [jpPage, cnPage] = await Promise.all([
      fetchPageForSite(jpUrl, site, { signal, referer: searchUrl, timeoutMs: 20000 }),
      fetchPageForSite(cnUrl, site, { signal, referer: searchUrl, timeoutMs: 20000 }),
    ]);
    jpHtml = jpPage?.html || "";
    cnHtml = cnPage?.html || "";
    rememberIqqtvMirrorFromFinalUrl(jpPage?.finalUrl || cnPage?.finalUrl || "", jpUrl);
  } catch (err) {
    return {
      source: "iqqtv",
      fields: {},
      ms: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  if (!jpHtml || jpHtml.length < 800 || !pageMentionsCode(jpHtml, std)) {
    return { source: "iqqtv", fields: {}, ms: Date.now() - started, error: "日文详情不可用" };
  }
  if (!cnHtml || cnHtml.length < 800 || !pageMentionsCode(cnHtml, std)) {
    return { source: "iqqtv", fields: {}, ms: Date.now() - started, error: "中文详情不可用" };
  }

  const jp = parseIqqtvDetailHtml(jpHtml, std, jpUrl);
  const cn = parseIqqtvDetailHtml(cnHtml, std, cnUrl);
  if (!cn.fields.title && !jp.fields.title) {
    return { source: "iqqtv", fields: {}, ms: Date.now() - started, error: "未找到标题" };
  }

  const coverUrl = cn.coverUrl || jp.coverUrl;
  return {
    source: "iqqtv",
    fields: {
      title: jp.fields.title || cn.fields.title,
      titleZh: cn.fields.title || jp.fields.title,
      plot: cn.fields.plot || jp.fields.plot,
      originalPlot: jp.fields.plot || cn.fields.plot,
      actors: cn.fields.actors?.length ? cn.fields.actors : jp.fields.actors,
      genres: cn.fields.genres?.length ? cn.fields.genres : jp.fields.genres,
      studio: cn.fields.studio || jp.fields.studio,
      series: cn.fields.series || jp.fields.series,
      premiered: cn.fields.premiered || jp.fields.premiered,
      website: cnUrl,
    },
    coverUrl,
    ms: Date.now() - started,
  };
}

export const iqqtvProvider: ScrapeProvider = {
  id: "iqqtv",
  async scrape(ctx: ScrapeContext): Promise<ProviderResult | null> {
    try {
      return await scrapeIqqtvDetail(ctx.code, ctx.signal);
    } catch (err) {
      return {
        source: "iqqtv",
        fields: {},
        ms: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
