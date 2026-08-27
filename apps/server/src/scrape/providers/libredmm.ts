import { fetchJson } from "../network/fetch.js";
import { cleanTitle, codeKey, isJunkCoverUrl, isJunkTitle, stripTags } from "./htmlUtils.js";
import { prepareProviderFetch, siteFetchOpts } from "./providerSite.js";
import type { ProviderResult, ScrapeContext, ScrapeProvider } from "../types.js";

const DEFAULT_BASE = "https://www.libredmm.com";

type LibreMovie = {
  err?: string;
  title?: string;
  cover_image_url?: string;
  thumbnail_image_url?: string;
  actresses?: Array<{ name?: string }>;
  makers?: string[];
  labels?: string[];
  date?: string;
  description?: string;
  comment?: string;
  subtitle?: string;
  series?: string | string[];
  minute?: number;
  runtime?: number;
  genres?: string[];
  normalized_id?: string;
};

function preferPlCover(url: string | null | undefined): string | null {
  const u = String(url || "").trim();
  if (!u) return null;
  return u.replace(/ps\.jpg(\?|$)/i, "pl.jpg$1");
}

function parseHit(raw: unknown, code: string): Partial<ProviderResult["fields"]> & { coverUrl?: string | null } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as LibreMovie;
  if (o.err && o.err !== "ok") return null;

  const title = cleanTitle(o.title || "", code);
  if (title && isJunkTitle(title)) return null;

  let cover =
    preferPlCover(o.cover_image_url) || preferPlCover(o.thumbnail_image_url) || null;
  if (cover && isJunkCoverUrl(cover)) cover = null;

  const actors = (o.actresses || [])
    .map((a) => String(a?.name || "").replace(/\s+\d+歳.*$/u, "").trim())
    .filter(Boolean);

  const nid = String(o.normalized_id || "").replace(/[-_\s]/g, "").toUpperCase();
  if (nid && codeKey(nid) !== codeKey(code)) return null;

  if (!title && !cover) return null;

  const plot = stripTags(String(o.description || o.comment || o.subtitle || ""));
  const seriesRaw = o.series;
  const series = Array.isArray(seriesRaw) ? String(seriesRaw[0] || "").trim() : String(seriesRaw || "").trim();
  const runtime =
    typeof o.minute === "number"
      ? o.minute
      : typeof o.runtime === "number"
        ? o.runtime
        : null;
  const premiered = String(o.date || "").slice(0, 10);
  const genres = (o.genres || [])
    .map((g) => String(g).trim())
    .filter((g) => g && !/^サンプル動画$/i.test(g) && !/^デジタル配信$/i.test(g));

  return {
    title: title || undefined,
    plot: plot.length >= 12 ? plot : undefined,
    actors,
    genres,
    studio: String(o.makers?.[0] || "").trim() || undefined,
    publisher: String(o.labels?.[0] || "").trim() || undefined,
    series: series || undefined,
    premiered: /^\d{4}-\d{2}-\d{2}/.test(premiered) ? premiered : undefined,
    runtime: runtime && runtime > 0 && runtime < 600 ? runtime : null,
    coverUrl: cover,
  };
}

async function scrapeLibreDmmDetail(code: string, signal?: AbortSignal): Promise<ProviderResult> {
  const started = Date.now();
  const site = await prepareProviderFetch("libredmm", DEFAULT_BASE);
  const base = site.baseUrl;
  if (!base) return { source: "libredmm", fields: {}, ms: Date.now() - started, error: "未配置网站地址" };
  const referer = `${base}/`;
  const opts = siteFetchOpts(site, { signal, referer, timeoutMs: 25000 });

  const movieUrl = `${base}/movies/${encodeURIComponent(code.toUpperCase())}.json`;
  for (let i = 0; i < 5; i++) {
    const data = await fetchJson<LibreMovie>(movieUrl, opts);
    if (data && typeof data === "object") {
      const err = String(data.err || "");
      if (err === "processing") {
        await new Promise((r) => setTimeout(r, 1200 + i * 400));
        continue;
      }
      if (err === "not_found") break;
      const hit = parseHit(data, code);
      if (hit?.title || hit?.coverUrl) {
        const { coverUrl, ...fields } = hit;
        return { source: "libredmm", fields, coverUrl, ms: Date.now() - started };
      }
    }
    if (i < 2) {
      await new Promise((r) => setTimeout(r, 800));
      continue;
    }
    break;
  }

  const searchData = await fetchJson<LibreMovie>(
    `${base}/search.json?q=${encodeURIComponent(code.toUpperCase())}`,
    opts,
  );
  const fromSearch = parseHit(searchData, code);
  if (fromSearch?.title || fromSearch?.coverUrl) {
    const { coverUrl, ...fields } = fromSearch;
    return { source: "libredmm", fields, coverUrl, ms: Date.now() - started };
  }

  return { source: "libredmm", fields: {}, ms: Date.now() - started, error: "未找到" };
}

export const libredmmProvider: ScrapeProvider = {
  id: "libredmm",
  async scrape(ctx: ScrapeContext): Promise<ProviderResult | null> {
    try {
      return await scrapeLibreDmmDetail(ctx.code, ctx.signal);
    } catch (err) {
      return {
        source: "libredmm",
        fields: {},
        ms: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
