import { fetchJson } from "../network/fetch.js";
import { probeImageUrl } from "../network/download.js";
import { cleanTitle, isJunkCoverUrl, isJunkTitle } from "./htmlUtils.js";
import { dmmCoverUrls, guessDmmCids } from "./dmmCid.js";
import { prepareProviderFetch, siteFetchOpts } from "./providerSite.js";
import type { ProviderResult, ScrapeContext, ScrapeProvider } from "../types.js";

const API_BASE = "https://r18.dev";

/** MDCX r18dev.py _content_id_prefixes（完整移植） */
const CONTENT_ID_PREFIXES: Record<string, string[]> = {
  abf: ["118"],
  abp: ["118"],
  abs: ["118"],
  abw: ["118"],
  aky: ["118"],
  ap: ["", "1"],
  apak: ["118"],
  bf: ["118"],
  bjd: ["118"],
  bkd: ["118"],
  blk: ["118"],
  cawd: ["118"],
  cnd: ["118"],
  cre: ["118"],
  dldss: ["118"],
  dmow: ["118"],
  dok: ["118"],
  ebod: ["118"],
  eyan: ["118"],
  fb: ["118"],
  gbs: ["118"],
  gvh: ["118"],
  hnd: ["118"],
  hunt: ["118"],
  husr: ["118"],
  hzn: ["118"],
  ipx: ["118"],
  ipvr: ["118"],
  ism: ["118"],
  joe: ["118"],
  jul: ["118"],
  kawd: ["118"],
  kire: ["118"],
  kiss: ["118"],
  ksb: ["118"],
  laf: ["118"],
  lilu: ["118"],
  lulu: ["118"],
  mczt: ["118"],
  md: ["118"],
  mey: ["118"],
  mgt: ["118"],
  midv: ["118"],
  miim: ["118"],
  mimk: ["118"],
  mism: ["118"],
  mkmp: ["118"],
  mmgh: ["118"],
  mmsl: ["118"],
  mvsd: ["118"],
  nkk: ["118"],
  nsps: ["118"],
  nvh: ["118"],
  ofje: ["118"],
  okb: ["118"],
  onhr: ["118"],
  pbd: ["118"],
  pd: ["118"],
  pgd: ["118"],
  pkse: ["118"],
  ppbd: ["118"],
  pppe: ["118"],
  pred: ["118"],
  prtd: ["118"],
  rbd: ["118"],
  rbk: ["118"],
  rctd: ["118"],
  reys: ["118"],
  royz: ["118"],
  sac: ["118"],
  sdab: ["118"],
  sdam: ["118"],
  sdde: ["118"],
  sdmf: ["118"],
  sdmua: ["118"],
  shic: ["118"],
  shkd: ["118"],
  siv: ["118"],
  skhj: ["118"],
  sma: ["118"],
  soe: ["118"],
  sone: ["118"],
  sqis: ["118"],
  ssis: ["118"],
  stars: ["118"],
  start: ["118"],
  svis: ["118"],
  tbf: ["118"],
  tkt: ["118"],
  tmn: ["118"],
  tora: ["118"],
  tt: ["118"],
  und: ["118"],
  vnds: ["118"],
  vv: ["118"],
  wanz: ["118"],
  wss: ["118"],
  xvsr: ["118"],
  ymdd: ["118"],
};

export type R18Movie = {
  dvd_id?: string;
  content_id?: string;
  title_ja?: string;
  title_en?: string;
  title_en_uncensored?: string;
  release_date?: string;
  runtime_mins?: number;
  maker_name_ja?: string;
  maker_name_en?: string;
  label_name_ja?: string;
  label_name_en?: string;
  series_name_ja?: string;
  series_name_en?: string;
  series_name?: string;
  jacket_full_url?: string;
  sample_url?: string;
  actress?: string;
  actresses?: Array<{ name_kanji?: string; name_romaji?: string }>;
  directors?: Array<{ name_kanji?: string; name_romaji?: string }>;
  categories?: Array<{ name_ja?: string; name_en?: string }>;
  gallery?: Array<{ image_full?: string }>;
  images?: { jacket_image?: { large2?: string; large?: string } };
  sample?: { high?: string; low?: string };
};

/** MDCX _normalize_id */
export function normalizeR18Id(id: string): string {
  const raw = String(id || "").toLowerCase().replace(/-/g, "").replace(/\s/g, "");
  const m = raw.match(/^([a-z]+)(\d+)$/);
  if (!m) return raw;
  return `${m[1]}${Number(m[2]).toString().padStart(5, "0")}`;
}

/** MDCX _series_number */
export function parseR18SeriesNumber(id: string): [string, string] {
  const raw = String(id || "").toLowerCase().replace(/-/g, "").replace(/\s/g, "");
  const m = raw.match(/^([a-z]+)(\d+)$/);
  return m ? [m[1]!, m[2]!] : ["", ""];
}

/** MDCX _generate_content_id_variations */
export function generateR18ContentIdVariations(id: string): string[] {
  const raw = String(id || "").toLowerCase().replace(/-/g, "").replace(/\s/g, "");
  const m = raw.match(/^([a-z]+)(\d+)$/);
  if (!m) return [];
  const series = m[1]!;
  const numInt = Number(m[2]);
  const padded3 = String(numInt).padStart(3, "0");
  const padded5 = String(numInt).padStart(5, "0");
  const prefixes = CONTENT_ID_PREFIXES[series] ?? ["", "1"];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of prefixes) {
    for (const v of [`${p}${series}${padded5}`, `${p}${series}${padded3}`]) {
      if (!seen.has(v)) {
        seen.add(v);
        out.push(v);
      }
    }
  }
  return out;
}

export function buildR18DvdSearchUrl(code: string): string {
  return `${API_BASE}/videos/vod/movies/detail/-/dvd_id=${normalizeR18Id(code)}/json`;
}

export function buildR18CombinedUrl(contentId: string): string {
  return `${API_BASE}/videos/vod/movies/detail/-/combined=${contentId}/json`;
}

/** MDCX _parse_search_page */
export function resolveR18DetailUrl(search: R18Movie, code: string): string | null {
  const contentId = search.content_id || search.dvd_id;
  if (!contentId) return null;
  if (search.dvd_id) {
    if (normalizeR18Id(search.dvd_id) === normalizeR18Id(code)) {
      return buildR18CombinedUrl(String(contentId));
    }
  }
  return buildR18CombinedUrl(String(contentId));
}

function formatR18Number(dvdId: string): string {
  let number = String(dvdId || "").toUpperCase().replace(/-/g, "");
  const m = number.match(/^([A-Z]+)\d+$/);
  if (m) {
    const [series, numStr] = parseR18SeriesNumber(dvdId);
    if (series && numStr) {
      number = `${series.toUpperCase()}-${Number(numStr).toString().padStart(3, "0")}`;
    }
  }
  return number;
}

/** MDCX _parse_json */
export function parseR18MovieJson(data: R18Movie, fallbackCode?: string) {
  const dvdId = data.dvd_id || fallbackCode || "";
  const number = formatR18Number(dvdId) || String(fallbackCode || "").trim().toUpperCase();

  const titleJa = String(data.title_ja || "").trim();
  const titleEn = String(data.title_en_uncensored || data.title_en || "").trim();
  const titleRaw = titleJa || titleEn;
  const title = cleanTitle(titleRaw, number);
  if (!title || isJunkTitle(title)) return null;

  const actors: string[] = [];
  for (const a of data.actresses || []) {
    const name = String(a.name_kanji || a.name_romaji || "").trim();
    if (name) actors.push(name);
  }
  if (data.actress && !actors.includes(data.actress)) actors.push(data.actress);

  const directors = (data.directors || [])
    .map((d) => String(d.name_kanji || d.name_romaji || "").trim())
    .filter(Boolean);

  const genres = (data.categories || [])
    .map((c) => String(c.name_ja || c.name_en || "").trim())
    .filter(Boolean);

  let cover =
    String(data.jacket_full_url || "").trim() ||
    String(data.images?.jacket_image?.large2 || data.images?.jacket_image?.large || "").trim();
  if (cover && isJunkCoverUrl(cover)) cover = "";

  let trailer = String(data.sample_url || data.sample?.high || data.sample?.low || "").trim();
  if (trailer.startsWith("//")) trailer = `https:${trailer}`;

  const extrafanartUrls = (data.gallery || [])
    .map((g) => String(g.image_full || "").trim())
    .filter((u) => u && /\.(jpe?g|png|webp)(\?|$)/i.test(u));

  const runtime = typeof data.runtime_mins === "number" && data.runtime_mins > 0 ? data.runtime_mins : null;
  const premiered = String(data.release_date || "").slice(0, 10);

  return {
    fields: {
      title,
      originaltitle: titleJa || titleEn || title,
      plot: undefined as string | undefined,
      actors,
      genres,
      directors,
      studio: String(data.maker_name_ja || data.maker_name_en || "").trim() || undefined,
      publisher: String(data.label_name_ja || data.label_name_en || "").trim() || undefined,
      series:
        String(data.series_name_ja || data.series_name_en || data.series_name || "").trim() || undefined,
      premiered: /^\d{4}-\d{2}-\d{2}/.test(premiered) ? premiered : undefined,
      runtime,
      mosaic: "有码",
      trailerUrl: trailer || undefined,
      website: data.content_id ? buildR18CombinedUrl(data.content_id) : undefined,
    },
    coverUrl: cover || null,
    extrafanartUrls: extrafanartUrls.length ? extrafanartUrls : undefined,
    contentId: data.content_id || "",
  };
}

async function upgradeR18Cover(code: string, coverUrl: string | null): Promise<string | null> {
  if (!coverUrl || !/dmm\.(co\.jp|com)/i.test(coverUrl)) return coverUrl;
  for (const cid of guessDmmCids(code)) {
    const urls = dmmCoverUrls(cid);
    for (const url of [urls.awsPl, urls.awsPs, urls.pl, urls.ps]) {
      if (!url) continue;
      const probe = await probeImageUrl(url, { referer: `${API_BASE}/`, timeoutMs: 8000 });
      if (probe.ok && probe.sizeHint >= 30_000) return url;
    }
  }
  return coverUrl;
}

async function fetchR18Json(url: string, signal?: AbortSignal): Promise<R18Movie | null> {
  const site = await prepareProviderFetch("r18dev", API_BASE);
  const opts = siteFetchOpts(site, {
    signal,
    referer: `${API_BASE}/`,
    timeoutMs: 25000,
  });
  const data = await fetchJson<R18Movie>(url, opts);
  return data && typeof data === "object" ? data : null;
}

async function scrapeR18Detail(code: string, signal?: AbortSignal): Promise<ProviderResult> {
  const started = Date.now();
  const trimmed = String(code || "").trim().toUpperCase();
  if (!trimmed) {
    return { source: "r18dev", fields: {}, ms: Date.now() - started, error: "番号为空" };
  }

  let detailUrl = "";
  let detail: R18Movie | null = null;

  const search = await fetchR18Json(buildR18DvdSearchUrl(trimmed), signal);
  if (search) {
    detailUrl = resolveR18DetailUrl(search, trimmed) || "";
    if (detailUrl) detail = await fetchR18Json(detailUrl, signal);
    if (!detail?.title_ja && !detail?.title_en && search.title_ja) detail = search;
  }

  if (!detail?.dvd_id && !detail?.title_ja && !detail?.title_en) {
    for (const cid of generateR18ContentIdVariations(trimmed)) {
      const hit = await fetchR18Json(buildR18CombinedUrl(cid), signal);
      if (!hit) continue;
      if (hit.content_id && (hit.dvd_id || hit.title_ja || hit.title_en)) {
        detailUrl = buildR18CombinedUrl(hit.content_id);
        detail = hit;
        break;
      }
    }
  }

  if (!detail) {
    return { source: "r18dev", fields: {}, ms: Date.now() - started, error: "未找到" };
  }

  const parsed = parseR18MovieJson(detail, trimmed);
  if (!parsed?.fields.title) {
    return { source: "r18dev", fields: {}, ms: Date.now() - started, error: "未找到标题" };
  }

  let coverUrl = parsed.coverUrl;
  if (coverUrl) coverUrl = await upgradeR18Cover(trimmed, coverUrl);

  return {
    source: "r18dev",
    fields: parsed.fields,
    coverUrl,
    extrafanartUrls: parsed.extrafanartUrls,
    ms: Date.now() - started,
  };
}

export const r18devProvider: ScrapeProvider = {
  id: "r18dev",
  async scrape(ctx: ScrapeContext): Promise<ProviderResult | null> {
    try {
      return await scrapeR18Detail(ctx.code, ctx.signal);
    } catch (err) {
      return {
        source: "r18dev",
        fields: {},
        ms: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
