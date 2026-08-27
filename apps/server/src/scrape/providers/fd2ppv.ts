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

const DEFAULT_BASE = "https://fd2ppv.cc";

function parseFc2Id(code: string): { id: string; displayCode: string } | null {
  const m = code.match(/FC2[-_]?PPV[-_]?(\d+)/i) || code.match(/FC2[-_]?(\d+)/i);
  if (!m) return null;
  const id = m[1]!;
  return { id, displayCode: `FC2-PPV-${id}` };
}

async function scrapeFd2ppvDetail(code: string, signal?: AbortSignal): Promise<ProviderResult> {
  const started = Date.now();
  const parsed = parseFc2Id(code);
  if (!parsed) {
    return { source: "fd2ppv", fields: {}, ms: Date.now() - started, error: "番号格式无效" };
  }
  const { id, displayCode } = parsed;
  const site = await prepareProviderFetch("fd2ppv", DEFAULT_BASE);
  const base = site.baseUrl;
  if (!base) return { source: "fd2ppv", fields: {}, ms: Date.now() - started, error: "未配置网站地址" };
  // 详情页才出 CF；过盾后凭证缓存在 cf-clearance.json，由 fetchPage 复用 Flare session/cookie
  const url = `${base}/articles/${id}`;
  const html = await fetchText(
    url,
    siteFetchOpts(site, { signal, referer: `${base}/`, timeoutMs: 45000 }),
  );

  if (
    /Too many requests|Just a moment|cf-browser-verification/i.test(html) &&
    html.length < 8000
  ) {
    return { source: "fd2ppv", fields: {}, ms: Date.now() - started, error: "访问被限制" };
  }
  if (/作品が見つかりません|ページが見つかりません|404 Page Not Found/i.test(html)) {
    return { source: "fd2ppv", fields: {}, ms: Date.now() - started, error: "未找到" };
  }

  const $ = cheerio.load(html);
  let title = cleanTitle(
    $(".work-brief").first().text() ||
      $("meta[name='description']").attr("content") ||
      pickOgTitle(html) ||
      $("title").first().text(),
    displayCode,
  );
  title = title
    .replace(new RegExp(`^FC2[-_]?PPV[-_]?${id}\\s*[-–—:]?\\s*`, "i"), "")
    .replace(/\s*[|｜].*$/, "")
    .trim();
  if (!title || /^\d{5,}$/.test(title) || isJunkTitle(title)) title = "";

  const metaVal = (label: RegExp): string => {
    let found = "";
    $(".work-meta-label").each((_, el) => {
      const lab = stripTags($(el).text());
      if (!label.test(lab)) return;
      found = stripTags($(el).nextAll(".work-meta-value").first().text());
    });
    return found;
  };

  const premieredRaw = metaVal(/配信日|販売日|公開日/);
  let premiered = "";
  const dm = premieredRaw.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (dm) premiered = `${dm[1]}-${dm[2]!.padStart(2, "0")}-${dm[3]!.padStart(2, "0")}`;

  const runtimeRaw = metaVal(/収録時間|再生時間/);
  let runtime: number | null = null;
  const hm = runtimeRaw.match(/(?:(\d+):)?(\d{1,2}):(\d{2})/);
  if (hm) {
    runtime = Number(hm[1] || 0) * 60 + Number(hm[2] || 0) || null;
  } else {
    const mins = runtimeRaw.match(/(\d+)\s*分/);
    if (mins) runtime = Number(mins[1]) || null;
  }

  const seller = metaVal(/販売者|作者|投稿者/) || "";
  const studio = seller || metaVal(/配信元/) || "FC2";

  const genres: string[] = [];
  $(".work-tags a").each((_, el) => {
    const n = stripTags($(el).text());
    if (!n || n.length > 40 || /タグ|tag/i.test(n) || genres.includes(n)) return;
    genres.push(n);
  });
  // 站内常把体型/属性挂在 /tags/actresses/…（非女优页）
  $('a[href*="/tags/actresses/"]').each((_, el) => {
    const n = stripTags($(el).text());
    if (!n || n.length > 40 || /AV女優|女優|タグ/i.test(n) || genres.includes(n)) return;
    genres.push(n);
  });
  const cat = metaVal(/カテゴリ/);
  if (cat && !genres.includes(cat)) genres.unshift(cat);

  const actors: string[] = [];
  // 仅数字 id 女优页；排除 /tags/actresses/
  $('a[href*="/actresses/"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    if (/\/tags\/actresses\//i.test(href) || !/\/actresses\/\d+/i.test(href)) return;
    const n = stripTags($(el).text());
    if (!n || n.length > 40 || /AV女優|女優/i.test(n) || actors.includes(n)) return;
    actors.push(n);
  });

  const photoBlock =
    html.match(/class=["'][^"']*work-original-photos[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ||
    html.match(/class=["'][^"']*work-photos[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ||
    "";
  const photos = [...photoBlock.matchAll(/(https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|avif))/gi)].map(
    (x) => x[1]!,
  );
  let cover = photos[0] || pickOgImage(html) || null;
  if (cover) cover = absUrl(cover, url);
  if (cover && isJunkCoverUrl(cover)) cover = null;

  if (!title && !cover) {
    return { source: "fd2ppv", fields: {}, ms: Date.now() - started, error: "无标题与封面" };
  }

  return {
    source: "fd2ppv",
    fields: {
      title: title || undefined,
      genres: genres.slice(0, 40),
      actors: actors.slice(0, 20),
      studio,
      publisher: studio,
      premiered: premiered || undefined,
      runtime: runtime && runtime > 0 ? runtime : null,
      website: url,
    },
    coverUrl: cover,
    alternateCoverUrls: photos.slice(1, 8).map((p) => absUrl(p, url)!).filter(Boolean),
    ms: Date.now() - started,
  };
}

export const fd2ppvProvider: ScrapeProvider = {
  id: "fd2ppv",
  async scrape(ctx: ScrapeContext): Promise<ProviderResult | null> {
    try {
      return await scrapeFd2ppvDetail(ctx.code, ctx.signal);
    } catch (err) {
      return {
        source: "fd2ppv",
        fields: {},
        ms: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
