import { loadScrapeConfig } from "../../config/loadScrape.js";
import {
  cleanTitle,
  codeKey,
  isJunkCoverUrl,
  isJunkTitle,
  stdCode,
  stripTags,
} from "./htmlUtils.js";
import { prepareProviderFetch } from "./providerSite.js";
import type { ProviderResult, ScrapeContext, ScrapeProvider } from "../types.js";

export const THEPORNDB_SITE_URL = "https://theporndb.net";
/** REST 仍走 api 子域；UI/配置只展示主站 URL */
const THEPORNDB_API_BASE = "https://api.theporndb.net";

export function resolveTheporndbApiBase(): string {
  return THEPORNDB_API_BASE;
}

type TpdbScene = {
  id?: string;
  title?: string;
  description?: string;
  date?: string;
  duration?: number | null;
  rating?: number | null;
  image?: string | null;
  poster?: string | null;
  poster_image?: string | null;
  back_image?: string | null;
  sku?: string | null;
  external_id?: string | null;
  slug?: string | null;
  site?: { name?: string; network?: string } | null;
  performers?: Array<{ name?: string; parent?: { name?: string } }>;
  tags?: Array<{ name?: string }>;
  directors?: Array<{ name?: string }>;
  background?: { full?: string; large?: string } | null;
  posters?: { full?: string; large?: string } | null;
};

const WESTERN_STUDIO_ALIASES: Record<string, string> = {
  puretaboo: "Pure Taboo",
  rk: "Reality Kings",
  sexmex: "SexMex",
  pornworld: "Porn World",
};

/** 本地欧美命名 STUDIO.YYYY.MM.DD → TPDB 搜索词 */
export function buildTheporndbSearchQueries(code: string): string[] {
  const raw = String(code || "").trim();
  const out = [raw];
  const dotDate = raw.match(/^([A-Za-z][A-Za-z0-9]*)\.(\d{4})\.(\d{2})\.(\d{2})$/);
  if (!dotDate) return [...new Set(out)];
  const [, studioKey, y, mo, d] = dotDate;
  const studio =
    WESTERN_STUDIO_ALIASES[studioKey!.toLowerCase()] ||
    studioKey!.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  const iso = `${y}-${mo}-${d}`;
  out.push(`${studio} ${iso}`, studio!, `${studioKey} ${iso}`);
  return [...new Set(out.filter(Boolean))];
}

function scoreWesternDateHit(item: TpdbScene, code: string): number {
  const m = code.match(/^([A-Za-z][A-Za-z0-9]*)\.(\d{4})\.(\d{2})\.(\d{2})$/);
  if (!m) return 0;
  const [, studioKey, y, mo, d] = m;
  const iso = `${y}-${mo}-${d}`;
  let score = 0;
  if (String(item.date || "").slice(0, 10) === iso) score += 80;
  const siteName = String(item.site?.name || item.site?.network || "").toLowerCase();
  const alias = (WESTERN_STUDIO_ALIASES[studioKey!.toLowerCase()] || studioKey!).toLowerCase();
  if (siteName.includes(alias) || alias.includes(siteName.split(":")[0]?.trim() || "zzz")) score += 40;
  return score;
}

function looksJav(code: string): boolean {
  const u = code.toUpperCase();
  if (/^FC2/.test(u)) return true;
  if (/^[A-Z]{1,12}-\d{2,}/.test(u)) return true;
  if (/^\d{2,3}[A-Z]{2,}-\d+/.test(u)) return true;
  return false;
}

function scoreHit(item: TpdbScene, want: string, code: string): number {
  let score = 0;
  const blob = [item.title, item.sku, item.external_id, item.slug, item.id]
    .map((x) => String(x || ""))
    .join(" ");
  const keyBlob = codeKey(blob);
  if (keyBlob === want || keyBlob.includes(want)) score += 100;
  if (codeKey(String(item.sku || "")) === want) score += 80;
  if (codeKey(String(item.external_id || "")) === want) score += 40;
  if (new RegExp(code.replace(/-/g, "[-_]?"), "i").test(blob)) score += 30;
  if (item.image || item.poster || item.poster_image) score += 5;
  score += scoreWesternDateHit(item, code);
  return score;
}

function parseScene(item: TpdbScene, code: string): ProviderResult | null {
  const std = stdCode(code) || code;
  const title = cleanTitle(String(item.title || ""), std);
  if (!title || isJunkTitle(title)) return null;

  const actors = (item.performers || [])
    .map((p) => String(p?.parent?.name || p?.name || "").trim())
    .filter(Boolean);
  const genres = (item.tags || [])
    .map((t) => String(t?.name || "").trim())
    .filter(Boolean)
    .slice(0, 30);
  const studio = String(item.site?.name || item.site?.network || "").trim() || undefined;
  const premiered = String(item.date || "").slice(0, 10);
  const dur = typeof item.duration === "number" ? item.duration : null;
  const runtime = dur && dur > 0 ? (dur > 600 ? Math.round(dur / 60) : dur) : null;

  let cover =
    item.posters?.full ||
    item.posters?.large ||
    item.poster_image ||
    item.poster ||
    item.image ||
    item.background?.full ||
    item.background?.large ||
    item.back_image ||
    null;
  if (cover && isJunkCoverUrl(cover)) cover = null;

  const plot = stripTags(String(item.description || ""));

  return {
    source: "theporndb",
    fields: {
      title,
      plot: plot.length >= 12 ? plot : undefined,
      actors: [...new Set(actors)].slice(0, 20),
      genres,
      studio,
      premiered: /^\d{4}-\d{2}-\d{2}/.test(premiered) ? premiered : undefined,
      runtime: runtime && runtime > 0 ? runtime : null,
    },
    coverUrl: cover,
    ms: 0,
  };
}

async function tpdbGetJson(
  base: string,
  pathAndQuery: string,
  apiKey: string,
  signal?: AbortSignal,
  userAgent?: string,
): Promise<unknown | null> {
  const auth = apiKey.toLowerCase().startsWith("bearer ") ? apiKey : `Bearer ${apiKey}`;
  const { request } = await import("undici");
  const res = await request(`${base}${pathAndQuery}`, {
    signal,
    headers: {
      accept: "application/json",
      authorization: auth,
      "user-agent":
        userAgent ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    },
  });
  if (res.statusCode === 401 || res.statusCode === 403 || res.statusCode >= 400) return null;
  try {
    return JSON.parse(await res.body.text()) as unknown;
  } catch {
    return null;
  }
}

type TpdbSearchKind = "jav" | "scenes" | "movies";

/** 对齐 MDCX：JAV 用 /jav?q=；欧美用 /scenes?parse=，失败再 /movies?parse= */
export function buildTheporndbSearchPaths(code: string): Array<{ path: string; kind: TpdbSearchKind }> {
  const std = stdCode(code) || code;
  if (looksJav(code)) {
    return [
      { path: `/jav?q=${encodeURIComponent(code)}&per_page=10`, kind: "jav" },
      { path: `/jav?q=${encodeURIComponent(std)}&per_page=10`, kind: "jav" },
      { path: `/scenes?q=${encodeURIComponent(code)}&per_page=5`, kind: "scenes" },
    ];
  }
  const paths: Array<{ path: string; kind: TpdbSearchKind }> = [];
  for (const q of buildTheporndbSearchQueries(code)) {
    paths.push({ path: `/scenes?parse=${encodeURIComponent(q)}&per_page=100`, kind: "scenes" });
  }
  for (const q of buildTheporndbSearchQueries(code)) {
    paths.push({ path: `/movies?parse=${encodeURIComponent(q)}&per_page=20`, kind: "movies" });
  }
  return paths;
}

async function scrapeTheporndbDetail(code: string, signal?: AbortSignal): Promise<ProviderResult> {
  const started = Date.now();
  const apiKey = resolveTheporndbApiKey();
  if (!apiKey) {
    return { source: "theporndb", fields: {}, ms: Date.now() - started, error: "需要 ThePornDB API Key" };
  }

  const site = await prepareProviderFetch("theporndb", THEPORNDB_SITE_URL);
  const base = resolveTheporndbApiBase();

  const std = stdCode(code) || code;
  const want = codeKey(std);
  const searchPaths = buildTheporndbSearchPaths(code);

  let best: TpdbScene | null = null;
  let bestScore = 0;
  let bestKind: TpdbSearchKind = looksJav(code) ? "jav" : "scenes";

  for (const { path, kind } of searchPaths) {
    const raw = await tpdbGetJson(base, path, apiKey, signal, site.userAgent);
    if (!raw || typeof raw !== "object") continue;
    const list = Array.isArray((raw as { data?: unknown }).data)
      ? ((raw as { data: TpdbScene[] }).data || [])
      : [];
    for (const item of list) {
      const sc = scoreHit(item, want, code);
      if (sc > bestScore) {
        best = item;
        bestScore = sc;
        bestKind = kind;
      }
    }
    if (bestScore >= 100) break;
  }

  if (!best || bestScore < 20) {
    return { source: "theporndb", fields: {}, ms: Date.now() - started, error: "未找到" };
  }

  const id = String(best.id || "").trim();
  if (id) {
    const detailPath =
      bestKind === "jav"
        ? `/jav/${encodeURIComponent(id)}`
        : bestKind === "movies"
          ? `/movies/${encodeURIComponent(id)}`
          : `/scenes/${encodeURIComponent(id)}`;
    const detail = await tpdbGetJson(base, detailPath, apiKey, signal, site.userAgent);
    const full = (detail as { data?: TpdbScene } | null)?.data;
    if (full) best = full;
  }

  const parsed = parseScene(best, code);
  if (!parsed) {
    return { source: "theporndb", fields: {}, ms: Date.now() - started, error: "解析失败" };
  }
  return { ...parsed, ms: Date.now() - started };
}

export function resolveTheporndbApiKey(): string {
  const cfg = loadScrapeConfig();
  return String(cfg.theporndbApiKey || process.env.THEPORNDB_API_KEY || "").trim();
}

/** 有 Key 后打一枪轻量搜索，验证鉴权（根路径无业务 HTML） */
export async function probeTheporndbApi(): Promise<{
  ok: boolean;
  message: string;
  status?: number;
}> {
  const apiKey = resolveTheporndbApiKey();
  if (!apiKey) {
    return { ok: false, message: "未配置 API Key（请在数据源卡片填写）" };
  }
  const site = await prepareProviderFetch("theporndb", THEPORNDB_SITE_URL);
  const base = resolveTheporndbApiBase();
  const auth = apiKey.toLowerCase().startsWith("bearer ") ? apiKey : `Bearer ${apiKey}`;
  try {
    const { request } = await import("undici");
    const res = await request(`${base}/jav?q=SONE-001&per_page=1`, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        accept: "application/json",
        authorization: auth,
        "user-agent":
          site.userAgent ||
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
    });
    const status = res.statusCode;
    await res.body.text().catch(() => "");
    if (status === 401 || status === 403) {
      return { ok: false, status, message: `API 鉴权失败 HTTP ${status}` };
    }
    if (status < 200 || status >= 300) {
      return { ok: false, status, message: `API HTTP ${status}` };
    }
    return { ok: true, status, message: "可达 · api" };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export const theporndbProvider: ScrapeProvider = {
  id: "theporndb",
  async scrape(ctx: ScrapeContext): Promise<ProviderResult | null> {
    try {
      return await scrapeTheporndbDetail(ctx.code, ctx.signal);
    } catch (err) {
      return {
        source: "theporndb",
        fields: {},
        ms: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
