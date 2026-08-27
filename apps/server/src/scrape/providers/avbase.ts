import { absUrl, cleanTitle, isJunkCoverUrl, stdCode } from "./htmlUtils.js";
import { fetchPageForSite, prepareProviderFetch, siteFetchOpts } from "./providerSite.js";
import type { ProviderResult, ScrapeContext, ScrapeProvider } from "../types.js";

const DEFAULT_BASE = "https://www.avbase.net";

type AvbaseProduct = {
  product_id?: string;
  image_url?: string;
  thumbnail_url?: string;
  title?: string;
  source?: string;
  date?: string;
  maker?: { name?: string };
  label?: { name?: string };
  series?: { name?: string };
  sample_image_urls?: Array<{ s?: string; l?: string }>;
  sample_movie_url?: string;
  iteminfo?: {
    director?: string;
    volume?: string;
    description?: string;
  };
};

export type AvbaseWork = {
  work_id?: string;
  title?: string;
  min_date?: string;
  casts?: Array<{ actor?: { name?: string; order?: number } }>;
  actors?: Array<{ name?: string; order?: number }>;
  genres?: Array<{ name?: string } | string>;
  products?: AvbaseProduct[];
};

/** 对齐 MDCX：演员名后的序号（1/2/3）勿当作人名 */
export function isAvbaseActorName(name: string): boolean {
  const t = String(name || "").trim();
  if (!t || t.length > 40) return false;
  if (/^\d+$/.test(t)) return false;
  return true;
}

export function matchAvbaseWorkId(workId: string, code: string): boolean {
  const a = String(workId || "").trim().toUpperCase();
  const b = stdCode(code).toUpperCase();
  return Boolean(a && b && a === b);
}

export function parseAvbaseNextData(html: string): Record<string, unknown> | null {
  const raw = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i)?.[1];
  if (!raw) return null;
  try {
    return JSON.parse(raw.trim()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function parseAvbaseDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return undefined;
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function stripAvbaseDescription(raw?: string): string {
  if (!raw) return "";
  return raw
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/…+$/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeAvbaseCover(url: string | undefined): string | null {
  if (!url) return null;
  let u = url.replace(/^http:\/\//i, "https://");
  u = u.replace(/(\d)(ps|pt)\.jpg$/i, "$1pl.jpg");
  return u;
}

export function pickAvbaseProduct(products: AvbaseProduct[] | undefined): AvbaseProduct | undefined {
  if (!products?.length) return undefined;
  const scored = products.map((p) => {
    let score = 0;
    if (p.image_url?.includes("pl.")) score += 20;
    if (p.source === "fanza" || p.product_id) score += 10;
    if (p.iteminfo?.description) score += 5;
    if (p.sample_image_urls?.length) score += 3;
    return { p, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.p;
}

export function parseAvbaseActors(work: AvbaseWork): string[] {
  const names: string[] = [];
  for (const c of work.casts || []) {
    const n = c.actor?.name;
    if (n && isAvbaseActorName(n)) names.push(n.trim());
  }
  for (const a of work.actors || []) {
    const n = a.name;
    if (n && isAvbaseActorName(n)) names.push(n.trim());
  }
  return [...new Set(names)].slice(0, 20);
}

export function parseAvbaseGenres(work: AvbaseWork): string[] {
  const out: string[] = [];
  for (const g of work.genres || []) {
    const name = typeof g === "string" ? g : g?.name;
    const t = String(name || "").trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out.slice(0, 40);
}

export function pickAvbaseWorkFromSearch(works: AvbaseWork[] | undefined, code: string): AvbaseWork | undefined {
  if (!works?.length) return undefined;
  const exact = works.find((w) => matchAvbaseWorkId(w.work_id || "", code));
  if (exact) return exact;
  return works.length === 1 ? works[0] : undefined;
}

export function parseAvbaseWork(
  work: AvbaseWork | null | undefined,
  pageUrl: string,
  code: string,
): ProviderResult | null {
  if (!work?.work_id && !work?.title) return null;

  const std = stdCode(code);
  const product = pickAvbaseProduct(work.products);
  const title = cleanTitle(String(work.title || product?.title || ""), std);
  if (!title && !product?.image_url) return null;

  const actors = parseAvbaseActors(work);
  const genres = parseAvbaseGenres(work);
  const plot = stripAvbaseDescription(product?.iteminfo?.description);
  const directors = [product?.iteminfo?.director].filter(Boolean) as string[];
  const runtime = Number(String(product?.iteminfo?.volume || "").replace(/\D/g, "")) || undefined;
  const premiered =
    parseAvbaseDate(product?.date) ||
    parseAvbaseDate(work.min_date) ||
    undefined;

  let coverUrl = normalizeAvbaseCover(product?.image_url || product?.thumbnail_url || undefined);
  if (coverUrl && isJunkCoverUrl(coverUrl)) coverUrl = null;

  const extrafanartUrls = (product?.sample_image_urls || [])
    .map((s) => s.l || s.s)
    .filter((u): u is string => Boolean(u && u.startsWith("http")))
    .filter((u, i, arr) => arr.indexOf(u) === i)
    .slice(0, 20);

  const trailerUrl = product?.sample_movie_url?.startsWith("http")
    ? product.sample_movie_url
    : undefined;

  const studio = product?.maker?.name?.trim() || undefined;
  const publisher = product?.label?.name?.trim() || undefined;
  const series = product?.series?.name?.trim() || undefined;

  if (!title && !coverUrl && !actors.length && !plot) return null;

  return {
    source: "avbase",
    fields: {
      title: title || undefined,
      plot: plot || undefined,
      originalPlot: plot || undefined,
      actors,
      genres,
      directors: directors.length ? directors : undefined,
      studio,
      publisher,
      series,
      premiered,
      runtime: runtime && runtime > 0 ? runtime : undefined,
      trailerUrl,
      website: pageUrl,
    },
    coverUrl,
    extrafanartUrls: extrafanartUrls.length ? extrafanartUrls : undefined,
    ms: 0,
  };
}

export function parseAvbaseDetailHtml(html: string, pageUrl: string, code: string): ProviderResult | null {
  const data = parseAvbaseNextData(html);
  const work = (data?.props as { pageProps?: { work?: AvbaseWork } } | undefined)?.pageProps?.work;
  if (!work) return null;
  if (!matchAvbaseWorkId(work.work_id || "", code) && !pageUrl.toUpperCase().includes(stdCode(code))) {
    return null;
  }
  return parseAvbaseWork(work, pageUrl, code);
}

export function parseAvbaseSearchHtml(html: string, code: string): AvbaseWork | undefined {
  const data = parseAvbaseNextData(html);
  const works = (data?.props as { pageProps?: { works?: AvbaseWork[] } } | undefined)?.pageProps?.works;
  return pickAvbaseWorkFromSearch(works, code);
}

async function fetchAvbaseHtml(
  url: string,
  site: Awaited<ReturnType<typeof prepareProviderFetch>>,
  referer: string,
  signal?: AbortSignal,
): Promise<{ html: string; finalUrl: string } | null> {
  const page = await fetchPageForSite(
    url,
    site,
    {
      signal,
      referer,
      timeoutMs: 25000,
      viaFlare: false,
      strictTimeout: true,
    },
  );
  const html = page?.html || "";
  if (!html || html.length < 500) return null;
  return { html, finalUrl: page?.finalUrl || url };
}

async function scrapeAvbaseDetail(code: string, signal?: AbortSignal): Promise<ProviderResult> {
  const started = Date.now();
  const site = await prepareProviderFetch("avbase", DEFAULT_BASE);
  const base = site.baseUrl.replace(/\/$/, "");
  if (!base) return { source: "avbase", fields: {}, ms: Date.now() - started, error: "未配置网站地址" };

  const std = stdCode(code);
  const pageOpts = { site, referer: `${base}/`, signal };

  for (const path of [`/works/${encodeURIComponent(std)}`, `/works/${encodeURIComponent(std.toLowerCase())}`]) {
    const url = `${base}${path}`;
    const page = await fetchAvbaseHtml(url, site, pageOpts.referer, signal);
    if (!page) continue;
    const parsed = parseAvbaseDetailHtml(page.html, page.finalUrl, std);
    if (parsed) return { ...parsed, ms: Date.now() - started };
  }

  const searchUrl = `${base}/works?q=${encodeURIComponent(std)}`;
  const searchPage = await fetchAvbaseHtml(searchUrl, site, pageOpts.referer, signal);
  if (!searchPage) {
    return { source: "avbase", fields: {}, ms: Date.now() - started, error: "搜索无响应" };
  }

  const work = parseAvbaseSearchHtml(searchPage.html, std);
  if (!work) {
    return { source: "avbase", fields: {}, ms: Date.now() - started, error: "未找到" };
  }

  const detailPath = work.work_id ? `/works/${encodeURIComponent(work.work_id)}` : "";
  if (detailPath) {
    const detailUrl = absUrl(detailPath, base) || `${base}${detailPath}`;
    const detailPage = await fetchAvbaseHtml(detailUrl, site, searchUrl, signal);
    if (detailPage) {
      const parsed = parseAvbaseDetailHtml(detailPage.html, detailPage.finalUrl, std);
      if (parsed) return { ...parsed, ms: Date.now() - started };
    }
  }

  const fromSearch = parseAvbaseWork(work, searchPage.finalUrl, std);
  if (!fromSearch) {
    return { source: "avbase", fields: {}, ms: Date.now() - started, error: "未找到" };
  }
  return { ...fromSearch, ms: Date.now() - started };
}

export const avbaseProvider: ScrapeProvider = {
  id: "avbase",
  async scrape(ctx: ScrapeContext): Promise<ProviderResult | null> {
    try {
      return await scrapeAvbaseDetail(ctx.code, ctx.signal);
    } catch (err) {
      return {
        source: "avbase",
        fields: {},
        ms: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
