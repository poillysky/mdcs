import * as cheerio from "cheerio";
import { fetchText } from "../network/fetch.js";
import {
  absUrl,
  cleanTitle,
  isJunkCoverUrl,
  isJunkTitle,
  pickOgImage,
  pickOgTitle,
  pickTwitterImage,
  stripTags,
} from "./htmlUtils.js";
import { prepareProviderFetch, siteFetchOpts } from "./providerSite.js";
import type { ProviderResult, ScrapeContext, ScrapeProvider } from "../types.js";

const DEFAULT_BASE = "https://adult.contents.fc2.com";

function parseFc2Id(code: string): { id: string; displayCode: string } | null {
  const m = code.match(/FC2[-_]?PPV[-_]?(\d+)/i) || code.match(/FC2[-_]?(\d+)/i);
  if (!m) return null;
  const id = m[1]!;
  return { id, displayCode: `FC2-PPV-${id}` };
}

export { parseFc2Id };

const PREMIERED_RE =
  /(?:販売日|販売開始日|上架时间|登録日|発売日|销售日期)\s*[:：]?\s*([0-9]{4})[/-]([0-9]{1,2})[/-]([0-9]{1,2})/i;

function formatPremiered(y: string, m: string, d: string): string {
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/** 販売日 / 上架时间 等多标签日期 */
export function parseFc2Premiered(html: string): string | undefined {
  const $ = cheerio.load(html);
  const blocks = [
    $(".items_article_headerInfo").text(),
    $(".items_article_softDevice").text(),
    $("body").text(),
  ];
  for (const text of blocks) {
    const m = String(text).match(PREMIERED_RE);
    if (m) return formatPremiered(m[1]!, m[2]!, m[3]!);
  }
  return undefined;
}

/** items_article_info 时长（MM:SS / H:MM:SS / N分）→ 分钟 */
export function parseFc2Runtime(html: string): number | undefined {
  const $ = cheerio.load(html);
  const raw = stripTags($("p.items_article_info, .items_article_info").first().text());
  const t = raw.trim();
  if (!t) return undefined;
  const hms = t.match(/^(\d+):(\d{2}):(\d{2})$/);
  if (hms) {
    return Math.round(Number(hms[1]) * 60 + Number(hms[2]) + Number(hms[3]) / 60);
  }
  const ms = t.match(/^(\d+):(\d{2})$/);
  if (ms) return Math.round(Number(ms[1]) + Number(ms[2]) / 60);
  const min = t.match(/(\d+)\s*分/);
  if (min) return Number(min[1]);
  return undefined;
}

type Fc2LdProduct = {
  description?: string;
  ratingValue?: number;
  ratingMax?: number;
  votes?: string;
};

function parseFc2LdProduct(html: string): Fc2LdProduct {
  const out: Fc2LdProduct = {};
  for (const block of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const data = JSON.parse(block[1] || "");
      for (const item of Array.isArray(data) ? data : [data]) {
        if (!item || typeof item !== "object") continue;
        if (String(item["@type"] || "") !== "Product") continue;
        const desc = String(item.description || "").trim();
        if (desc.length >= 12 && !isJunkTitle(desc)) out.description = desc;
        const rating = item.aggregateRating;
        if (rating && typeof rating === "object") {
          const val = Number(rating.ratingValue);
          const max = Number(rating.bestRating) || 5;
          const count = rating.reviewCount ?? rating.ratingCount;
          if (Number.isFinite(val)) {
            out.ratingValue = val;
            out.ratingMax = max;
          }
          if (count != null && String(count).trim()) out.votes = String(count);
        }
      }
    } catch {
      /* ignore malformed JSON-LD */
    }
  }
  return out;
}

function parseFc2LdImage(html: string): string | null {
  for (const block of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const data = JSON.parse(block[1] || "");
      for (const item of Array.isArray(data) ? data : [data]) {
        if (!item || typeof item !== "object") continue;
        if (String(item["@type"] || "") !== "Product") continue;
        const img = item.image;
        if (typeof img === "string" && img.trim()) return img.trim();
        if (Array.isArray(img)) {
          for (const entry of img) {
            if (typeof entry === "string" && entry.trim()) return entry.trim();
            if (entry && typeof entry === "object" && typeof entry.url === "string") {
              return entry.url.trim();
            }
          }
        }
        if (img && typeof img === "object" && typeof img.url === "string") {
          return img.url.trim();
        }
      }
    } catch {
      /* ignore malformed JSON-LD */
    }
  }
  return null;
}

export function parseFc2Cover(html: string, pageUrl: string): string | null {
  const $ = cheerio.load(html);
  let cover =
    pickOgImage(html) ||
    pickTwitterImage(html) ||
    parseFc2LdImage(html) ||
    $(".items_article_MainitemThumb img").attr("src") ||
    $(".items_article_MainitemThumb img").attr("data-src") ||
    $(".items_article_MainitemThumb img").attr("data-original") ||
    null;
  if (cover) cover = absUrl(cover, pageUrl) || cover;
  if (cover && isJunkCoverUrl(cover)) cover = null;
  return cover;
}

export function parseFc2DetailHtml(html: string, pageUrl: string, code: string): ProviderResult | null {  const parsed = parseFc2Id(code);
  if (!parsed) return null;
  const { id, displayCode } = parsed;

  if (/未找到您要找的商品|お探しの商品は見つかりません|販売を終了/i.test(html)) {
    return null;
  }

  const $ = cheerio.load(html);
  let title = cleanTitle(
    pickOgTitle(html) ||
      $("meta[property='og:title']").attr("content") ||
      $("h2.items_article_Title, .items_article_headerInfo h2, h1").first().text(),
    displayCode,
  );
  title = title.replace(new RegExp(`^FC2[-_]?PPV[-_]?${id}\\s*[-–—:]?\\s*`, "i"), "").trim();
  if (!title || isJunkTitle(title)) return null;

  const cover = parseFc2Cover(html, pageUrl);

  const genres: string[] = [];
  $(".items_article_TagArea a, a.tagTag[href*='tag'], a[href*='tag=']").each((_, el) => {
    const n = stripTags(String($(el).attr("data-tag") || $(el).text()));
    if (!n || n.length > 40 || /もっと見る|タグ|ジャンル|商品标签|FC2/i.test(n) || genres.includes(n)) return;
    genres.push(n);
  });

  const seller =
    stripTags($('.items_article_writer a[href*="/users/"]').first().text() || "") ||
    stripTags($('.items_article_headerInfo a[href*="/users/"]').first().text() || "") ||
    "FC2";

  const premiered = parseFc2Premiered(html);
  const runtime = parseFc2Runtime(html);
  const ld = parseFc2LdProduct(html);

  let plot = stripTags($("meta[property='og:description']").attr("content") || "");
  if ((!plot || plot.length < 12 || isJunkTitle(plot)) && ld.description) plot = ld.description;
  if (plot.length < 12 || isJunkTitle(plot)) plot = "";

  const trailerUrl =
    $("meta[property='og:video']").attr("content")?.trim() ||
    $("meta[name='twitter:player']").attr("content")?.trim() ||
    undefined;
  const website =
    $("meta[property='og:url']").attr("content")?.trim() || pageUrl;

  const fields: ProviderResult["fields"] = {
    title,
    plot: plot || undefined,
    genres: genres.slice(0, 40),
    studio: seller,
    premiered,
    runtime,
    trailerUrl,
    website,
    actors: [],
  };

  if (ld.ratingValue != null && Number.isFinite(ld.ratingValue)) {
    const max = ld.ratingMax && ld.ratingMax > 0 ? ld.ratingMax : 5;
    fields.ratingValue = ld.ratingValue;
    fields.ratingMax = max;
    fields.ratingSource = "fc2";
    fields.score = (ld.ratingValue / max) * 10;
    if (ld.votes) fields.votes = ld.votes;
  }

  return {
    source: "fc2",
    fields,
    coverUrl: cover,
    ms: 0,
  };
}
async function scrapeFc2Detail(code: string, signal?: AbortSignal): Promise<ProviderResult> {
  const started = Date.now();
  const parsed = parseFc2Id(code);
  if (!parsed) {
    return { source: "fc2", fields: {}, ms: Date.now() - started, error: "番号格式无效" };
  }
  const { id } = parsed;
  const site = await prepareProviderFetch("fc2", DEFAULT_BASE);
  const base = site.baseUrl;
  if (!base) return { source: "fc2", fields: {}, ms: Date.now() - started, error: "未配置网站地址" };
  const url = `${base}/article/${id}/`;
  const html = await fetchText(
    url,
    siteFetchOpts(site, { signal, referer: `${base}/`, timeoutMs: 28000 }),
  );

  const result = parseFc2DetailHtml(html, url, code);
  if (!result) {
    return { source: "fc2", fields: {}, ms: Date.now() - started, error: "未找到" };
  }
  return { ...result, ms: Date.now() - started };
}

export const fc2Provider: ScrapeProvider = {
  id: "fc2",
  async scrape(ctx: ScrapeContext): Promise<ProviderResult | null> {
    try {
      return await scrapeFc2Detail(ctx.code, ctx.signal);
    } catch (err) {
      return {
        source: "fc2",
        fields: {},
        ms: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
