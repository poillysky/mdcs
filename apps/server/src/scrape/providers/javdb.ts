import * as cheerio from "cheerio";
import { fetchText } from "../network/fetch.js";
import {
  absUrl,
  cleanTitle,
  codeKey,
  collectByRe,
  isJunkCoverUrl,
  isJunkTitle,
  pageMentionsCode,
  stripTags,
} from "./htmlUtils.js";
import { prepareProviderFetch, siteFetchOpts } from "./providerSite.js";
import type { ProviderResult, ScrapeContext, ScrapeProvider } from "../types.js";

const DEFAULT_BASE = "https://javdb.com";

function panelValue($: cheerio.CheerioAPI, label: RegExp): { text: string; links: string[] } {
  let text = "";
  const links: string[] = [];
  $(".movie-panel-info .panel-block, .panel-block").each((_, el) => {
    const lab = stripTags($(el).find("strong").first().text());
    if (!label.test(lab)) return;
    const $val = $(el).find("span.value").first();
    $val.find("a").each((__, a) => {
      const n = stripTags($(a).text());
      if (n && n.length < 60 && !links.includes(n)) links.push(n);
    });
    text = stripTags($val.text() || $(el).text().replace(lab, ""));
  });
  return { text, links };
}

async function scrapeJavdbDetail(code: string, signal?: AbortSignal): Promise<ProviderResult> {
  const started = Date.now();
  const site = await prepareProviderFetch("javdb", DEFAULT_BASE);
  const base = site.baseUrl;
  if (!base) return { source: "javdb", fields: {}, ms: Date.now() - started, error: "未配置网站地址" };
  const searchUrl = `${base}/search?q=${encodeURIComponent(code.toUpperCase())}&f=all&locale=zh`;

  const search = await fetchText(
    searchUrl,
    siteFetchOpts(site, { signal, referer: `${base}/`, timeoutMs: 60000 }),
  );
  if (/banned your access|禁止了你的訪問|異常行為/i.test(search)) {
    return { source: "javdb", fields: {}, ms: Date.now() - started, error: "访问被禁止" };
  }

  const $s = cheerio.load(search);
  const want = codeKey(code);
  let detailPath = "";
  $s(".movie-list .item a.box, #videos a.box, a.box[href*='/v/']").each((_, el) => {
    if (detailPath) return;
    const href = String($s(el).attr("href") || "");
    if (!/\/v\//i.test(href)) return;
    const uid = stripTags(
      $s(el).find(".uid, .video-title strong, .id").first().text() ||
        $s(el).find(".video-title").first().text(),
    );
    const uidKey = codeKey(uid.split(/\s+/)[0] || uid);
    const titleText = stripTags($s(el).find(".video-title").text() || $s(el).text());
    if (uidKey === want || codeKey(titleText).startsWith(want)) detailPath = href;
  });

  if (!detailPath) {
    detailPath =
      search.match(
        new RegExp(`href=["'](/v/[^"']+)["'][^>]*>[\\s\\S]{0,400}?${code.replace(/-/g, "[-]?")}`, "i"),
      )?.[1] || "";
  }
  if (!detailPath) {
    return { source: "javdb", fields: {}, ms: Date.now() - started, error: "搜索无结果" };
  }

  const detailUrl = absUrl(detailPath, base);
  if (!detailUrl) {
    return { source: "javdb", fields: {}, ms: Date.now() - started, error: "详情链接无效" };
  }

  const html = await fetchText(
    detailUrl,
    siteFetchOpts(site, { signal, referer: searchUrl, timeoutMs: 60000 }),
  );
  if (/banned your access|禁止了你的訪問/i.test(html) || !pageMentionsCode(html, code)) {
    return { source: "javdb", fields: {}, ms: Date.now() - started, error: "详情页不可用" };
  }

  const $ = cheerio.load(html);
  let title = cleanTitle(
    $("strong.current-title").first().text() ||
      $("h2.title strong").first().text() ||
      $("title").first().text().replace(/\s*\|\s*JavDB.*$/i, ""),
    code,
  );
  title = title.replace(/\s*[|｜].*$/, "").replace(/\s*(中文字幕|无码流出|無碼流出)\s*$/i, "").trim();
  if (isJunkTitle(title)) title = "";

  const actors: string[] = [];
  const hasFemaleMarks = $("a[href*='/actors/'] + strong.female").length > 0;
  $("a[href*='/actors/']").each((_, el) => {
    const $a = $(el);
    const n = stripTags($a.text());
    if (!n || n.length < 2 || n.length > 40 || actors.includes(n)) return;
    const $next = $a.next("strong");
    if ($next.hasClass("male") && !$next.hasClass("female")) return;
    if (hasFemaleMarks && !$next.hasClass("female")) return;
    actors.push(n);
  });
  if (!actors.length) {
    for (const n of panelValue($, /演員|演员|Actor/).links) {
      if (n.length >= 2 && n.length <= 40 && !actors.includes(n)) actors.push(n);
    }
  }

  let cover =
    absUrl($("img.video-cover").attr("src"), base) ||
    absUrl($(".column-video-cover img").attr("src"), base) ||
    null;
  if (cover && isJunkCoverUrl(cover)) cover = null;

  const datePanel = panelValue($, /日期|Released Date|発売日/);
  const dm = datePanel.text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  const premiered = dm
    ? `${dm[1]}-${dm[2]!.padStart(2, "0")}-${dm[3]!.padStart(2, "0")}`
    : undefined;

  const runtimeRaw = panelValue($, /時長|时长|Duration|収録時間/).text;
  const runtime = Number(runtimeRaw.match(/(\d+)/)?.[1] || 0) || null;
  const publisher =
    panelValue($, /發行|发行|Publisher|レーベル/).links[0] ||
    panelValue($, /發行|发行|Publisher|レーベル/).text ||
    "";
  const maker =
    panelValue($, /片商|Maker|制作|製作|メーカー/).links[0] ||
    panelValue($, /片商|Maker|制作|製作|メーカー/).text ||
    "";
  const series =
    panelValue($, /系列|Series|シリーズ/).links[0] ||
    panelValue($, /系列|Series|シリーズ/).text ||
    "";

  const tagPanel = panelValue($, /類別|类别|Tags|タグ|标签/);
  const genres = [
    ...tagPanel.links,
    ...collectByRe(html, /href=["'][^"']*\/tags\?[^"']*["'][^>]*>([^<]+)</gi),
  ]
    .map((n) => n.trim())
    .filter((n) => n && n.length < 40)
    .filter((n, i, a) => a.indexOf(n) === i)
    .slice(0, 40);

  let plot = stripTags(
    $("meta[property='og:description']").attr("content") ||
      html.match(/property=["']og:description["']\s+content=["']([^"']+)["']/i)?.[1] ||
      "",
  );
  if (plot.length < 12 || isJunkTitle(plot) || plot === title) plot = "";

  const scoreRaw =
    stripTags($(".score").first().text()) ||
    html.match(/class=["']score["'][^>]*>[\s\S]*?(\d\.\d+)/i)?.[1] ||
    "";
  const scoreMatch = scoreRaw.match(/(\d\.\d+)/);
  const ratingValue = scoreMatch ? Number(scoreMatch[1]) : null;

  if (!title && !cover) {
    return { source: "javdb", fields: {}, ms: Date.now() - started, error: "无标题与封面" };
  }

  return {
    source: "javdb",
    fields: {
      title: title || undefined,
      plot: plot || undefined,
      actors: actors.slice(0, 20),
      genres,
      premiered,
      runtime: runtime && runtime > 0 ? runtime : null,
      studio: maker || undefined,
      publisher: publisher || undefined,
      series: series || undefined,
      ...(ratingValue != null && Number.isFinite(ratingValue)
        ? {
            ratingValue,
            ratingMax: 5,
            ratingSource: "javdb",
            score: ratingValue * 2,
          }
        : {}),
    },
    coverUrl: cover,
    ms: Date.now() - started,
  };
}

export const javdbProvider: ScrapeProvider = {
  id: "javdb",
  async scrape(ctx: ScrapeContext): Promise<ProviderResult | null> {
    try {
      return await scrapeJavdbDetail(ctx.code, ctx.signal);
    } catch (err) {
      return {
        source: "javdb",
        fields: {},
        ms: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
