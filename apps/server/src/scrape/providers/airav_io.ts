import {
  invalidateAiravMirror,
  isAiravOfficialBase,
  normalizeAiravCnBase,
  rememberAiravMirror,
  resolveAiravCnBase,
} from "../network/airavMirror.js";
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
import { fetchPageForSite, prepareProviderFetch } from "./providerSite.js";
import type { ProviderResult, ScrapeContext, ScrapeProvider } from "../types.js";

const DEFAULT_BASE = "https://airav.io/cn";
const JUNK_ENTRY_RE = /克破|无码破解|無碼破解|无码流出|無碼流出|马赛克破坏|馬賽克破壞|馬賽克破解版|無碼流出版/i;
const TITLE_EPISODE_MARKERS = ["第一集", "第二集", " - 上", " - 下", " 上集", " 下集", " -上", " -下"];

/** MDCX number.match_number */
export function matchAiravNumber(text: string, number: string): boolean {
  const hay = String(text || "");
  const num = String(number || "").trim();
  if (!num) return false;
  if (/^\d/.test(num)) return hay.toUpperCase().includes(num.toUpperCase());
  const esc = num.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  return new RegExp(`(?<![A-Z0-9])${esc}(?![A-Z0-9])`, "i").test(hay);
}

export function normalizeAiravCode(code: string): string {
  const raw = String(code || "").trim().toUpperCase();
  if (/^N\d{4}$/i.test(raw)) return raw.toLowerCase();
  return raw;
}

export function isAiravJunkEntry(title: string): boolean {
  return JUNK_ENTRY_RE.test(String(title || ""));
}

/** MDCX //div[@class="col oneVideo"] 逐卡解析 */
export function listAiravSearchCards(html: string): Array<{ href: string; title: string }> {
  const out: Array<{ href: string; title: string }> = [];
  for (const m of html.matchAll(
    /<div[^>]*class=["'][^"']*col oneVideo[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi,
  )) {
    const chunk = m[1] || "";
    const href = chunk.match(/href=["']([^"']*\/video\?hid=[^"'#]+)["']/i)?.[1]?.trim() || "";
    const title = stripTags(chunk.match(/<h5[^>]*>([\s\S]*?)<\/h5>/i)?.[1] || "");
    if (href) out.push({ href, title });
  }
  return out;
}

/** MDCX get_real_url + 色花 pickAiravHidFromSearch */
export function pickAiravHidFromSearch(html: string, code: string): string | null {
  const hits = listAiravSearchCards(html);
  const hrefs = hits.map((h) => h.href);
  if (hrefs.length === 1) {
    const only = hits[0]!;
    if (!isAiravJunkEntry(only.title)) return only.href;
    return null;
  }
  for (const hit of hits) {
    if (!matchAiravNumber(hit.title, code)) continue;
    if (isAiravJunkEntry(hit.title)) continue;
    return hit.href;
  }
  for (const m of html.matchAll(/<h5[^>]*>([\s\S]*?)<\/h5>/gi)) {
    const h5 = stripTags(m[1] || "");
    if (!matchAiravNumber(h5, code) || isAiravJunkEntry(h5)) continue;
    const before = html.slice(Math.max(0, (m.index || 0) - 800), m.index || 0);
    const href =
      before.match(/href=["']([^"']*\/video\?hid=[^"'#]+)["'][^>]*>\s*$/i)?.[1] ||
      [...before.matchAll(/href=["']([^"']*\/video\?hid=[^"'#]+)["']/gi)].pop()?.[1];
    if (href) return href;
  }
  return null;
}

export function airavDetailCodeOk(html: string, code: string): boolean {
  const codeRe = new RegExp(`^${code.replace(/-/g, "[-_]?")}$`, "i");
  const span =
    html.match(/番[号號]\s*[：:]\s*<span[^>]*>([^<]+)<\/span>/i)?.[1] ||
    html.match(/番[号號]\s*<span[^>]*>([^<]+)<\/span>/i)?.[1];
  if (span && codeRe.test(stripTags(span))) return true;
  const h1 = stripTags(
    html.match(/<div[^>]*class=["'][^"']*video-title[^"']*["'][^>]*>[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ||
      html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ||
      "",
  );
  if (h1 && new RegExp(`^${code.replace(/-/g, "[-_]?")}\\b`, "i").test(h1)) return true;
  const og = pickOgTitle(html);
  return Boolean(og && new RegExp(`^${code.replace(/-/g, "[-_]?")}\\b`, "i").test(og));
}

/** MDCX get_cover — ld+json thumbnailUrl */
export function pickAiravLdJsonCover(html: string): string {
  const raw = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (!raw) return "";
  try {
    const data = JSON.parse(raw.trim()) as { thumbnailUrl?: string | string[] };
    const thumbs = data.thumbnailUrl;
    if (typeof thumbs === "string") return thumbs.trim();
    if (Array.isArray(thumbs) && thumbs[0]) return String(thumbs[0]).trim();
  } catch {
    /* ignore */
  }
  return "";
}

function stripAiravTitlePrefix(title: string, webNumber: string): string {
  let out = String(title || "").trim();
  for (const prefix of [`[${webNumber}]`, webNumber]) {
    if (prefix && out.startsWith(prefix)) {
      out = out.slice(prefix.length).trim();
    }
  }
  for (const marker of TITLE_EPISODE_MARKERS) {
    out = out.replace(marker, "").trim();
  }
  return out;
}

function detectAiravMosaic(genres: string[]): string | undefined {
  const joined = genres.join(",");
  if (/无码|無修正|無码|uncensored/i.test(joined)) return "无码";
  return "有码";
}

/** 色花 parseAiravIoDetail + MDCX 字段补全 */
export function parseAiravIoDetail(html: string, pageUrl: string, code: string): ProviderResult | null {
  if (/找不到|404|Not Found/i.test(html) && !/video-title|og:title|oneVideo/i.test(html)) {
    return null;
  }

  const webNumber =
    stripTags(html.match(/番[号號]\s*[：:]?\s*<span[^>]*>([^<]+)<\/span>/i)?.[1] || "") || code;

  let title = cleanTitle(
    html.match(/<div[^>]*class=["'][^"']*video-title[^"']*["'][^>]*>[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ||
      pickOgTitle(html),
    code,
  )
    .replace(/\s*[-–—]\s*airav(?:\.io)?\s*$/i, "")
    .trim();
  title = stripAiravTitlePrefix(title, webNumber);
  if (isAiravJunkEntry(title) || isJunkTitle(title)) title = "";

  let cover = pickAiravLdJsonCover(html) || pickOgImage(html);
  if (cover) cover = absUrl(cover, pageUrl);
  if (!cover) {
    const m = html.match(
      /(https?:\/\/[^"'>\s]+\/storage\/cover\/(?:big\/)?[^"'>\s]+\.(?:jpg|jpeg|png|webp))/i,
    );
    if (m?.[1] && !isJunkCoverUrl(m[1])) cover = m[1];
  }
  if (cover && isJunkCoverUrl(cover)) cover = null;

  const actorBlock =
    html.match(/女[优優][\s\S]{0,40}?<\/[^>]+>([\s\S]*?)<\/(?:li|div)>/i)?.[1] ||
    html.match(/女[优優]\s*[：:]([\s\S]*?)<\/li>/i)?.[1] ||
    html.match(/女[优優]\s*[：:]([\s\S]*?)<\/div>/i)?.[1] ||
    "";
  const actors = [
    ...collectByRe(html, /href=["'][^"']*\/(?:cn\/)?actor\?id=\d+["'][^>]*>([^<]+)</gi),
    ...collectByRe(html, /href=["'][^"']*\/(?:cn\/)?actress\/[^"']+["'][^>]*>([^<]+)</gi),
    ...collectByRe(actorBlock, /href=["'][^"']*["'][^>]*>([^<]+)</gi),
    ...collectByRe(actorBlock, />([^<]{1,40})</g),
  ]
    .map((a) => a.trim())
    .filter(
      (a) =>
        a &&
        a.length <= 40 &&
        !/^(女[优優]|一覽|一览|發行|发行|factories|演员|詳|详情)$/i.test(a),
    );
  const uniqActors = [...new Set(actors)].slice(0, 20);

  const tagBlock =
    html.match(/標[签籤]\s*[：:]([\s\S]*?)<\/li>/i)?.[1] ||
    html.match(/标[签籤]\s*[：:]([\s\S]*?)<\/li>/i)?.[1] ||
    "";
  const genres = [
    ...collectByRe(tagBlock, /href=["'][^"']*\/(?:cn\/)?tag\?tid=[^"']*["'][^>]*>([^<]+)</gi),
    ...collectByRe(html, /href=["'][^"']*\/(?:cn\/)?(?:genre|genres)\/[^"']+["'][^>]*>([^<]+)</gi),
  ]
    .map((g) => g.trim())
    .filter(
      (g) =>
        g &&
        !/更多|全部|标签|標籤|類型|类型|一覽|一览|VR|720p|1080p|HD高畫質|AV女優片|中文/i.test(g) &&
        !isJunkTitle(g),
    );
  const uniqGenres = [...new Set(genres)].slice(0, 40);

  let studio =
    stripTags(
      html.match(/廠商\s*[：:]([\s\S]*?)<\/li>/i)?.[1] ||
        html.match(/厂商\s*[：:]([\s\S]*?)<\/li>/i)?.[1] ||
        html.match(/href=["'][^"']*\/(?:cn\/)?tag\?fid=\d+["'][^>]*>([^<]+)</i)?.[1] ||
        html.match(/href=["'][^"']*\/(?:cn\/)?factory(?:\/|\?[^"']*)["'][^>]*>([^<]+)</i)?.[1] ||
        "",
    ) || "";
  if (studio.length < 2 || /一覽|一览|發行商|发行商|廠商|厂商/i.test(studio)) studio = "";

  let series =
    stripTags(
      html.match(/系列\s*[：:]([\s\S]*?)<\/li>/i)?.[1] ||
        html.match(/シリーズ\s*[：:]([\s\S]*?)<\/li>/i)?.[1] ||
        html.match(/href=["'][^"']*\/(?:cn\/)?series\/[^"']+["'][^>]*>([^<]+)</i)?.[1] ||
        "",
    ) || "";
  if (series.length < 2 || isJunkTitle(series)) series = "";

  let plot =
    stripTags(html.match(/<div[^>]*class=["'][^"']*video-info[^"']*["'][^>]*>\s*<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "") ||
    stripTags(
      html.match(/property=["']og:description["']\s+content=["']([^"']+)["']/i)?.[1] ||
        html.match(/content=["']([^"']+)["']\s+property=["']og:description["']/i)?.[1] ||
        "",
    );
  plot = plot.split("*根据分发", 1)[0]!.replace(/[\n\t]/g, "").trim();
  const plotFromVideoInfo = /<div[^>]*class=["'][^"']*video-info/i.test(html);
  const plotMin = plotFromVideoInfo ? 4 : 12;
  if (plot.length < plotMin || isAiravJunkEntry(plot) || isJunkTitle(plot)) plot = "";

  const premiered =
    html.match(/<i[^>]*class=["'][^"']*fa-clock[^"']*["'][^>]*>\s*<\/i>\s*(\d{4}-\d{2}-\d{2})/i)?.[1] ||
    html.match(/fa-clock[\s\S]{0,80}?(\d{4}-\d{2}-\d{2})/i)?.[1] ||
    "";

  if (!title && !cover && !uniqActors.length && !plot && !uniqGenres.length && !series) {
    return null;
  }

  return {
    source: "airav_io",
    fields: {
      title: title || undefined,
      titleZh: title || undefined,
      originalTitle: title || undefined,
      plot: plot || undefined,
      originalPlot: plot || undefined,
      actors: uniqActors,
      genres: uniqGenres,
      studio: studio || undefined,
      series: series || undefined,
      premiered: premiered || undefined,
      mosaic: detectAiravMosaic(uniqGenres),
      website: pageUrl,
    },
    coverUrl: cover,
    ms: 0,
  };
}

async function tryScrapeOnce(
  cnBase: string,
  code: string,
  site: Awaited<ReturnType<typeof prepareProviderFetch>>,
  signal?: AbortSignal,
): Promise<ProviderResult | null> {
  const searchUrl = `${cnBase}/search_result?kw=${encodeURIComponent(code)}`;
  const searchPage = await fetchPageForSite(searchUrl, site, {
    referer: `${cnBase}/`,
    timeoutMs: 20000,
    viaFlare: false,
    strictTimeout: true,
    signal,
  });
  if (!searchPage?.html) return null;

  const landedBase = normalizeAiravCnBase(searchPage.finalUrl || cnBase) || cnBase;
  if (landedBase !== cnBase && !isAiravOfficialBase(landedBase)) {
    rememberAiravMirror(landedBase, cnBase);
  }

  const hidHref = pickAiravHidFromSearch(searchPage.html, code);
  if (!hidHref) return null;

  const detailUrl =
    absUrl(hidHref, landedBase) ||
    `${landedBase.replace(/\/$/, "")}${hidHref.startsWith("/") ? "" : "/"}${hidHref}`;
  if (!detailUrl) return null;

  const detailPage = await fetchPageForSite(detailUrl, site, {
    referer: searchUrl,
    timeoutMs: 20000,
    viaFlare: false,
    strictTimeout: true,
    signal,
  });
  if (!detailPage?.html) return null;
  if (!airavDetailCodeOk(detailPage.html, code)) return null;

  const parsed = parseAiravIoDetail(
    detailPage.html,
    detailPage.finalUrl || detailUrl,
    code,
  );
  if (!parsed) return null;
  if (landedBase && !isAiravOfficialBase(landedBase)) rememberAiravMirror(landedBase, cnBase);
  return parsed;
}

async function scrapeAiravIoDetail(code: string, signal?: AbortSignal): Promise<ProviderResult> {
  const started = Date.now();
  const normalized = normalizeAiravCode(code);
  if (!normalized) {
    return { source: "airav_io", fields: {}, ms: Date.now() - started, error: "番号为空" };
  }

  const site = await prepareProviderFetch("airav_io", DEFAULT_BASE);
  let base = await resolveAiravCnBase({ preferred: site.baseUrl || DEFAULT_BASE });

  let parsed = await tryScrapeOnce(base, normalized, site, signal);
  if (!parsed && !signal?.aborted) {
    invalidateAiravMirror();
    base = await resolveAiravCnBase({ preferred: site.baseUrl || DEFAULT_BASE, forceRefresh: true });
    if (!signal?.aborted) {
      parsed = await tryScrapeOnce(base, normalized, site, signal);
    }
  }

  if (!parsed) {
    return { source: "airav_io", fields: {}, ms: Date.now() - started, error: "未找到" };
  }
  return { ...parsed, ms: Date.now() - started };
}

export const airavIoProvider: ScrapeProvider = {
  id: "airav_io",
  async scrape(ctx: ScrapeContext): Promise<ProviderResult | null> {
    try {
      return await scrapeAiravIoDetail(ctx.code, ctx.signal);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        source: "airav_io",
        fields: {},
        ms: 0,
        error: /HTTP\s*403/i.test(msg)
          ? `${msg}（本站常需代理，请在网络设置配置 proxyUrl）`
          : msg,
      };
    }
  },
};
