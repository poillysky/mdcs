import * as cheerio from "cheerio";
import { fetchText } from "../network/fetch.js";
import {
  absUrl,
  cleanTitle,
  isJunkCoverUrl,
  isJunkTitle,
  pickOgImage,
  stripTags,
} from "./htmlUtils.js";
import { prepareProviderFetch, siteFetchOpts } from "./providerSite.js";
import type { ProviderResult, ScrapeContext, ScrapeProvider } from "../types.js";

const DEFAULT_BASE = "https://avsex.cc";

const TITLE_PREFIXES = [
  "[VIP会员点播] ",
  "[VIP會員點播] ",
  "[VIP] ",
  "★ (请到免费赠片区观赏)",
  "(破解版独家中文)",
];

/** MDCX：n1234 小写，其余大写 */
export function normalizeAvsexCode(code: string): string {
  const c = String(code || "").trim();
  if (/^n\d{4}$/i.test(c)) return c.toLowerCase();
  return c.toUpperCase();
}

/** MDCX get_real_url 标题匹配 */
export function matchAvsexSearchTitle(title: string, code: string): boolean {
  const std = normalizeAvsexCode(code);
  const t = title.trim();
  if (!t) return false;
  const upper = t.toUpperCase();
  if (upper.startsWith(std)) return true;
  if (upper.includes(`${std}-`) && /^\d/.test(t)) return true;
  return false;
}

export function getAvsexRealUrl(
  html: string,
  code: string,
  base: string,
): { detailUrl: string; posterUrl: string } | null {
  const $ = cheerio.load(html);
  for (const el of $("a[href*='/video/detail/']").toArray()) {
    const a = $(el);
    const title = stripTags(a.find("h4.truncate").first().text());
    if (!matchAvsexSearchTitle(title, code)) continue;
    const href = a.attr("href") || "";
    if (!href) continue;
    const poster =
      a.find("div.relative.overflow-hidden.rounded-t-md img").first().attr("src") ||
      a.find("div.relative.overflow-hidden img").first().attr("src") ||
      "";
    return {
      detailUrl: absUrl(href, base) ?? "",
      posterUrl: poster ? absUrl(poster, base) ?? "" : "",
    };
  }
  return null;
}

function dlLinks($: cheerio.CheerioAPI, label: RegExp): string[] {
  const out: string[] = [];
  $("dl dt").each((_, el) => {
    const name = stripTags($(el).text());
    if (!label.test(name)) return;
    $(el)
      .next("dd")
      .find("a[title]")
      .each((__, a) => {
        const t = $(a).attr("title")?.trim() || stripTags($(a).text());
        if (t && t !== "N/A") out.push(t);
      });
  });
  return [...new Set(out)];
}

function dlText($: cheerio.CheerioAPI, label: RegExp): string {
  let found = "";
  $("dl dt").each((_, el) => {
    const name = stripTags($(el).text());
    if (!label.test(name)) return;
    found = stripTags($(el).next("dd").text());
  });
  return found.replace(/^N\/A$/i, "").trim();
}

/** MDCX get_runtime：HH:MM:SS → 分钟 */
export function parseAvsexRuntime(raw: string): number | null {
  const t = String(raw || "").trim();
  const hms = t.match(/(\d+)\s*:\s*(\d+)\s*:\s*(\d+)/);
  if (hms) return Number(hms[1]) * 60 + Number(hms[2]);
  const n = Number(t.match(/(\d+)/)?.[1] || 0);
  return n > 0 ? n : null;
}

export function parseAvsexPremiered(raw: string): string | undefined {
  const m = String(raw || "").trim().match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!m) return undefined;
  return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
}

export function parseAvsexTitle(html: string, code: string): string {
  const $ = cheerio.load(html);
  let title =
    stripTags($("h1.sr-only").first().text()) ||
    html.match(/<meta\s+name="title"\s+content="([^"]+)"/i)?.[1]?.split("|")[1]?.trim() ||
    "";
  for (const prefix of TITLE_PREFIXES) title = title.split(prefix).join("");
  title = title
    .replace(new RegExp(`^${normalizeAvsexCode(code).replace(/[-]/g, "[-_]?")}\\s*`, "i"), "")
    .replace(/\s+/g, " ")
    .trim();
  title = cleanTitle(title, code);
  return isJunkTitle(title) ? "" : title;
}

/** MDCX get_mosaic — 限定 article，避免导航「無碼」误判 */
export function parseAvsexMosaic(html: string, studio = ""): string {
  if (/國產|国产/.test(studio)) return "国产";
  const $ = cheerio.load(html);
  const legacy = stripTags($("article span.bg-blue-800").first().text());
  if (legacy) return /無|无/.test(legacy) ? "无码" : "有码";
  const badges = $("article h2.text-xl span")
    .toArray()
    .map((el) => stripTags($(el).text()))
    .join(" ");
  if (/無碼|无码|not-pixelated/i.test(badges)) return "无码";
  return "有码";
}

/** 从 srcset 取最大宽度 JPG（跳过 data: SVG 占位） */
export function pickBestAvsexImageUrl(src?: string, srcset?: string): string {
  if (srcset) {
    let best = "";
    let bestW = 0;
    for (const part of srcset.split(",")) {
      const m = part.trim().match(/^(\S+)\s+(\d+)w$/);
      const url = m?.[1] || "";
      if (!url.startsWith("http")) continue;
      const w = Number(m?.[2] || 0);
      if (w >= bestW) {
        bestW = w;
        best = url;
      }
    }
    if (best) return best;
  }
  return src?.startsWith("http") ? src : "";
}

/** MDCX get_extrafanart — 精彩劇照区；优先 srcset 大图 */
export function parseAvsexExtrafanart(html: string, base: string): string[] {
  const $ = cheerio.load(html);
  const out: string[] = [];
  $("h2").each((_, el) => {
    const head = stripTags($(el).text());
    if (!/精彩劇照|精彩剧照/.test(head)) return;
    $(el)
      .next("ul")
      .find("img[src]")
      .each((__, img) => {
        const picked = pickBestAvsexImageUrl($(img).attr("src"), $(img).attr("srcset"));
        if (!picked) return;
        out.push(absUrl(picked, base) ?? "");
      });
  });
  return [...new Set(out)];
}

export function parseAvsexOutline(html: string): string {
  const $ = cheerio.load(html);
  let plot = "";
  $("h2").each((_, el) => {
    const head = stripTags($(el).text());
    if (!/劇情簡介|剧情简介/.test(head)) return;
    plot = stripTags($(el).next("p").text());
  });
  const rep = [
    "(中文字幕1280x720)",
    "(日本同步最新‧中文字幕1280x720)",
    "(日本同步最新‧中文字幕)",
    "(日本同步最新‧完整激薄版‧中文字幕1280x720)",
    "＊日本女優＊ 劇情做愛影片 ＊完整日本版＊",
    "＊日本女优＊ 剧情做爱影片 ＊完整日本版＊",
    "★ (请到免费赠片区观赏)",
  ];
  for (const s of rep) plot = plot.split(s).join("");
  plot = plot.replace(/\s+/g, " ").trim();
  return plot.length >= 12 && !isJunkTitle(plot) ? plot : "";
}

export type AvsexParsedDetail = {
  fields: ProviderResult["fields"];
  coverUrl: string | null;
  extrafanartUrls?: string[];
};

export function parseAvsexDetailHtml(
  html: string,
  code: string,
  base: string,
  posterFromSearch = "",
): AvsexParsedDetail {
  const $ = cheerio.load(html);
  const std = normalizeAvsexCode(code);
  let title = parseAvsexTitle(html, std);
  if (!title) {
    const visible = stripTags($("article h2.text-xl").text());
    title = cleanTitle(visible.replace(new RegExp(`^${std.replace(/[-]/g, "[-_]?")}\\s*`, "i"), ""), std);
    if (isJunkTitle(title)) title = "";
  }

  const actors = dlLinks($, /演員|演员/);
  const genres = dlLinks($, /標籤|标签|類別|类别/);
  let studio = dlText($, /製作商|制作商/);
  if (!studio || studio === "N/A") studio = "";

  const runtime = parseAvsexRuntime(dlText($, /片長|片长/));
  const premiered = parseAvsexPremiered(dlText($, /上架日/));
  const plot = parseAvsexOutline(html);
  const mosaic = parseAvsexMosaic(html, studio);
  const extrafanartUrls = parseAvsexExtrafanart(html, base);

  let cover: string | null =
    pickOgImage(html) ||
    $("video[poster]").attr("poster") ||
    $("div.relative.overflow-hidden.rounded-md img").first().attr("src") ||
    posterFromSearch ||
    "";
  if (cover) cover = absUrl(cover, base);
  if (cover && isJunkCoverUrl(cover)) cover = null;

  return {
    fields: {
      title: title || undefined,
      titleZh: title || undefined,
      plot: plot || undefined,
      originalPlot: plot || undefined,
      actors,
      genres,
      studio: studio || undefined,
      premiered,
      runtime,
      mosaic,
      website: undefined,
    },
    coverUrl: cover,
    extrafanartUrls: extrafanartUrls.length ? extrafanartUrls : undefined,
  };
}

async function scrapeAvsexDetail(code: string, signal?: AbortSignal): Promise<ProviderResult> {
  const started = Date.now();
  const site = await prepareProviderFetch("avsex", DEFAULT_BASE);
  const base = site.baseUrl.replace(/\/$/, "");
  if (!base) return { source: "avsex", fields: {}, ms: Date.now() - started, error: "未配置网站地址" };

  const std = normalizeAvsexCode(code);
  const searchUrl = `${base}/tw/search?query=${encodeURIComponent(std.toLowerCase())}`;
  const searchHtml = await fetchText(
    searchUrl,
    siteFetchOpts(site, { signal, referer: `${base}/`, timeoutMs: 60000 }),
  );

  const hit = getAvsexRealUrl(searchHtml, std, base);
  if (!hit?.detailUrl) {
    return { source: "avsex", fields: {}, ms: Date.now() - started, error: "搜索无结果" };
  }

  const detailHtml = await fetchText(
    hit.detailUrl,
    siteFetchOpts(site, { signal, referer: searchUrl, timeoutMs: 60000 }),
  );

  const parsed = parseAvsexDetailHtml(detailHtml, std, base, hit.posterUrl);
  if (!parsed.fields.title) {
    return {
      source: "avsex",
      fields: parsed.fields,
      coverUrl: parsed.coverUrl,
      ms: Date.now() - started,
      error: "未找到标题",
    };
  }

  return {
    source: "avsex",
    fields: {
      ...parsed.fields,
      website: hit.detailUrl,
    },
    coverUrl: parsed.coverUrl,
    extrafanartUrls: parsed.extrafanartUrls,
    alternateCoverUrls:
      hit.posterUrl && hit.posterUrl !== parsed.coverUrl ? [hit.posterUrl] : undefined,
    ms: Date.now() - started,
  };
}

export const avsexProvider: ScrapeProvider = {
  id: "avsex",
  async scrape(ctx: ScrapeContext): Promise<ProviderResult | null> {
    try {
      return await scrapeAvsexDetail(ctx.code, ctx.signal);
    } catch (err) {
      return {
        source: "avsex",
        fields: {},
        ms: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
