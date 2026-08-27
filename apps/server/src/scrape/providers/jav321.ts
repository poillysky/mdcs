import * as cheerio from "cheerio";
import { probeImageUrl } from "../network/download.js";
import { fetchPostForm } from "../network/fetch.js";
import {
  absUrl,
  cleanTitle,
  collectByRe,
  isJunkCoverUrl,
  isJunkTitle,
  pageMentionsCode,
  pickOgImage,
  pickOgTitle,
  stdCode,
  stripTags,
} from "./htmlUtils.js";
import { validateDmmImageIfNeeded, type Jav321CheckUrlFn } from "./jav321DmmImages.js";
import { prepareProviderFetch, siteFetchOpts } from "./providerSite.js";
import type { ProviderResult, ScrapeContext, ScrapeProvider } from "../types.js";

const DEFAULT_BASE = "https://www.jav321.com";
const DMM_IMAGE_BAD = /now_printing|nowprinting|noimage|nopic|media_violation/i;

/** 对齐 MDCX check_url + DMM pl 体积过滤（见 dmm.ts probeDmmCovers） */
function createJav321ImageCheckUrl(referer: string, signal?: AbortSignal): Jav321CheckUrlFn {
  return async (url: string) => {
    if (signal?.aborted) return null;
    const probe = await probeImageUrl(url, { referer, timeoutMs: 8000 });
    if (!probe.ok) return null;
    const final = probe.finalUrl || url;
    if (DMM_IMAGE_BAD.test(final)) return null;
    if (probe.sizeHint > 0 && probe.sizeHint < 30000) return null;
    return final;
  };
}

function metaAfterBold($: cheerio.CheerioAPI, panel: ReturnType<cheerio.CheerioAPI>, lab: RegExp): string {
  let found = "";
  panel.find("b").each((_, el) => {
    const name = stripTags($(el).text());
    if (!lab.test(name)) return;
    let node: unknown = el.nextSibling;
    const parts: string[] = [];
    while (node) {
      const n = node as { type?: string; name?: string; data?: string; nextSibling?: unknown };
      if (n.type === "tag") {
        const tag = String(n.name || "").toLowerCase();
        if (tag === "br" || tag === "b") break;
        const text = stripTags($(node as never).text());
        if (text) parts.push(text);
      } else if (n.type === "text") {
        const text = stripTags(String(n.data || ""));
        if (text && text !== ":") parts.push(text.replace(/^[:：]\s*/, ""));
      }
      node = n.nextSibling;
    }
    found = parts.join(" ").replace(/^[:：]\s*/, "").trim();
  });
  return found;
}

/** 站点精简页无 /company/ 时，从特集 DMM 品牌链接『片商名』兜底 */
function studioFromTokushu(html: string): string | undefined {
  const m = html.match(/『([^』]{2,48})』/);
  const name = m?.[1]?.trim();
  if (!name || /最新作|セール|こちら/.test(name)) return undefined;
  return name;
}

/** 对齐 MDCX getScore：gif /10 或 `<b>平均評価</b>: 数字`（5 分制） */
export function parseJav321Rating(html: string, labelValue?: string): {
  ratingValue: number;
  ratingMax: number;
  score: number;
} | null {
  const gif = html.match(/<b>平均評価<\/b>:\s*<img[^>]+data-original=["']\/img\/(\d+)\.gif["']/i);
  if (gif) {
    const ratingValue = Number(gif[1]) / 10;
    if (Number.isFinite(ratingValue) && ratingValue > 0) {
      return { ratingValue, ratingMax: 5, score: ratingValue * 2 };
    }
  }

  const raw =
    labelValue?.trim() ||
    html.match(/<b>平均評価<\/b>:\s*([^<\n]+)/i)?.[1]?.trim() ||
    "";
  const num = Number(raw.match(/(\d+(?:\.\d+)?)/)?.[1]);
  if (!Number.isFinite(num) || num <= 0) return null;

  const ratingMax = num <= 5 ? 5 : 10;
  const score = ratingMax === 10 ? num : num * 2;
  return { ratingValue: num, ratingMax, score };
}

function normalizeCoverUrl(cover: string | null): string | null {
  if (!cover) return null;
  return cover.replace(/^http:\/\//i, "https://");
}

async function scrapeJav321Detail(code: string, signal?: AbortSignal): Promise<ProviderResult> {
  const started = Date.now();
  const site = await prepareProviderFetch("jav321", DEFAULT_BASE);
  const base = site.baseUrl;
  if (!base) return { source: "jav321", fields: {}, ms: Date.now() - started, error: "未配置网站地址" };
  const html = await fetchPostForm(
    `${base}/search`,
    `sn=${encodeURIComponent(code.toUpperCase())}`,
    siteFetchOpts(site, { signal, referer: `${base}/`, timeoutMs: 20000 }),
  );

  if (
    /AVが見つかりませんでした|還沒有人投稿|not found|找不到|没有找到/i.test(html) &&
    !/panel-info|og:title/i.test(html)
  ) {
    return { source: "jav321", fields: {}, ms: Date.now() - started, error: "未找到" };
  }
  if (!pageMentionsCode(html, code) && !/panel-info/i.test(html) && !pickOgTitle(html)) {
    return { source: "jav321", fields: {}, ms: Date.now() - started, error: "页面不匹配" };
  }

  const $ = cheerio.load(html);
  const panel = $(".panel-info").first();
  if (!panel.length) {
    return { source: "jav321", fields: {}, ms: Date.now() - started, error: "未找到" };
  }

  const std = stdCode(code);
  const snRaw = metaAfterBold($, panel, /品番|番號|番号|SN/i);
  const sn = stdCode(snRaw) || "";
  if (sn && sn !== std && sn.replace(/-/g, "") !== std.replace(/-/g, "")) {
    if (!pageMentionsCode(panel.html() || "", code)) {
      return { source: "jav321", fields: {}, ms: Date.now() - started, error: "番号不匹配" };
    }
  }

  let title = cleanTitle(
    panel.find(".panel-heading h3").first().clone().children("small").remove().end().text() ||
      panel.find("h3").first().text() ||
      pickOgTitle(html),
    code,
  );
  title = title
    .replace(/\s*bittorrent\s*Download\s*dmm\s*$/i, "")
    .replace(new RegExp(`\\b${std.replace(/[-]/g, "[-_]?")}\\b`, "i"), "")
    .replace(/\s+/g, " ")
    .trim();
  if (isJunkTitle(title)) title = "";

  const panelHtml = panel.html() || "";
  const actors = collectByRe(panelHtml, /href=["'][^"']*\/star\/[^"']+["'][^>]*>([^<]+)</gi).filter(
    (n) => n.length < 40,
  );
  let studio: string | undefined =
    collectByRe(panelHtml, /href=["'][^"']*\/company\/[^"']+["'][^>]*>([^<]+)</gi)[0] ||
    metaAfterBold($, panel, /メーカー|片商|Maker/i) ||
    studioFromTokushu(panelHtml) ||
    undefined;
  studio = studio?.trim() || undefined;
  const genres = collectByRe(panelHtml, /href=["'][^"']*\/genre\/[^"']+["'][^>]*>([^<]+)</gi)
    .filter((n) => n.length < 40 && !/ジャンル|类别|類型/i.test(n))
    .slice(0, 40);
  const series =
    collectByRe(panel.html() || "", /href=["'][^"']*\/series\/\d+[^"']*["'][^>]*>([^<]+)</gi)[0] ||
    metaAfterBold($, panel, /シリーズ|系列|Series/i);

  const dateRaw = metaAfterBold($, panel, /配信開始日|發行日期|发行日期|Release\s*Date|発売日/i);
  const dm = dateRaw.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  const premiered = dm
    ? `${dm[1]}-${dm[2]!.padStart(2, "0")}-${dm[3]!.padStart(2, "0")}`
    : undefined;

  const runtimeRaw = metaAfterBold($, panel, /収録時間|播放時長|播放时长|Play\s*time|Runtime/i);
  const runtime = Number(runtimeRaw.match(/(\d+)\s*(?:minutes?|分|分钟|分鐘)?/i)?.[1] || 0) || null;

  const ratingRaw = metaAfterBold($, panel, /平均評価|平均评分|Average\s*Rating/i);
  const rating = parseJav321Rating(html, ratingRaw);

  let plot = "";
  panel.find(".row .col-md-12").each((_, el) => {
    const $el = $(el);
    if ($el.find("video,img").length) return;
    const clone = $el.clone();
    clone.find("script,h2,ul,p.mg-t6").remove();
    let t = stripTags(clone.text())
      .replace(/※\s*配信方法によって[\s\S]*$/i, "")
      .replace(/特集[\s\S]*$/i, "")
      .replace(/(?:（\d+）[^\s（]{0,40}\s*)+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (t.length < 20) return;
    if (t.length > plot.length) plot = t;
  });
  if (plot.length < 20 || isJunkTitle(plot)) plot = "";

  const tidyUrl = (u: string) => u.replace(/^(https?:)\/+/i, "$1//").replace(/([^:/])\/{2,}/g, "$1/");
  let cover: string | null = null;
  const posterAttr =
    panel.find("video[poster]").attr("poster") ||
    html.match(/poster=["']([^"']+pl\.jpg[^"']*)["']/i)?.[1] ||
    "";
  const panelImg =
    panel.find(".col-md-3 img.img-responsive").first().attr("src") ||
    panel.find("img.img-responsive").first().attr("src") ||
    "";
  if (posterAttr) cover = absUrl(tidyUrl(posterAttr), base);
  if (!cover && panelImg) cover = absUrl(tidyUrl(panelImg), base);
  if (!cover) {
    const og = pickOgImage(html);
    if (og) cover = absUrl(tidyUrl(og), base);
  }
  if (cover && /ps\.jpg/i.test(cover)) cover = cover.replace(/ps\.jpg/i, "pl.jpg");
  if (cover && isJunkCoverUrl(cover)) cover = null;
  if (cover) {
    const validated = await validateDmmImageIfNeeded(
      cover,
      "thumb",
      createJav321ImageCheckUrl(`${base}/`, signal),
    );
    cover = validated || null;
  }
  cover = normalizeCoverUrl(cover);

  if (!title) {
    return { source: "jav321", fields: {}, coverUrl: cover, ms: Date.now() - started, error: "未找到标题" };
  }

  return {
    source: "jav321",
    fields: {
      title,
      plot: plot || undefined,
      studio: studio || undefined,
      series: series || undefined,
      actors,
      genres,
      premiered,
      runtime,
      ...(rating
        ? {
            ratingValue: rating.ratingValue,
            ratingMax: rating.ratingMax,
            ratingSource: "jav321",
            score: rating.score,
          }
        : {}),
    },
    coverUrl: cover,
    ms: Date.now() - started,
  };
}

export const jav321Provider: ScrapeProvider = {
  id: "jav321",
  async scrape(ctx: ScrapeContext): Promise<ProviderResult | null> {
    try {
      return await scrapeJav321Detail(ctx.code, ctx.signal);
    } catch (err) {
      return {
        source: "jav321",
        fields: {},
        ms: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
