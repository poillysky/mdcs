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

const DEFAULT_BASE = "https://lulubar.co";
const IMAGE_HOST = "https://image.lulubar.co";

export function lulubarSearchUrl(base: string, code: string): string {
  return `${base.replace(/\/$/, "")}/video/bysearch?search=${encodeURIComponent(stdCode(code))}&page=1`;
}

export function lulubarDetailUrl(base: string, id: string): string {
  return `${base.replace(/\/$/, "")}/video/detail?id=${encodeURIComponent(id)}`;
}

function normalizeCover(raw: string | null | undefined, detailUrl: string): string | null {
  const u = String(raw || "").trim();
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) {
    return isJunkCoverUrl(u) ? null : u;
  }
  if (u.startsWith("/films/")) {
    const cdn = `${IMAGE_HOST}${u}`;
    return isJunkCoverUrl(cdn) ? null : cdn;
  }
  const abs = absUrl(u, detailUrl);
  if (!abs || isJunkCoverUrl(abs)) return null;
  return abs;
}

export function pickLulubarDetailHref(html: string, code: string): string {
  const std = stdCode(code);
  const want = codeKey(std);
  if (!want) return "";
  const zero = /的搜寻结果\s*\(\s*0\s*\)/i.test(html);
  if (zero) return "";

  const $ = cheerio.load(html);
  let best = "";
  let bestScore = -1;
  $("a.imgBoxW[href*='/video/detail?id=']").each((_, el) => {
    const href = String($(el).attr("href") || "").trim();
    if (!href) return;
    const text = [
      stripTags($(el).attr("title") || ""),
      stripTags($(el).find("img").attr("alt") || ""),
      stripTags($(el).find("img").attr("title") || ""),
      stripTags($(el).find("a").last().text()),
    ].join(" ");
    const hay = codeKey(text);
    if (!hay.includes(want)) return;
    let score = 10;
    if (hay.includes(want)) score += 20;
    if (new RegExp(std.replace(/-/g, "[-]?"), "i").test(text)) score += 30;
    if (score > bestScore) {
      bestScore = score;
      best = href;
    }
  });
  return best;
}

export function parseLulubarDetailHtml(
  html: string,
  detailUrl: string,
  code: string,
): ProviderResult | null {
  const std = stdCode(code);
  const want = codeKey(std);
  if (!html || html.length < 2000 || !want) return null;
  if (!codeKey(html).includes(want)) return null;

  const $ = cheerio.load(html);
  const h2 = $("#detail h2.mb-1").first().length ? $("#detail h2.mb-1").first() : $("h2.mb-1").first();
  h2.find("a.ogtag").remove();
  const h2Text = stripTags(h2.text());
  if (!h2Text || !codeKey(h2Text).includes(want)) return null;

  let title = h2Text
    .replace(new RegExp(`^${std.replace(/-/g, "[-]?")}\\s*[-|｜—]\\s*`, "i"), "")
    .trim();
  title = cleanTitle(title, std);
  if (isJunkTitle(title)) title = "";

  const metaBox = $("#detail .tag_box").first();
  const premiered =
    stripTags(metaBox.find("a.tag[href*='bydatedetail']").first().text()) ||
    html.match(/bydatedetail\?date=(\d{4}-\d{2}-\d{2})/i)?.[1] ||
    "";

  const actors = metaBox
    .find("a.tag[href*='bygirldetail']")
    .map((_, el) => stripTags($(el).text()))
    .get()
    .filter((n) => n && n.length >= 2 && n.length <= 24);
  const uniqActors = [...new Set(actors)].slice(0, 20);

  const studio =
    stripTags(metaBox.find("a.tag[title='片商']").first().text()) ||
    stripTags(metaBox.find("a.tag[href*='bysearch'][title='片商']").first().text()) ||
    undefined;

  const genres = metaBox
    .find("a.tag[href*='bytagdetail']")
    .map((_, el) => stripTags($(el).text()))
    .get()
    .filter((g) => g && g.length <= 40);
  const uniqGenres = [...new Set(genres)].slice(0, 40);

  let plot = stripTags($("#detail .video_container_info").first().text());
  if (plot.length < 12) {
    plot =
      stripTags($('meta[name="description"]').attr("content") || "") ||
      stripTags($('meta[property="og:description"]').attr("content") || "");
  }
  plot = plot.replace(new RegExp(`^${std.replace(/-/g, "[-]?")}\\s*[-|｜]?\\s*`, "i"), "").trim();

  let mosaic = "有码";
  if (metaBox.find("a.tag[href*='byunpix']").length) mosaic = "无码";
  else if (metaBox.find("a.tag[href*='bypixelization']").length) mosaic = "有码";

  let cover =
    normalizeCover($("#player").attr("data-poster"), detailUrl) ||
    normalizeCover(pickOgImage(html), detailUrl) ||
    normalizeCover(
      $("video[data-poster]").attr("data-poster") ||
        html.match(/data-poster=["']([^"']+)["']/i)?.[1],
      detailUrl,
    );
  if (!cover) {
    const img = html.match(/https?:\/\/image\.lulubar\.co\/films\/[^"'>\s]+\.(?:jpe?g|png|webp)/i)?.[0];
    cover = normalizeCover(img, detailUrl);
  }

  if (!title && !cover && !uniqActors.length) return null;

  return {
    source: "lulubar",
    fields: {
      title: title || undefined,
      titleZh: title || undefined,
      plot: plot || undefined,
      premiered: premiered || undefined,
      actors: uniqActors,
      genres: uniqGenres,
      studio,
      mosaic,
      website: detailUrl,
    },
    coverUrl: cover,
    ms: 0,
  };
}

async function scrapeLulubarDetail(code: string, signal?: AbortSignal): Promise<ProviderResult> {
  const started = Date.now();
  const std = stdCode(code);
  if (!std) {
    return { source: "lulubar", fields: {}, ms: Date.now() - started, error: "番号格式无效" };
  }

  const site = await prepareProviderFetch("lulubar", DEFAULT_BASE);
  const base = site.baseUrl.replace(/\/$/, "");
  if (!base) {
    return { source: "lulubar", fields: {}, ms: Date.now() - started, error: "未配置网站地址" };
  }

  const searchUrl = lulubarSearchUrl(base, std);
  const searchHtml = await fetchText(
    searchUrl,
    siteFetchOpts(site, { signal, referer: `${base}/`, timeoutMs: 60000 }),
  );
  const detailHref = pickLulubarDetailHref(searchHtml, std);
  if (!detailHref) {
    return { source: "lulubar", fields: {}, ms: Date.now() - started, error: "未找到" };
  }

  const detailUrl = absUrl(detailHref, base) || lulubarDetailUrl(base, detailHref.split("=").pop() || "");
  const detailHtml = await fetchText(
    detailUrl,
    siteFetchOpts(site, { signal, referer: searchUrl, timeoutMs: 60000 }),
  );
  const parsed = parseLulubarDetailHtml(detailHtml, detailUrl, std);
  if (!parsed?.fields.title && !parsed?.coverUrl) {
    return { source: "lulubar", fields: {}, ms: Date.now() - started, error: "解析失败" };
  }
  return { ...parsed, ms: Date.now() - started };
}

export const lulubarProvider: ScrapeProvider = {
  id: "lulubar",
  async scrape(ctx: ScrapeContext): Promise<ProviderResult | null> {
    try {
      return await scrapeLulubarDetail(ctx.code, ctx.signal);
    } catch (err) {
      return {
        source: "lulubar",
        fields: {},
        ms: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
