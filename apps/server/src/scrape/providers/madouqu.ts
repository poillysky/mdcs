import * as cheerio from "cheerio";
import { fetchText } from "../network/fetch.js";
import {
  absUrl,
  cleanTitle,
  isJunkCoverUrl,
  isJunkTitle,
  pickOgImage,
  pickOgTitle,
  stripTags,
} from "./htmlUtils.js";
import { prepareProviderFetch, siteFetchOpts } from "./providerSite.js";
import type { ProviderResult, ScrapeContext, ScrapeProvider } from "../types.js";

const DEFAULT_BASE = "https://madouqu.com";

function madouStdCode(raw: string): string {
  const s = String(raw || "").trim().toUpperCase().replace(/_/g, "-");
  if (!s) return "";
  if (!s.includes("-")) {
    const m = s.match(/^([A-Z]{1,12})(\d{2,}[A-Z0-9-]*)$/);
    if (m) return `${m[1]}-${m[2]}`;
  }
  return s;
}

function madouCompact(code: string): string {
  return String(code || "").replace(/-/g, "").toUpperCase();
}

function pageHasCode(html: string, code: string): boolean {
  const compact = madouCompact(code);
  if (new RegExp(compact, "i").test(html.slice(0, 12000))) return true;
  return new RegExp(code.replace(/-/g, "[-_]?"), "i").test(html.slice(0, 12000));
}

function parseMadouquDetail(html: string, detailUrl: string, code: string): ProviderResult | null {
  const $ = cheerio.load(html);
  const compact = madouCompact(code);
  if (!pageHasCode(html, code) && !new RegExp(compact, "i").test(detailUrl)) return null;

  let title = cleanTitle(
    $("h1.entry-title, h1").first().text() ||
      pickOgTitle(html) ||
      $("title").first().text().replace(/\s*[-|｜].*麻豆.*$/i, ""),
    code,
  );
  title = title
    .replace(new RegExp(`^${code}\\s*[!！]?\\s*`, "i"), "")
    .replace(new RegExp(`^${compact}\\s*[!！]?\\s*`, "i"), "")
    .replace(/\s*[-|｜]\s*麻豆区?\s*$/i, "")
    .trim();
  if (isJunkTitle(title) || /的搜索结果|Web server is returning/i.test(title)) title = "";

  const desc =
    $("meta[name='description']").attr("content") || $(".entry-content").first().text() || "";
  const actressRaw =
    desc.match(/麻豆女郎\s*[:：]\s*([^\n下载下載]{2,80})/i)?.[1] ||
    html.match(/麻豆女郎\s*[:：]\s*([^<"\n]{2,80})/i)?.[1] ||
    "";
  const actorsFromDesc = actressRaw
    .split(/[,，、\/|]/)
    .map((s) => stripTags(s))
    .filter((n) => n && n.length >= 2 && n.length <= 20);
  const actorsFromTags = $("a[rel='tag'], .entry-tags a")
    .map((_, el) => stripTags($(el).text()))
    .get()
    .filter((n) => n && n.length >= 2 && n.length <= 20);
  const actors = [...actorsFromDesc, ...actorsFromTags.filter((n) => !actorsFromDesc.includes(n))].slice(
    0,
    20,
  );

  let studio =
    stripTags(html.match(/分类\s*[:：]\s*([^<"\n{]{2,40})/i)?.[1] || "") ||
    stripTags($(".entry-meta a[rel='category tag'], a[rel='category tag']").first().text()) ||
    "";
  if (/madou/i.test(studio)) studio = studio.replace(/madou\s*/i, "").trim();

  let cover =
    pickOgImage(html) ||
    absUrl($(".entry-content img").first().attr("src") || $(".entry-content img").first().attr("data-src"), detailUrl);
  if (cover) {
    const jp = cover.match(/i\d\.wp\.com\/([^?]+)/i)?.[1];
    if (jp) cover = `https://${jp}`;
  }
  if (cover && isJunkCoverUrl(cover)) cover = null;

  let premiered = "";
  const dt = $("time[datetime]").attr("datetime") || "";
  const dm = String(dt).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dm) premiered = `${dm[1]}-${dm[2]}-${dm[3]}`;

  if (!title && !cover) return null;

  return {
    source: "madouqu",
    fields: {
      title: title || undefined,
      titleZh: title || undefined,
      actors,
      studio: studio || undefined,
      premiered: premiered || undefined,
    },
    coverUrl: cover,
    ms: 0,
  };
}

async function scrapeMadouquDetail(code: string, signal?: AbortSignal): Promise<ProviderResult> {
  const started = Date.now();
  const std = madouStdCode(code);
  if (!std) {
    return { source: "madouqu", fields: {}, ms: Date.now() - started, error: "番号格式无效" };
  }
  const site = await prepareProviderFetch("madouqu", DEFAULT_BASE);
  const base = site.baseUrl;
  if (!base) return { source: "madouqu", fields: {}, ms: Date.now() - started, error: "未配置网站地址" };
  const compact = madouCompact(std);
  const want = compact.toLowerCase();

  for (const q of [...new Set([std, compact])]) {
    const searchUrl = `${base}/?s=${encodeURIComponent(q)}`;
    const searchHtml = await fetchText(
      searchUrl,
      siteFetchOpts(site, { signal, referer: `${base}/`, timeoutMs: 25000 }),
    );
    const $s = cheerio.load(searchHtml);
    let detailUrl = "";
    $s("h2 a, h3 a, .entry-title a, .post-title a").each((_, el) => {
      if (detailUrl) return;
      const href = String($s(el).attr("href") || "");
      const text = stripTags($s(el).text());
      const idGuess = (text.split(/\s+/)[0] || "").replace(/-/g, "").toUpperCase();
      if (idGuess === compact) detailUrl = href;
    });
    if (!detailUrl) {
      $s("a[href*='/video/']").each((_, el) => {
        if (detailUrl) return;
        const href = String($s(el).attr("href") || "");
        const key = href.toLowerCase().replace(/-/g, "");
        if (key.includes(`/video/${want}/`) || key.includes(`/video/${std.toLowerCase()}/`)) detailUrl = href;
      });
    }
    if (!detailUrl) continue;
    const abs = absUrl(detailUrl, base);
    if (!abs) continue;
    const detailHtml = await fetchText(
      abs,
      siteFetchOpts(site, { signal, referer: searchUrl, timeoutMs: 25000 }),
    );
    const parsed = parseMadouquDetail(detailHtml, abs, std);
    if (parsed?.fields.title || parsed?.coverUrl) {
      return { ...parsed, ms: Date.now() - started };
    }
  }

  for (const slug of [...new Set([std.toLowerCase(), want])]) {
    const url = `${base}/video/${encodeURIComponent(slug)}/`;
    try {
      const detailHtml = await fetchText(
        url,
        siteFetchOpts(site, { signal, referer: `${base}/`, timeoutMs: 25000 }),
      );
      const parsed = parseMadouquDetail(detailHtml, url, std);
      if (parsed?.fields.title || parsed?.coverUrl) {
        return { ...parsed, ms: Date.now() - started };
      }
    } catch {
      /* try next slug */
    }
  }
  return { source: "madouqu", fields: {}, ms: Date.now() - started, error: "未找到" };
}

export const madouquProvider: ScrapeProvider = {
  id: "madouqu",
  async scrape(ctx: ScrapeContext): Promise<ProviderResult | null> {
    try {
      return await scrapeMadouquDetail(ctx.code, ctx.signal);
    } catch (err) {
      return {
        source: "madouqu",
        fields: {},
        ms: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
