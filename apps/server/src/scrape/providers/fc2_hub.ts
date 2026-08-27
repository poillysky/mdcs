import * as cheerio from "cheerio";
import { fetchJson } from "../network/fetch.js";
import {
  absUrl,
  cleanTitle,
  isJunkCoverUrl,
  isJunkTitle,
  pickOgTitle,
  stripTags,
} from "./htmlUtils.js";
import { prepareProviderFetch, fetchPageForSite, siteFetchOpts } from "./providerSite.js";
import type { ProviderResult, ScrapeContext, ScrapeProvider } from "../types.js";

const DEFAULT_BASE = "https://javten.com";

function parseFc2Id(code: string): { id: string; displayCode: string } | null {
  const m = code.match(/FC2[-_]?PPV[-_]?(\d+)/i) || code.match(/FC2[-_]?(\d+)/i);
  if (!m) return null;
  const id = m[1]!;
  return { id, displayCode: `FC2-PPV-${id}` };
}

function hubAbsUrl(href: string, base: string): string | null {
  const trimmed = String(href || "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("//")) return absUrl(`https:${trimmed}`, base);
  return absUrl(trimmed, base);
}

/** MDCX getTitle：第二个 h1 */
export function parseFc2HubTitle(html: string, displayCode: string, id: string): string {
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((x) => stripTags(x[1] || ""));
  const h1Title = h1s.length >= 2 ? h1s[1]! : h1s.find((t) => t && !/^FC2/i.test(t)) || h1s[0] || "";
  let title = cleanTitle(h1Title || pickOgTitle(html), displayCode);
  title = title.replace(new RegExp(`^FC2[-_]?PPV[-_]?${id}\\s*[-–—:]?\\s*`, "i"), "").trim();
  return title;
}

/**
 * MDCX getCover：仅 fancybox gallery（含 //contents-thumbnail / storage）。
 * 禁止 JSON-LD/og 回退。旧片 storage 可能 404，下载层再失败回退其他源。
 */
export function parseFc2HubCover(html: string, baseUrl: string): string | null {
  const candidates: string[] = [];
  for (const m of html.matchAll(
    /<a[^>]+data-fancybox=["']gallery["'][^>]+href=["']([^"']+)["']/gi,
  )) {
    candidates.push(m[1]!);
  }
  for (const m of html.matchAll(
    /href=["']([^"']+)["'][^>]+data-fancybox=["']gallery["']/gi,
  )) {
    candidates.push(m[1]!);
  }
  const urls = candidates
    .map((raw) => hubAbsUrl(raw, baseUrl))
    .filter((url): url is string => !!url && !isJunkCoverUrl(url));
  // 优先 thumbnail CDN（新片 fancybox 常给 w1280，比裸 storage 稳）
  return urls.find((u) => /contents-thumbnail\d*\.fc2\.com/i.test(u)) || urls[0] || null;
}

/** MDCX getExtraFanart：div[style="padding: 0"]/a */
export function parseFc2HubExtrafanart(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const urls: string[] = [];
  $('div[style*="padding: 0"] a[href], div[style*="padding:0"] a[href]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const url = hubAbsUrl(href, baseUrl);
    if (!url || isJunkCoverUrl(url) || urls.includes(url)) return;
    if (!/\.(jpe?g|png|webp)(\?|$)/i.test(url) && !/\/file\//i.test(url) && !/contents-thumbnail/i.test(url))
      return;
    urls.push(url);
  });
  return urls.slice(0, 30);
}

/** MDCX getMosaic：标签/标题含 無修正 → 无码 */
export function parseFc2HubMosaic(tags: string[], title: string): string {
  const blob = `${tags.join(" ")} ${title}`;
  return /無修正|无码|uncensored/i.test(blob) ? "无码" : "有码";
}

/** MDCX getStudio：div.col-8 卖家 */
export function parseFc2HubStudio(html: string): string | undefined {
  const $ = cheerio.load(html);
  let t = stripTags($("div.col-8").first().text());
  // 页上常带评分/数字尾巴
  t = t.replace(/\s+\d+(\.\d+)?\s*$/, "").trim();
  return t && t.length <= 80 ? t : undefined;
}

/** MDCX getTag：p.card-text 内 /tag/ 链接 */
export function parseFc2HubTags(html: string): string[] {
  const $ = cheerio.load(html);
  const tags: string[] = [];
  $('p.card-text a[href*="/tag/"]').each((_, el) => {
    const n = stripTags($(el).text());
    if (n && n.length <= 40 && !tags.includes(n)) tags.push(n);
  });
  return tags;
}

/** MDCX getOutline：div.col.des */
export function parseFc2HubOutline(html: string): string | undefined {
  const $ = cheerio.load(html);
  let t = stripTags($("div.col.des").first().text())
    .replace(/・/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // 过盾页偶发把 CF 脚本拼进简介
  t = t.replace(/\(function\(\)\s*\{[\s\S]*$/i, "").trim();
  if (t.length >= 12 && !isJunkTitle(t)) return t;
  return undefined;
}

/** MDCX getTrailerVideoId */
export function parseFc2HubTrailerVideoId(html: string, number: string): string {
  const $ = cheerio.load(html);
  const fromApi = $('[class*="player-api"][data-id]').attr("data-id");
  if (fromApi && /^\d+$/.test(fromApi)) return fromApi;
  const iframe =
    $('iframe[data-src*="/embed/"]').attr("data-src") || $('iframe[src*="/embed/"]').attr("src") || "";
  const embed = iframe.match(/\/embed\/(\d+)/i)?.[1];
  if (embed) return embed;
  return number;
}

function parseFc2HubLdMeta(html: string): {
  date: string;
  runtime: number | null;
  genres: string[];
  actors: string[];
} {
  let ldDate = "";
  let ldRuntime: number | null = null;
  const ldGenres: string[] = [];
  const ldActors: string[] = [];
  for (const block of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const data = JSON.parse(block[1] || "");
      for (const item of Array.isArray(data) ? data : [data]) {
        if (!item || typeof item !== "object") continue;
        const t = String(item["@type"] || "");
        if (t !== "Movie" && t !== "VideoObject" && t !== "Product") continue;
        ldDate = String(item.datePublished || ldDate || "").trim();
        const dur = String(item.duration || "");
        const mins = dur.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
        if (mins) ldRuntime = Number(mins[1] || 0) * 60 + Number(mins[2] || 0) || ldRuntime;
        if (Array.isArray(item.genre)) {
          for (const g of item.genre) {
            const n = String(g || "").trim();
            if (n && !ldGenres.includes(n)) ldGenres.push(n);
          }
        }
        if (Array.isArray(item.actor)) {
          for (const a of item.actor) {
            const n = String(a?.name || a || "").trim();
            if (n && !ldActors.includes(n)) ldActors.push(n);
          }
        }
      }
    } catch {
      /* ignore */
    }
  }
  return { date: ldDate, runtime: ldRuntime, genres: ldGenres, actors: ldActors };
}

export { parseFc2Id };

function hubBlocked(html: string): boolean {
  return /Edge IP Restricted|Just a moment|cf-browser-verification|Access Denied/i.test(html);
}

export function parseFc2HubDetailHtml(
  html: string,
  detailUrl: string,
  code: string,
  trailerUrl?: string,
): ProviderResult | null {
  const parsed = parseFc2Id(code);
  if (!parsed) return null;
  const { id, displayCode } = parsed;

  const title = parseFc2HubTitle(html, displayCode, id);
  if (!title || isJunkTitle(title)) return null;

  const cover = parseFc2HubCover(html, detailUrl);
  const extrafanartUrls = parseFc2HubExtrafanart(html, detailUrl);
  const studio = parseFc2HubStudio(html);
  const tagGenres = parseFc2HubTags(html);
  const plot = parseFc2HubOutline(html);
  const ld = parseFc2HubLdMeta(html);
  // mdcx：标签优先；默认不用卖家当演员（fields_rule 无 FC2_SELLER）
  const genres = [...new Set([...tagGenres, ...ld.genres])].slice(0, 40);
  const actors = ld.actors.filter((a) => a && a !== studio).slice(0, 20);
  const mosaic = parseFc2HubMosaic(genres, title);

  // mdcx 配置排除 hub 的 release/runtime；LD 有值时仍可作补充，无则空
  let premiered = "";
  const dm = ld.date.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (dm) premiered = `${dm[1]}-${dm[2]!.padStart(2, "0")}-${dm[3]!.padStart(2, "0")}`;

  return {
    source: "fc2_hub",
    fields: {
      title,
      plot: plot || undefined,
      originalPlot: plot || undefined,
      genres,
      actors,
      studio,
      publisher: studio,
      // mdcx 写死 FC2系列
      series: "FC2系列",
      premiered: premiered || undefined,
      runtime: ld.runtime && ld.runtime > 0 ? ld.runtime : null,
      trailerUrl,
      website: detailUrl,
      mosaic,
    },
    coverUrl: cover,
    extrafanartUrls: extrafanartUrls.length ? extrafanartUrls : undefined,
    ms: 0,
  };
}

async function fetchFc2HubTrailer(videoId: string, signal?: AbortSignal): Promise<string | undefined> {
  try {
    const data = await fetchJson<{ path?: string }>(
      `https://adult.contents.fc2.com/api/v2/videos/${videoId}/sample`,
      {
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000),
        timeoutMs: 8000,
        referer: "https://adult.contents.fc2.com/",
      },
    );
    const path = data?.path;
    if (typeof path === "string" && path.startsWith("http")) return path;
  } catch {
    /* ignore */
  }
  return undefined;
}

function pickDetailLink(html: string, base: string, id: string): string | null {
  const langSkip = /\/tw\/|\/ko\/|\/en\//i;
  const fromLink = [...html.matchAll(new RegExp(`<link[^>]+href=["']([^"']*id${id}[^"']*)["']`, "gi"))]
    .map((m) => m[1]!)
    .find((h) => !langSkip.test(h));
  if (fromLink) return hubAbsUrl(fromLink, base);

  const landed = html.match(new RegExp(`https?://[^"'\\s]+/video/\\d+/id${id}\\b`, "i"))?.[0];
  if (landed) return landed;

  const href =
    [...html.matchAll(new RegExp(`(?:href|content)=["']([^"']*id${id}[^"']*)["']`, "gi"))]
      .map((x) => x[1]!)
      .find((h) => /\/video\/\d+\/id/i.test(h) && !langSkip.test(h)) ||
    html.match(new RegExp(`href=["']([^"']*(?:id)?${id}[^"']*)["']`, "i"))?.[1];
  return href ? hubAbsUrl(href, base) : null;
}

async function scrapeFc2HubDetail(code: string, signal?: AbortSignal): Promise<ProviderResult> {
  const started = Date.now();
  const parsed = parseFc2Id(code);
  if (!parsed) {
    return { source: "fc2_hub", fields: {}, ms: Date.now() - started, error: "番号格式无效" };
  }
  const { id } = parsed;
  const site = await prepareProviderFetch("fc2_hub", DEFAULT_BASE);
  const base = site.baseUrl;
  if (!base) return { source: "fc2_hub", fields: {}, ms: Date.now() - started, error: "未配置网站地址" };

  /** 单次搜索即可；多语言路径会重复打 Flare（~18s/次） */
  const searchUrl = `${base}/search?kw=${encodeURIComponent(id)}`;
  const fetchOpts = siteFetchOpts(site, { signal, referer: `${base}/`, timeoutMs: 60000 });

  let detailUrl: string | null = null;
  let html: string | null = null;

  const searchPage = await fetchPageForSite(searchUrl, site, fetchOpts);
  const searchHtml = searchPage?.html || "";
  if (searchHtml.length >= 500 && !hubBlocked(searchHtml)) {
    detailUrl = pickDetailLink(searchHtml, base, id);
    if (detailUrl) {
      html = /data-fancybox=["']gallery["']/i.test(searchHtml) ? searchHtml : null;
      if (!html) {
        const detailPage = await fetchPageForSite(
          detailUrl,
          site,
          siteFetchOpts(site, { signal, referer: searchUrl, timeoutMs: 45000 }),
        );
        html = detailPage?.html || null;
      }
    }
  }

  if (!html || !detailUrl) {
    return { source: "fc2_hub", fields: {}, ms: Date.now() - started, error: "未找到" };
  }

  const trailerVideoId = parseFc2HubTrailerVideoId(html, id);
  const trailerUrl = await fetchFc2HubTrailer(trailerVideoId, signal);

  const result = parseFc2HubDetailHtml(html, detailUrl, code, trailerUrl);
  if (!result) {
    return { source: "fc2_hub", fields: {}, ms: Date.now() - started, error: "未找到标题" };
  }
  return { ...result, ms: Date.now() - started };
}

export const fc2HubProvider: ScrapeProvider = {
  id: "fc2_hub",
  async scrape(ctx: ScrapeContext): Promise<ProviderResult | null> {
    try {
      return await scrapeFc2HubDetail(ctx.code, ctx.signal);
    } catch (err) {
      return {
        source: "fc2_hub",
        fields: {},
        ms: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
