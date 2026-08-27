import * as cheerio from "cheerio";
import { fetchText } from "../network/fetch.js";
import {
  absUrl,
  cleanTitle,
  codeKey,
  isJunkCoverUrl,
  isJunkTitle,
  pickOgImage,
  stdCode,
  stripTags,
} from "./htmlUtils.js";
import { prepareProviderFetch, siteFetchOpts } from "./providerSite.js";
import type { ProviderResult, ScrapeContext, ScrapeProvider } from "../types.js";

const DEFAULT_BASE = "https://javday.app";

/** MDCX：直链 /videos/{code}/；现站须去掉横杠 SONE-001 → SONE001 */
export function javdayPathCode(code: string): string {
  return stdCode(code).replace(/-/g, "").toUpperCase();
}

/** 对齐 MDCX number_list：依次尝试多种写法 */
export function javdayUrlPathCodes(code: string): string[] {
  const std = stdCode(code);
  const out = new Set<string>();
  out.add(javdayPathCode(std));
  if (/^FC2/i.test(std)) {
    out.add(std.replace(/\s+/g, "-").toUpperCase());
  }
  const m = std.match(/^([A-Z]{2,12})-(\d{2,}[A-Z0-9]*)$/i);
  if (m) out.add(`${m[1]}${m[2]}`.toUpperCase());
  return [...out];
}

export function isJavdayDetailHtml(html: string): boolean {
  if (!html || html.length < 2000) return false;
  if (/荒原|沒有視頻|没有视频|aks-404-page/i.test(html)) return false;
  return /id=["']videoInfo["']/.test(html) && /video-title|jpnum/.test(html);
}

export function parseJavdayMosaic(videoInfoHtml: string, _code: string): string {
  if (/国产|國產|chinese-av/i.test(videoInfoHtml)) return "国产";
  if (/无码|無碼|uncensored/i.test(videoInfoHtml)) return "无码";
  return "有码";
}

export function parseJavdayDetailHtml(
  html: string,
  detailUrl: string,
  code: string,
): ProviderResult | null {
  if (!isJavdayDetailHtml(html)) return null;

  const $ = cheerio.load(html);
  const std = stdCode(code);
  const pageCode = stripTags($(".jpnum").first().text());
  if (pageCode && codeKey(pageCode) !== codeKey(std)) return null;

  let title = stripTags($("#videoInfo h1.video-title, #videoInfo h1").first().text());
  title = cleanTitle(
    title.replace(new RegExp(`^${std.replace(/-/g, "[-]?")}\\s*`, "i"), ""),
    std,
  );
  if (isJunkTitle(title)) title = "";

  const actors = $(".vod_actor a")
    .map((_, el) => stripTags($(el).text()))
    .get()
    .filter((n) => n && n !== "N/A" && !/未知/.test(n));
  const uniqActors = [...new Set(actors)].slice(0, 20);

  const genres = $("#videoInfo .tag a")
    .map((_, el) => stripTags($(el).text()))
    .get()
    .filter((g) => g && g.length <= 40);
  const uniqGenres = [...new Set(genres)].slice(0, 40);

  let plot =
    stripTags($('meta[name="description"]').attr("content") || "") ||
    stripTags($('meta[property="og:description"]').attr("content") || "");
  plot = plot.replace(new RegExp(`^${std.replace(/-/g, "[-]?")}\\s*`, "i"), "").trim();
  if (plot.length < 8 || /JAVDAY|免費高清|在线看/i.test(plot) && plot.length < 40) plot = "";

  let cover: string | null = pickOgImage(html) || "";
  if (cover) cover = absUrl(cover, detailUrl) || cover;
  if (cover && isJunkCoverUrl(cover)) cover = null;

  const mosaic = parseJavdayMosaic($("#videoInfo").html() || "", std);

  if (!title && !cover && !uniqActors.length && !uniqGenres.length) return null;

  return {
    source: "javday",
    fields: {
      title: title || undefined,
      titleZh: title || undefined,
      plot: plot || undefined,
      actors: uniqActors,
      genres: uniqGenres,
      mosaic,
    },
    coverUrl: cover,
    ms: 0,
  };
}

async function scrapeJavdayDetail(code: string, signal?: AbortSignal): Promise<ProviderResult> {
  const started = Date.now();
  const std = stdCode(code);
  const site = await prepareProviderFetch("javday", DEFAULT_BASE);
  const base = site.baseUrl.replace(/\/$/, "");
  if (!base) return { source: "javday", fields: {}, ms: Date.now() - started, error: "未配置网站地址" };

  let detailHtml = "";
  let detailUrl = "";
  for (const pathCode of javdayUrlPathCodes(std)) {
    const url = `${base}/videos/${encodeURIComponent(pathCode)}/`;
    const html = await fetchText(
      url,
      siteFetchOpts(site, { signal, referer: `${base}/`, timeoutMs: 60000 }),
    );
    if (isJavdayDetailHtml(html)) {
      detailHtml = html;
      detailUrl = url;
      break;
    }
  }

  if (!detailHtml) {
    return { source: "javday", fields: {}, ms: Date.now() - started, error: "未找到" };
  }

  const parsed = parseJavdayDetailHtml(detailHtml, detailUrl, std);
  if (!parsed) {
    return { source: "javday", fields: {}, ms: Date.now() - started, error: "解析失败" };
  }

  return {
    ...parsed,
    fields: { ...parsed.fields, website: detailUrl },
    ms: Date.now() - started,
  };
}

export const javdayProvider: ScrapeProvider = {
  id: "javday",
  async scrape(ctx: ScrapeContext): Promise<ProviderResult | null> {
    try {
      return await scrapeJavdayDetail(ctx.code, ctx.signal);
    } catch (err) {
      return {
        source: "javday",
        fields: {},
        ms: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
