import * as cheerio from "cheerio";
import { fetchText } from "../network/fetch.js";
import {
  absUrl,
  cleanTitle,
  isJunkCoverUrl,
  isJunkTitle,
  stripTags,
} from "./htmlUtils.js";
import { prepareProviderFetch, siteFetchOpts } from "./providerSite.js";
import type { ProviderResult, ScrapeContext, ScrapeProvider } from "../types.js";

const DEFAULT_BASE = "https://madou.club";

const GENRE_WORDS = new Set(
  [
    "口交", "后入", "骑乘位", "女上位", "白虎", "少妇", "巨乳", "美乳", "美臀", "黑丝", "丝袜",
    "调教", "自拍", "出轨", "人妻", "学生", "制服", "创意", "内射", "颜射", "中出", "无套",
    "潮吹", "剧情", "无码", "有码", "3P", "足交", "肛交", "群交", "露出", "偷拍", "约炮",
  ].map((s) => s.toLowerCase()),
);

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

function parseMadouDetail(html: string, detailUrl: string, code: string): ProviderResult | null {
  const $ = cheerio.load(html);
  const compact = madouCompact(code);
  let title = cleanTitle(
    $(".article-title, h1.article-title, h1").first().text() ||
      $("title").first().text().replace(/\s*[-|｜].*麻豆.*$/i, ""),
    code,
  );
  title = title
    .replace(new RegExp(`^${compact}\\s+`, "i"), "")
    .replace(new RegExp(`^${code}\\s+`, "i"), "")
    .replace(/\s*[-|｜]\s*麻豆社?\s*$/i, "")
    .trim();
  if (isJunkTitle(title)) title = "";

  const studio =
    stripTags($(".article-meta a[rel='category tag'], a[rel='category tag']").first().text()) ||
    undefined;

  const tags = $("a[rel='tag'], .article-tags a")
    .map((_, el) => stripTags($(el).text()))
    .get()
    .filter((n) => n && n.length < 40);

  const actors: string[] = [];
  const genres: string[] = [];
  for (const t of tags) {
    const key = t.toLowerCase();
    const asGenre =
      GENRE_WORDS.has(key) || /[a-z0-9]/i.test(t) || t.length > 3 || /丝|交|入|射|码|P$/i.test(t);
    if (asGenre) {
      if (!genres.includes(t)) genres.push(t);
    } else if (/^[\u4e00-\u9fff]{2,3}$/.test(t)) {
      if (!actors.includes(t)) actors.push(t);
    } else if (!genres.includes(t)) {
      genres.push(t);
    }
  }

  const coverCands: string[] = [];
  const pushCover = (raw: string | undefined | null) => {
    const u = absUrl(String(raw || "").trim(), detailUrl);
    if (u && /\/covers\//i.test(u) && !/avatar|logo/i.test(u)) coverCands.push(u);
  };
  $("img").each((_, el) => {
    pushCover($(el).attr("data-src"));
    pushCover($(el).attr("src"));
  });
  for (const m of html.matchAll(/https?:\/\/[^"'>\s]+\/covers\/[^"'>\s]+\.(?:jpe?g|png|webp)/gi)) {
    pushCover(m[0]);
  }
  let cover = coverCands.find((u) => !/-\d+x\d+\./i.test(u)) || coverCands[0] || null;
  if (cover && isJunkCoverUrl(cover)) cover = null;

  if (!title && !cover) return null;
  if (!pageHasCode(html, code) && !new RegExp(compact, "i").test(detailUrl) && !new RegExp(compact, "i").test(title)) {
    return null;
  }

  return {
    source: "madou",
    fields: {
      title: title || undefined,
      titleZh: title || undefined,
      actors: actors.slice(0, 20),
      genres: genres.slice(0, 40),
      studio,
    },
    coverUrl: cover,
    ms: 0,
  };
}

async function scrapeMadouDetail(code: string, signal?: AbortSignal): Promise<ProviderResult> {
  const started = Date.now();
  const std = madouStdCode(code);
  if (!std) {
    return { source: "madou", fields: {}, ms: Date.now() - started, error: "番号格式无效" };
  }
  const site = await prepareProviderFetch("madou", DEFAULT_BASE);
  const base = site.baseUrl;
  if (!base) return { source: "madou", fields: {}, ms: Date.now() - started, error: "未配置网站地址" };
  const compact = madouCompact(std);

  for (const q of [...new Set([compact, std])]) {
    const searchUrl = `${base}/?s=${encodeURIComponent(q)}`;
    const searchHtml = await fetchText(
      searchUrl,
      siteFetchOpts(site, { signal, referer: `${base}/`, timeoutMs: 25000 }),
    );
    if (
      /没有找到|未找到|Nothing Found/i.test(searchHtml) &&
      !pageHasCode(searchHtml, std)
    ) {
      continue;
    }

    const $s = cheerio.load(searchHtml);
    const want = compact.toLowerCase();
    let detailUrl = "";
    $s("h2 a, h3 a, .entry-title a, .article-title a").each((_, el) => {
      if (detailUrl) return;
      const href = String($s(el).attr("href") || "");
      const text = stripTags($s(el).text());
      if (`${href} ${text}`.toLowerCase().replace(/-/g, "").includes(want)) detailUrl = href;
    });
    if (!detailUrl) continue;

    const abs = absUrl(detailUrl, base);
    if (!abs) continue;
    const detailHtml = await fetchText(
      abs,
      siteFetchOpts(site, { signal, referer: searchUrl, timeoutMs: 25000 }),
    );
    const parsed = parseMadouDetail(detailHtml, abs, std);
    if (parsed?.fields.title || parsed?.coverUrl) {
      return { ...parsed, ms: Date.now() - started };
    }
  }
  return { source: "madou", fields: {}, ms: Date.now() - started, error: "未找到" };
}

export const madouProvider: ScrapeProvider = {
  id: "madou",
  async scrape(ctx: ScrapeContext): Promise<ProviderResult | null> {
    try {
      return await scrapeMadouDetail(ctx.code, ctx.signal);
    } catch (err) {
      return {
        source: "madou",
        fields: {},
        ms: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
