/**
 * DMM / FANZA 刮削
 * 新站 digital 详情已跳转到 video.dmm.co.jp SPA；对齐 MDCX 走 GraphQL。
 * 封面仍可用 CDN 探测兜底。
 */
import { getNetworkConfig } from "../../config/loadScrape.js";
import { probeImageUrl } from "../network/download.js";
import { applyProxy } from "../network/proxy.js";
import type { ProviderResult, ScrapeContext, ScrapeProvider } from "../types.js";
import { dmmCoverUrls, guessDmmCids } from "./dmmCid.js";
import { buildGraphqlTrailerCandidates, pickBestTrailer } from "./dmmTrailer.js";
import { cleanTitle, isJunkTitle, stdCode, stripTags } from "./htmlUtils.js";
import { prepareProviderFetch } from "./providerSite.js";

const SITE = "https://www.dmm.co.jp";
const GQL = "https://api.video.dmm.co.jp/graphql";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const DIGITAL_QUERY = `
query ScrapDigitalContent($id: ID!) {
  ppvContent(id: $id) {
    id
    title
    description
    packageImage { largeUrl mediumUrl }
    sample2DMovie { highestMovieUrl hlsMovieUrl }
    sampleVRMovie { highestMovieUrl }
    deliveryStartDate
    makerReleasedAt
    duration
    actresses { name }
    series { name }
    maker { name }
    label { name }
    genres { name }
    directors { name }
    sampleImages { number imageUrl }
  }
  reviewSummary(contentId: $id) {
    average
    total
  }
}
`;

type SampleMovieFields = {
  highestMovieUrl?: string | null;
  hlsMovieUrl?: string | null;
};

type PpvContent = {
  id?: string;
  title?: string;
  description?: string;
  packageImage?: { largeUrl?: string; mediumUrl?: string } | null;
  sample2DMovie?: SampleMovieFields | null;
  sampleVRMovie?: SampleMovieFields | null;
  deliveryStartDate?: string | null;
  makerReleasedAt?: string | null;
  duration?: number | null;
  actresses?: Array<{ name?: string } | null> | null;
  series?: { name?: string } | null;
  maker?: { name?: string } | null;
  label?: { name?: string } | null;
  genres?: Array<{ name?: string } | null> | null;
  directors?: Array<{ name?: string } | null> | null;
  sampleImages?: Array<{ number?: number; imageUrl?: string } | null> | null;
};

type GqlDigitalResult = {
  ppvContent?: PpvContent | null;
  reviewSummary?: { average?: number | null; total?: number | null } | null;
};

function syncProxy() {
  applyProxy(getNetworkConfig().proxyUrl);
}

function dateOnly(raw: string | null | undefined): string | undefined {
  const s = String(raw || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined;
}

async function probeDmmCovers(cid: string): Promise<{ pl: string | null; ps: string | null }> {
  const urls = dmmCoverUrls(cid);
  let pl: string | null = null;
  let ps: string | null = null;
  for (const url of [urls.pl, urls.awsPl]) {
    const probe = await probeImageUrl(url, { referer: `${SITE}/` });
    if (!probe.ok) continue;
    if (/now_printing/i.test(probe.finalUrl)) continue;
    if (probe.sizeHint > 0 && probe.sizeHint < 30000) continue;
    pl = url;
    break;
  }
  for (const url of [urls.ps, urls.awsPs]) {
    const probe = await probeImageUrl(url, { referer: `${SITE}/` });
    if (!probe.ok) continue;
    if (/now_printing/i.test(probe.finalUrl)) continue;
    if (probe.sizeHint > 0 && probe.sizeHint < 8000) continue;
    ps = url;
    break;
  }
  return { pl, ps };
}

/** POST GraphQL（经全局代理 dispatcher） */
async function postGraphql(
  cid: string,
  cookie?: string,
  signal?: AbortSignal,
): Promise<GqlDigitalResult | null> {
  const { fetch: undiciFetch } = await import("undici");
  const detail = `https://video.dmm.co.jp/av/content/?id=${cid}`;
  const timeout = AbortSignal.timeout(20000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const res = await undiciFetch(GQL, {
    method: "POST",
    signal: combined,
    headers: {
      "Content-Type": "application/json",
      Origin: "https://video.dmm.co.jp",
      Referer: detail,
      "User-Agent": UA,
      Accept: "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({
      operationName: "ScrapDigitalContent",
      variables: { id: cid },
      query: DIGITAL_QUERY,
    }),
  });
  if (!res.ok) {
    await res.arrayBuffer().catch(() => undefined);
    return null;
  }
  const json = (await res.json()) as { data?: GqlDigitalResult | null };
  const data = json?.data;
  const hit = data?.ppvContent;
  if (!hit?.id && !hit?.title) return null;
  return data ?? null;
}

function parseSampleImages(hit: PpvContent): string[] {
  const urls: string[] = [];
  for (const row of hit.sampleImages || []) {
    const url = String(row?.imageUrl || "").trim();
    if (!url.startsWith("http")) continue;
    if (!urls.includes(url)) urls.push(url);
  }
  return urls.sort((a, b) => {
    const na = Number(a.match(/-(\d+)\./)?.[1] || 0);
    const nb = Number(b.match(/-(\d+)\./)?.[1] || 0);
    return na - nb;
  });
}

export function parseGraphqlHit(
  data: GqlDigitalResult,
  code: string,
): ProviderResult["fields"] & { coverUrl?: string | null; extrafanartUrls?: string[] } {
  const hit = data.ppvContent!;
  let title = cleanTitle(hit.title || "", code);
  if (title && isJunkTitle(title)) title = "";
  const plot = stripTags(String(hit.description || "")).replace(/\s+/g, " ").trim();
  const actorsRaw = (hit.actresses || [])
    .map((a) => String(a?.name || "").trim())
    .filter((n) => n && n.length < 40);
  const actors: string[] = [];
  for (const name of actorsRaw) {
    if (!actors.includes(name)) actors.push(name);
  }
  const genres = (hit.genres || [])
    .map((g) => String(g?.name || "").trim())
    .filter((n) => n && n.length < 40);
  const durationSec = Number(hit.duration || 0);
  const runtime = durationSec > 0 ? Math.round(durationSec / 60) : null;
  const cover =
    String(hit.packageImage?.largeUrl || "").trim() ||
    String(hit.packageImage?.mediumUrl || "").trim() ||
    null;
  const cid = String(hit.id || "").trim();
  const directors = (hit.directors || [])
    .map((d) => String(d?.name || "").trim())
    .filter((n) => n && n.length < 40);
  const website = cid
    ? `https://www.dmm.co.jp/digital/videoa/-/detail/=/cid=${cid}/`
    : undefined;
  const trailerUrl = pickBestTrailer(
    buildGraphqlTrailerCandidates(hit.sample2DMovie, hit.sampleVRMovie),
  );
  const reviewAvg = Number(data.reviewSummary?.average ?? 0);
  const hasReview = Number.isFinite(reviewAvg) && reviewAvg > 0;
  const reviewTotal = Number(data.reviewSummary?.total ?? 0);
  const votes =
    Number.isFinite(reviewTotal) && reviewTotal > 0 ? String(Math.floor(reviewTotal)) : undefined;
  const extrafanartUrls = parseSampleImages(hit);
  return {
    ...(cid ? { publishNumber: cid.toLowerCase() } : {}),
    title: title || undefined,
    plot: plot.length >= 12 ? plot : undefined,
    originalPlot: plot.length >= 12 ? plot : undefined,
    actors,
    genres,
    directors: directors.length ? directors : undefined,
    studio: String(hit.maker?.name || "").trim() || undefined,
    publisher: String(hit.label?.name || "").trim() || undefined,
    series: String(hit.series?.name || "").trim() || undefined,
    premiered: dateOnly(hit.deliveryStartDate) || dateOnly(hit.makerReleasedAt),
    runtime: runtime && runtime > 0 && runtime < 600 ? runtime : null,
    website,
    trailerUrl,
    ...(hasReview
      ? {
          score: reviewAvg * 2,
          ratingValue: reviewAvg,
          ratingMax: 5,
          ratingSource: "dmm",
        }
      : {}),
    ...(votes ? { votes } : {}),
    coverUrl: cover,
    ...(extrafanartUrls.length ? { extrafanartUrls } : {}),
  };
}

async function scrapeDmmDetail(codeRaw: string, signal?: AbortSignal): Promise<ProviderResult> {
  const started = Date.now();
  const code = stdCode(codeRaw);
  if (!code || /^FC2/i.test(code)) {
    return { source: "dmm", fields: {}, ms: Date.now() - started, error: "番号格式无效" };
  }
  if (!/^([A-Z]{2,10})-(\d{2,6})$/.test(code)) {
    return { source: "dmm", fields: {}, ms: Date.now() - started, error: "番号格式无效" };
  }
  if (signal?.aborted) {
    return { source: "dmm", fields: {}, ms: Date.now() - started, error: "已取消" };
  }

  syncProxy();
  const site = await prepareProviderFetch("dmm", SITE);
  const cookie = site.cookie;
  const variants = guessDmmCids(code);

  for (const cid of variants) {
    if (signal?.aborted) break;
    try {
      const data = await postGraphql(cid, cookie, signal);
      if (!data?.ppvContent) continue;
      const parsed = parseGraphqlHit(data, code);
      if (!parsed.title && !parsed.coverUrl) continue;
      const { coverUrl, extrafanartUrls, ...fields } = parsed;
      return {
        source: "dmm",
        fields,
        coverUrl,
        extrafanartUrls,
        ms: Date.now() - started,
      };
    } catch {
      /* try next cid */
    }
  }

  // GraphQL 全空时：至少尝试 CDN 封面（便于合并其它源）
  for (const cid of variants.slice(0, 8)) {
    if (signal?.aborted) break;
    const covers = await probeDmmCovers(cid);
    const cover = covers.pl || covers.ps;
    if (cover) {
      return {
        source: "dmm",
        fields: {},
        coverUrl: cover,
        ms: Date.now() - started,
        error: "详情 GraphQL 无数据（仅封面）",
      };
    }
  }

  return { source: "dmm", fields: {}, ms: Date.now() - started, error: "未找到" };
}

/** 测通：打 GraphQL（与刮削同路），勿只探会跳年龄门的营销首页 */
export async function probeDmmApi(): Promise<{
  ok: boolean;
  message: string;
  status?: number;
}> {
  syncProxy();
  const site = await prepareProviderFetch("dmm", SITE);
  try {
    const data = await postGraphql("sone00001", site.cookie, AbortSignal.timeout(15_000));
    if (data?.ppvContent?.title || data?.ppvContent?.id) {
      return { ok: true, status: 200, message: "可达 · api(graphql)" };
    }
    return { ok: false, status: 200, message: "GraphQL 无业务数据（出口或 CID）" };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export const dmmProvider: ScrapeProvider = {
  id: "dmm",
  async scrape(ctx: ScrapeContext): Promise<ProviderResult | null> {
    try {
      return await scrapeDmmDetail(ctx.code, ctx.signal);
    } catch (err) {
      return {
        source: "dmm",
        fields: {},
        ms: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
