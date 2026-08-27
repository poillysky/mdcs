import * as cheerio from "cheerio";
import { fetchText } from "../network/fetch.js";
import { absUrl, cleanTitle, isJunkCoverUrl, isJunkTitle, pickOgImage, pickOgTitle, stripTags } from "./htmlUtils.js";
import { prepareProviderFetch, siteFetchOpts } from "./providerSite.js";
import type { ProviderResult, ScrapeContext, ScrapeProvider } from "../types.js";

const DEFAULT_BASE = "https://xchina.co";

function normalizeCode(raw: string): string {
  return String(raw || "").trim().toUpperCase().replace(/_/g, "-");
}

function compactCode(raw: string): string {
  return normalizeCode(raw).replace(/[^A-Z0-9]/g, "");
}

function buildSearchCandidates(code: string): string[] {
  const norm = normalizeCode(code);
  const compact = compactCode(code);
  const m = norm.match(/^([A-Z]{2,10})-?(\d{2,6}(?:-\d+)?)$/);
  const out = new Set<string>([norm, compact]);
  if (m) {
    out.add(`${m[1]}-${m[2]}`);
    out.add(`${m[1]}${m[2]}`);
  }
  return [...out].filter(Boolean);
}

/** schema.org duration：PT27M51S → 分钟 */
export function parseXhsIsoDuration(raw: string): number | undefined {
  const t = String(raw || "").trim().replace(/^P/i, "");
  const m = t.match(/^T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
  if (!m) return undefined;
  const sec = Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
  return sec > 0 ? Math.max(1, Math.round(sec / 60)) : undefined;
}

function parseClockRuntime(raw: string): number | undefined {
  const t = String(raw || "").trim();
  const m = t.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (!m) return undefined;
  const sec = m[3]
    ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
    : Number(m[1]) * 60 + Number(m[2]);
  return sec > 0 ? Math.max(1, Math.round(sec / 60)) : undefined;
}

type SearchHit = {
  detailUrl: string;
  title: string;
  coverUrl: string | null;
  actors: string[];
  studio: string;
  runtime: number | undefined;
};

export function parseXhsSearchHit(html: string, code: string, baseUrl: string): SearchHit | null {
  const $ = cheerio.load(html);
  const want = compactCode(code);
  let hit: SearchHit | null = null;
  $(".item.video").each((_, el) => {
    if (hit) return;
    const $el = $(el);
    const a = $el.find('a[href*="/video/id-"]').first();
    const href = String(a.attr("href") || "").trim();
    if (!href) return;
    const hay = compactCode(`${$el.text()} ${a.attr("title") || ""} ${href}`);
    if (want && !hay.includes(want)) return;
    const bg = String($el.find(".img").attr("style") || "");
    const coverM = bg.match(/url\(['"]?([^'")]+)['"]?\)/i);
    const cover = absUrl(coverM?.[1] || "", baseUrl);
    const actors = $el
      .find("a.model-item")
      .map((__, m) => stripTags($(m).text()))
      .get()
      .filter((n) => n && n.length >= 2 && n.length <= 20);
    const tagTexts = $el
      .find(".tags > div")
      .map((__, t) => stripTags($(t).text()))
      .get()
      .filter(Boolean);
    const studio = tagTexts.find((t) => t !== compactCode(code) && !/^\d+:\d{2}/.test(t) && compactCode(t) !== want) || "";
    const clock = tagTexts.find((t) => /^\d+:\d{2}/.test(t));
    hit = {
      detailUrl: absUrl(href, baseUrl) || href,
      title: stripTags(a.attr("title") || $el.find(".title a").first().text()),
      coverUrl: cover && !isJunkCoverUrl(cover) ? cover : null,
      actors,
      studio,
      runtime: clock ? parseClockRuntime(clock) : undefined,
    };
  });
  return hit;
}

function parseLdVideo(html: string): Record<string, unknown> | null {
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1] || "");
      const arr = Array.isArray(data) ? data : [data];
      const vo = arr.find((x) => x && typeof x === "object" && (x as { "@type"?: string })["@type"] === "VideoObject");
      if (vo && typeof vo === "object") return vo as Record<string, unknown>;
    } catch {
      /* next block */
    }
  }
  return null;
}

export function parseXhsDetail(html: string, detailUrl: string, code: string): Omit<ProviderResult, "source" | "ms"> | null {
  const $ = cheerio.load(html);
  const ld = parseLdVideo(html);
  const compact = compactCode(code);

  let title = stripTags($("h1.hero-title-item").first().text()) || pickOgTitle(html) || "";
  title = title.replace(/（[^）]*）/g, "").replace(/\([^)]*\)/g, "").trim();
  if (ld?.name) title = stripTags(String(ld.name));
  title = cleanTitle(title, code).replace(new RegExp(`^${compact}\\s*`, "i"), "").trim();
  if (isJunkTitle(title)) title = "";

  const actors: string[] = [];
  const ldActors = ld?.actor;
  const actorList = Array.isArray(ldActors) ? ldActors : ldActors ? [ldActors] : [];
  for (const a of actorList) {
    const n = typeof a === "object" && a ? stripTags(String((a as { name?: string }).name || "")) : "";
    if (n && n.length >= 2 && n.length <= 20 && !actors.includes(n)) actors.push(n);
  }
  $("a.model-item, .model-container a[href*='/model/']").each((_, el) => {
    const n = stripTags($(el).text());
    if (n && n.length >= 2 && n.length <= 20 && !actors.includes(n)) actors.push(n);
  });

  let studio = "";
  $(".info-card.video-detail a[href*='/videos/series-']").each((_, el) => {
    const n = stripTags($(el).text());
    if (n && !/^中文AV$/i.test(n)) studio = n;
  });
  if (!studio) {
    const crumbs = $(".breadcrumb a[href*='/videos/series-']")
      .map((_, el) => stripTags($(el).text()))
      .get()
      .filter(Boolean);
    studio = crumbs.filter((n) => !/^中文AV$/i.test(n)).pop() || crumbs.pop() || "";
  }

  let premiered = "";
  const upload = String(ld?.uploadDate || "");
  const dm = upload.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dm) premiered = `${dm[1]}-${dm[2]}-${dm[3]}`;

  const runtime =
    parseXhsIsoDuration(String(ld?.duration || "")) ||
    parseClockRuntime($(".info-card.video-detail .fa-clock").parent().text());

  let cover =
    (typeof ld?.thumbnailUrl === "string" ? ld.thumbnailUrl : "") ||
    pickOgImage(html) ||
    absUrl($("meta[property='og:image']").attr("content"), detailUrl);
  if (cover && isJunkCoverUrl(cover)) cover = null;

  if (!title && !cover) return null;

  return {
    fields: {
      title: title || undefined,
      titleZh: title || undefined,
      actors,
      studio: studio || undefined,
      premiered: premiered || undefined,
      runtime: runtime ?? undefined,
      website: detailUrl,
    },
    coverUrl: cover || null,
  };
}

async function scrapeXhs(code: string, signal?: AbortSignal): Promise<ProviderResult> {
  const started = Date.now();
  const site = await prepareProviderFetch("xiao_huang_shu", DEFAULT_BASE);
  const base = site.baseUrl || DEFAULT_BASE;

  for (const q of buildSearchCandidates(code)) {
    const searchUrls = [
      `${base}/search.html?keyword=${encodeURIComponent(q)}`,
      `${base}/videos/keyword-${encodeURIComponent(q)}.html`,
    ];
    for (const searchUrl of searchUrls) {
      const searchHtml = await fetchText(
        searchUrl,
        siteFetchOpts(site, { signal, referer: `${base}/`, timeoutMs: 25000 }),
      );
      const hit = parseXhsSearchHit(searchHtml, code, base);
      if (!hit?.detailUrl) continue;

      let parsed: Omit<ProviderResult, "source" | "ms"> | null = null;
      try {
        const detailHtml = await fetchText(
          hit.detailUrl,
          siteFetchOpts(site, { signal, referer: searchUrl, timeoutMs: 25000 }),
        );
        parsed = parseXhsDetail(detailHtml, hit.detailUrl, code);
      } catch {
        parsed = null;
      }

      const title = parsed?.fields.title || hit.title;
      const coverUrl = parsed?.coverUrl || hit.coverUrl;
      if (!title && !coverUrl) continue;

      return {
        source: "xiao_huang_shu",
        fields: {
          title: title || undefined,
          titleZh: title || undefined,
          actors: parsed?.fields.actors?.length ? parsed.fields.actors : hit.actors,
          studio: parsed?.fields.studio || hit.studio || undefined,
          premiered: parsed?.fields.premiered,
          runtime: parsed?.fields.runtime ?? hit.runtime,
          website: hit.detailUrl,
        },
        coverUrl,
        ms: Date.now() - started,
      };
    }
  }

  return { source: "xiao_huang_shu", fields: {}, ms: Date.now() - started, error: "未找到" };
}

export const xiaoHuangShuProvider: ScrapeProvider = {
  id: "xiao_huang_shu",
  async scrape(ctx: ScrapeContext): Promise<ProviderResult | null> {
    try {
      return await scrapeXhs(ctx.code, ctx.signal);
    } catch (err) {
      return {
        source: "xiao_huang_shu",
        fields: {},
        ms: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
