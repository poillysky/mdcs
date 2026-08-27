/**
 * 高清海报补充：Tenhow 演员检索、Amazon JP 标题/ASIN 搜图、已有封面跳过逻辑。
 */
import * as cheerio from "cheerio";
import type { ScrapeMeta } from "./types.js";
import { isAmazonCoverUrl, type DownloadPrefs } from "./downloadPrefs.js";

const TENHOW_ORIGIN = "https://www.tenhow.net";
const AMAZON_ORIGIN = "https://www.amazon.co.jp";
const DMM_HOST_RE = /dmm\.co\.jp|awsimgsrc\.dmm/i;
const ASIN_RE = /\b(B0[A-Z0-9]{8}|B[A-Z0-9]{9})\b/i;
const SKIP_AMAZON_MIN_BYTES = 400 * 1024;
const DMM_HD_MIN_WIDTH = 700;

/** 五十音行 → Tenhow 索引页 */
const KANA_ROW_PAGES: Record<string, string> = {
  あ: "agyo.html",
  い: "agyo.html",
  う: "agyo.html",
  え: "agyo.html",
  お: "agyo.html",
  ア: "agyo.html",
  イ: "agyo.html",
  ウ: "agyo.html",
  エ: "agyo.html",
  オ: "agyo.html",
  か: "kgyo.html",
  き: "kgyo.html",
  く: "kgyo.html",
  け: "kgyo.html",
  こ: "kgyo.html",
  カ: "kgyo.html",
  キ: "kgyo.html",
  ク: "kgyo.html",
  ケ: "kgyo.html",
  コ: "kgyo.html",
  が: "kgyo.html",
  ぎ: "kgyo.html",
  ぐ: "kgyo.html",
  げ: "kgyo.html",
  ご: "kgyo.html",
  ガ: "kgyo.html",
  ギ: "kgyo.html",
  グ: "kgyo.html",
  ゲ: "kgyo.html",
  ゴ: "kgyo.html",
  さ: "sgyo.html",
  し: "sgyo.html",
  す: "sgyo.html",
  せ: "sgyo.html",
  そ: "sgyo.html",
  サ: "sgyo.html",
  シ: "sgyo.html",
  ス: "sgyo.html",
  セ: "sgyo.html",
  ソ: "sgyo.html",
  ざ: "sgyo.html",
  じ: "sgyo.html",
  ず: "sgyo.html",
  ぜ: "sgyo.html",
  ぞ: "sgyo.html",
  ザ: "sgyo.html",
  ジ: "sgyo.html",
  ズ: "sgyo.html",
  ゼ: "sgyo.html",
  ゾ: "sgyo.html",
  た: "tgyo.html",
  ち: "tgyo.html",
  つ: "tgyo.html",
  て: "tgyo.html",
  と: "tgyo.html",
  タ: "tgyo.html",
  チ: "tgyo.html",
  ツ: "tgyo.html",
  テ: "tgyo.html",
  ト: "tgyo.html",
  だ: "tgyo.html",
  ぢ: "tgyo.html",
  づ: "tgyo.html",
  で: "tgyo.html",
  ど: "tgyo.html",
  ダ: "tgyo.html",
  ヂ: "tgyo.html",
  ヅ: "tgyo.html",
  デ: "tgyo.html",
  ド: "tgyo.html",
  な: "ngyo.html",
  に: "ngyo.html",
  ぬ: "ngyo.html",
  ね: "ngyo.html",
  の: "ngyo.html",
  ナ: "ngyo.html",
  ニ: "ngyo.html",
  ヌ: "ngyo.html",
  ネ: "ngyo.html",
  ノ: "ngyo.html",
  は: "hgyo.html",
  ひ: "hgyo.html",
  ふ: "hgyo.html",
  へ: "hgyo.html",
  ほ: "hgyo.html",
  ハ: "hgyo.html",
  ヒ: "hgyo.html",
  フ: "hgyo.html",
  ヘ: "hgyo.html",
  ホ: "hgyo.html",
  ば: "hgyo.html",
  び: "hgyo.html",
  ぶ: "hgyo.html",
  べ: "hgyo.html",
  ぼ: "hgyo.html",
  ぱ: "hgyo.html",
  ぴ: "hgyo.html",
  ぷ: "hgyo.html",
  ぺ: "hgyo.html",
  ぽ: "hgyo.html",
  バ: "hgyo.html",
  ビ: "hgyo.html",
  ブ: "hgyo.html",
  ベ: "hgyo.html",
  ボ: "hgyo.html",
  パ: "hgyo.html",
  ピ: "hgyo.html",
  プ: "hgyo.html",
  ペ: "hgyo.html",
  ポ: "hgyo.html",
  ま: "mgyo.html",
  み: "mgyo.html",
  む: "mgyo.html",
  め: "mgyo.html",
  も: "mgyo.html",
  マ: "mgyo.html",
  ミ: "mgyo.html",
  ム: "mgyo.html",
  メ: "mgyo.html",
  モ: "mgyo.html",
  や: "ygyo.html",
  ゆ: "ygyo.html",
  よ: "ygyo.html",
  ヤ: "ygyo.html",
  ユ: "ygyo.html",
  ヨ: "ygyo.html",
  ら: "rgyo.html",
  り: "rgyo.html",
  る: "rgyo.html",
  れ: "rgyo.html",
  ろ: "rgyo.html",
  ラ: "rgyo.html",
  リ: "rgyo.html",
  ル: "rgyo.html",
  レ: "rgyo.html",
  ロ: "rgyo.html",
  わ: "wgyo.html",
  ゐ: "wgyo.html",
  ゑ: "wgyo.html",
  を: "wgyo.html",
  ん: "wgyo.html",
  ワ: "wgyo.html",
  ヰ: "wgyo.html",
  ヱ: "wgyo.html",
  ヲ: "wgyo.html",
  ン: "wgyo.html",
};

export type HdPosterHit = {
  url: string;
  source: "tenhow" | "amazon";
  asin?: string;
};

export type HdPosterEnhanceResult = {
  url: string | null;
  /** Amazon 请求失败（503/网络），strictMode 时应中止任务 */
  amazonHardFail: boolean;
  source: "tenhow" | "amazon" | null;
};

const INVALID_ACTORS = new Set([
  "",
  "未知演员",
  "未知演員",
  "女优不明",
  "女優不明",
  "素人",
  "素人(多人)",
  "素人（多人）",
]);

function normalizeCode(code: string): string {
  return code.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function isDmmImageUrl(url: string): boolean {
  return DMM_HOST_RE.test(url);
}

function actorCandidates(meta: ScrapeMeta): string[] {
  const out: string[] = [];
  for (const raw of meta.actors || []) {
    const name = raw.replace(/\s+/g, " ").trim();
    if (!name || INVALID_ACTORS.has(name)) continue;
    for (const part of name.split(/[,，、/]/)) {
      const p = part.trim();
      if (p && !INVALID_ACTORS.has(p)) out.push(p);
    }
    if (!out.includes(name)) out.push(name);
  }
  return out;
}

function kanaRowPage(name: string): string | null {
  const ch = [...name.trim()][0];
  if (!ch) return null;
  return KANA_ROW_PAGES[ch] ?? null;
}

function tenhowAbs(path: string): string {
  if (path.startsWith("http")) return path;
  return `${TENHOW_ORIGIN}/${path.replace(/^\//, "")}`;
}

/** Amazon 图片 URL 升清到 SL1500 */
export function normalizeAmazonImageUrl(url: string): string {
  const u = url.trim();
  if (!u.includes("m.media-amazon.com/images/I/")) return u;
  if (u.includes(".SL1500.")) return u;
  if (/\._[A-Z0-9_]+\./i.test(u)) {
    return u.replace(/\._[A-Z0-9_]+\./i, "._SL1500.");
  }
  if (/\.jpg$/i.test(u)) return u.replace(/\.jpg$/i, "._SL1500.jpg");
  return u;
}

export function parseTenhowActorLinks(html: string): Array<{ href: string; label: string; reading: string }> {
  const $ = cheerio.load(html);
  const out: Array<{ href: string; label: string; reading: string }> = [];
  $("#um_article a[href$='.html']").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (!href || href.includes("/") || href.startsWith("#")) return;
    const label = $(el).text().trim();
    if (!label) return;
    const tail = $(el).parent().text().replace(label, "").trim();
    const readingMatch = tail.match(/\(([^)]+)\)/);
    out.push({ href, label, reading: readingMatch?.[1]?.trim() || "" });
  });
  return out;
}

export function matchTenhowActorPage(
  links: Array<{ href: string; label: string; reading: string }>,
  actor: string,
): string | null {
  const target = actor.replace(/\s+/g, "").toLowerCase();
  for (const row of links) {
    const label = row.label.replace(/\s+/g, "").toLowerCase();
    const reading = row.reading.replace(/\s+/g, "").toLowerCase();
    if (label === target || reading === target) return row.href;
    if (label.includes(target) || target.includes(label)) return row.href;
    if (reading && (reading.includes(target) || target.includes(reading))) return row.href;
  }
  return null;
}

export function parseTenhowActorPoster(html: string, code: string): HdPosterHit | null {
  const norm = normalizeCode(code);
  if (!norm) return null;
  const blockRe =
    /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html))) {
    const block = m[2] || "";
    if (!block.toLowerCase().includes(norm) && !block.includes(code)) continue;
    const imgMatch = block.match(/href="images\/(B[0-9A-Z]{9,10})\.jpg"/i);
    if (!imgMatch) continue;
    const asin = imgMatch[1]!.toUpperCase();
    return {
      url: `${TENHOW_ORIGIN}/images/${asin}.jpg`,
      source: "tenhow",
      asin,
    };
  }
  // 整块未命中番号时，取页内第一个 ASIN 图（单作品页）
  const any = html.match(/href="images\/(B[0-9A-Z]{9,10})\.jpg"/i);
  if (any) {
    const asin = any[1]!.toUpperCase();
    return { url: `${TENHOW_ORIGIN}/images/${asin}.jpg`, source: "tenhow", asin };
  }
  return null;
}

export function parseAmazonSearchPoster(html: string): string | null {
  const $ = cheerio.load(html);
  const img =
    $('img[src*="m.media-amazon.com/images/I/"]').first().attr("src") ||
    $('img[data-src*="m.media-amazon.com/images/I/"]').first().attr("data-src");
  if (img) return normalizeAmazonImageUrl(img);
  const dp = html.match(/\/dp\/(B[0-9A-Z]{9,10})/i);
  if (dp) return null; // 留给 ASIN 详情页
  return null;
}

export function parseAmazonProductPoster(html: string): string | null {
  const og = html.match(/property="og:image"\s+content="([^"]+)"/i)?.[1];
  if (og?.includes("media-amazon")) return normalizeAmazonImageUrl(og);
  const landing = html.match(/id="landingImage"[^>]+src="([^"]+)"/i)?.[1];
  if (landing) return normalizeAmazonImageUrl(landing);
  const dyn = html.match(/m\.media-amazon\.com\/images\/I\/[^"'\s]+\.jpg/i)?.[0];
  if (dyn) return normalizeAmazonImageUrl(dyn);
  return null;
}

async function fetchHtml(url: string, signal?: AbortSignal): Promise<string> {
  const { fetchText } = await import("./network/fetch.js");
  return fetchText(url, { signal, access: "proxy" });
}

async function probeContentLength(url: string, signal?: AbortSignal): Promise<number> {
  try {
    const { request } = await import("undici");
    const { getNetworkConfig } = await import("../config/loadScrape.js");
    const timeoutMs = getNetworkConfig().requestTimeoutSec * 1000;
    const res = await request(url, {
      method: "HEAD",
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
    });
    const len = Number(res.headers["content-length"] || 0);
    await res.body.dump();
    return Number.isFinite(len) ? len : 0;
  } catch {
    return 0;
  }
}

async function probeImageWidth(url: string, signal?: AbortSignal): Promise<number> {
  try {
    const { fetchBuffer } = await import("./network/fetch.js");
    const buf = await fetchBuffer(url, { signal });
    const sharp = (await import("sharp")).default;
    const meta = await sharp(buf).metadata();
    return meta.width || 0;
  } catch {
    return 0;
  }
}

/** 已有封面足够清晰时跳过 Amazon/Tenhow 主动搜图 */
export async function shouldSkipHdPosterSearch(
  coverUrl: string | null | undefined,
  opts?: { coverFromAmazon?: boolean; signal?: AbortSignal },
): Promise<boolean> {
  const url = (coverUrl || "").trim();
  if (!url) return false;
  if (opts?.coverFromAmazon || isAmazonCoverUrl(url)) return false;

  if (isDmmImageUrl(url)) {
    const w = await probeImageWidth(url, opts?.signal);
    if (w >= DMM_HD_MIN_WIDTH) return true;
    if (w > 0 && w < 200) return false;
    if (w >= 700) return true;
    return false;
  }

  const bytes = await probeContentLength(url, opts?.signal);
  return bytes >= SKIP_AMAZON_MIN_BYTES;
}

export async function searchTenhowPoster(
  meta: ScrapeMeta,
  opts?: { signal?: AbortSignal },
): Promise<HdPosterHit | null> {
  const actors = actorCandidates(meta);
  if (!actors.length) return null;

  for (const actor of actors) {
    const rowPage = kanaRowPage(actor);
    if (!rowPage) continue;
    try {
      const indexHtml = await fetchHtml(tenhowAbs(rowPage), opts?.signal);
      const links = parseTenhowActorLinks(indexHtml);
      const page = matchTenhowActorPage(links, actor);
      if (!page) continue;
      const actorHtml = await fetchHtml(tenhowAbs(page), opts?.signal);
      const hit = parseTenhowActorPoster(actorHtml, meta.code);
      if (hit) return hit;
    } catch {
      /* try next actor */
    }
  }
  return null;
}

export async function searchAmazonPoster(
  meta: ScrapeMeta,
  opts?: { asinHint?: string; signal?: AbortSignal },
): Promise<{ hit: HdPosterHit | null; hardFail: boolean }> {
  const tryUrls: string[] = [];
  if (opts?.asinHint && ASIN_RE.test(opts.asinHint)) {
    tryUrls.push(`${AMAZON_ORIGIN}/dp/${opts.asinHint.toUpperCase()}`);
  }
  const title = (meta.title || meta.titleZh || "").trim();
  if (title) {
    tryUrls.push(
      `${AMAZON_ORIGIN}/s?k=${encodeURIComponent(`${title} DVD`)}&i=dvd`,
    );
  }
  if (meta.code) {
    tryUrls.push(`${AMAZON_ORIGIN}/s?k=${encodeURIComponent(meta.code)}&i=dvd`);
  }

  let hardFail = false;
  for (const url of tryUrls) {
    try {
      const html = await fetchHtml(url, opts?.signal);
      if (/503|Service Unavailable|Robot Check/i.test(html.slice(0, 2000))) {
        hardFail = true;
        continue;
      }
      let pic: string | null = null;
      if (url.includes("/dp/")) {
        pic = parseAmazonProductPoster(html);
      } else {
        pic = parseAmazonSearchPoster(html);
        if (!pic) {
          const asin = html.match(/\/dp\/(B[0-9A-Z]{9,10})/i)?.[1];
          if (asin) {
            const detailHtml = await fetchHtml(`${AMAZON_ORIGIN}/dp/${asin}`, opts?.signal);
            pic = parseAmazonProductPoster(detailHtml);
          }
        }
      }
      if (pic) {
        const asin = pic.match(ASIN_RE)?.[1]?.toUpperCase();
        return { hit: { url: pic, source: "amazon", asin }, hardFail: false };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/503|429|timeout|ECONNREFUSED|ETIMEDOUT/i.test(msg)) hardFail = true;
    }
  }
  return { hit: null, hardFail };
}

/**
 * 在 Provider 封面候选之外，按配置尝试 Tenhow → Amazon 高清补充。
 */
export async function enhanceCoverWithHdPosters(
  meta: ScrapeMeta,
  currentUrl: string | null | undefined,
  prefs: DownloadPrefs,
  opts?: { signal?: AbortSignal },
): Promise<HdPosterEnhanceResult> {
  if (!prefs.amazonHdPoster && !prefs.tenhowHdPoster) {
    return { url: currentUrl ?? null, amazonHardFail: false, source: null };
  }

  const coverFromAmazon = Boolean(currentUrl && isAmazonCoverUrl(currentUrl));
  if (
    await shouldSkipHdPosterSearch(currentUrl, {
      coverFromAmazon,
      signal: opts?.signal,
    })
  ) {
    return { url: currentUrl ?? null, amazonHardFail: false, source: null };
  }

  let tenhow: HdPosterHit | null = null;
  if (prefs.tenhowHdPoster) {
    tenhow = await searchTenhowPoster(meta, opts);
  }

  let amazon: HdPosterHit | null = null;
  let amazonHardFail = false;
  if (prefs.amazonHdPoster) {
    const r = await searchAmazonPoster(meta, {
      asinHint: tenhow?.asin,
      signal: opts?.signal,
    });
    amazon = r.hit;
    amazonHardFail = r.hardFail;
    if (prefs.amazonStrictMode && amazonHardFail && !amazon && !tenhow) {
      return { url: null, amazonHardFail: true, source: null };
    }
  }

  if (amazon?.url) {
    return { url: amazon.url, amazonHardFail: false, source: "amazon" };
  }
  if (tenhow?.url) {
    return { url: tenhow.url, amazonHardFail: false, source: "tenhow" };
  }
  return { url: currentUrl ?? null, amazonHardFail: amazonHardFail && prefs.amazonStrictMode, source: null };
}
