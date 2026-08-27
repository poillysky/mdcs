/**
 * CF 保护 CDN 封面下载（对齐 MDCX async_client CF bypass 语义）。
 * image.avsex.cc：先暖 avsex.cc 会话，curl 失败再对 CDN host 单独过盾后 curl。
 */
import { fetchBinaryViaCurl } from "./download.js";
import {
  fetchViaFlareSolverrFull,
  getCachedClearance,
  mergeCookieHeaders,
  registerFlareHost,
} from "./flaresolverr.js";
import { isAvsexCdnUrl, isLulubarCdnUrl, isNetcdnImageUrl, isXchinaCdnUrl, resolveCoverImageReferer } from "./imageReferer.js";

function mirrorNetcdnToDmm(url: string): string | null {
  if (!url || !isNetcdnImageUrl(url)) return null;
  return url.replace(/https?:\/\/[^/]*netcdn\.space/i, "https://pics.dmm.co.jp");
}

/** Avmoo/AIO netcdn：代理常超时，优先直连 curl + 正确 Referer */
export async function downloadNetcdnImage(
  imageUrl: string,
  opts?: { pageUrl?: string; referer?: string; sourceId?: string; timeoutMs?: number },
): Promise<Buffer | null> {
  const referer =
    opts?.referer ||
    resolveCoverImageReferer(imageUrl, { sourceId: opts?.sourceId || "avmoo", pageUrl: opts?.pageUrl });
  const timeoutMs = opts?.timeoutMs ?? 25_000;

  let buf = await fetchBinaryViaCurl(imageUrl, { timeoutMs, referer, direct: true });
  if (buf) return buf;

  buf = await fetchBinaryViaCurl(imageUrl, { timeoutMs, referer });
  if (buf) return buf;

  const dmm = mirrorNetcdnToDmm(imageUrl);
  if (!dmm || dmm === imageUrl) return null;
  buf = await fetchBinaryViaCurl(dmm, {
    timeoutMs,
    referer: "https://www.dmm.co.jp/",
    direct: true,
  });
  if (buf) {
    console.log(`[scrape] netcdn-fallback dmm host=pics.dmm.co.jp ${buf.length}b`);
    return buf;
  }
  return fetchBinaryViaCurl(dmm, { timeoutMs, referer: "https://www.dmm.co.jp/" });
}

export async function downloadAvsexCdnImage(
  imageUrl: string,
  opts?: { pageUrl?: string; referer?: string; timeoutMs?: number },
): Promise<Buffer | null> {
  const referer =
    opts?.referer ||
    resolveCoverImageReferer(imageUrl, { sourceId: "avsex", pageUrl: opts?.pageUrl });
  const warmUrl = opts?.pageUrl || "https://avsex.cc/";
  const timeoutMs = opts?.timeoutMs ?? 30_000;

  registerFlareHost(imageUrl);

  let cookie = getCachedClearance(warmUrl)?.cookieHeader || "";
  let userAgent = getCachedClearance(warmUrl)?.userAgent || "";
  if (!cookie) {
    const warm = await fetchViaFlareSolverrFull(warmUrl, { timeoutMs: 50_000 });
    cookie = warm.cookieHeader || "";
    userAgent = warm.userAgent || "";
  }

  let buf = await fetchBinaryViaCurl(imageUrl, {
    timeoutMs,
    referer,
    cookie,
    userAgent: userAgent || undefined,
  });
  if (buf) return buf;

  const cdnHit = await fetchViaFlareSolverrFull(imageUrl, {
    timeoutMs: 50_000,
    cookie: cookie || undefined,
  });
  const raw = cdnHit.html || "";
  const fromFlare = Buffer.from(raw, "latin1");
  if (fromFlare.length > 1024 && fromFlare[0] === 0xff && fromFlare[1] === 0xd8) {
    console.log(`[scrape] flare-bin ok host=${new URL(imageUrl).hostname} ${fromFlare.length}b`);
    return fromFlare;
  }
  const merged = mergeCookieHeaders(cookie, cdnHit.cookieHeader);
  buf = await fetchBinaryViaCurl(imageUrl, {
    timeoutMs,
    referer,
    cookie: merged,
    userAgent: cdnHit.userAgent || userAgent || undefined,
  });
  return buf;
}

/** image.lulubar.co 与主站 cf_clearance 不互通，需对 CDN host 单独过盾后 curl */
export async function downloadLulubarCdnImage(
  imageUrl: string,
  opts?: { pageUrl?: string; referer?: string; timeoutMs?: number },
): Promise<Buffer | null> {
  const referer =
    opts?.referer ||
    resolveCoverImageReferer(imageUrl, { sourceId: "lulubar", pageUrl: opts?.pageUrl });
  const warmUrl = opts?.pageUrl || "https://lulubar.co/";
  const timeoutMs = opts?.timeoutMs ?? 30_000;

  registerFlareHost(imageUrl);
  registerFlareHost(warmUrl);

  const siteHit = getCachedClearance(warmUrl);
  const cdnHit = getCachedClearance(imageUrl);
  let cookie = mergeCookieHeaders(siteHit?.cookieHeader, cdnHit?.cookieHeader);
  let userAgent = cdnHit?.userAgent || siteHit?.userAgent || "";

  if (cookie) {
    const quick = await fetchBinaryViaCurl(imageUrl, {
      timeoutMs,
      referer,
      cookie,
      userAgent: userAgent || undefined,
      secFetchImage: true,
    });
    if (quick) return quick;
  }

  const flareHit = await fetchViaFlareSolverrFull(imageUrl, {
    timeoutMs: 50_000,
    cookie: siteHit?.cookieHeader || undefined,
  });
  const raw = flareHit.html || "";
  const fromFlare = Buffer.from(raw, "latin1");
  if (fromFlare.length > 1024 && fromFlare[0] === 0xff && fromFlare[1] === 0xd8) {
    console.log(`[scrape] flare-bin ok host=${new URL(imageUrl).hostname} ${fromFlare.length}b`);
    return fromFlare;
  }

  cookie = mergeCookieHeaders(siteHit?.cookieHeader, cdnHit?.cookieHeader, flareHit.cookieHeader);
  userAgent = flareHit.userAgent || userAgent;
  return fetchBinaryViaCurl(imageUrl, {
    timeoutMs,
    referer,
    cookie,
    userAgent: userAgent || undefined,
    secFetchImage: true,
  });
}

export async function downloadFlareProtectedCoverImage(
  imageUrl: string,
  opts?: {
    pageUrl?: string;
    referer?: string;
    sourceId?: string;
    timeoutMs?: number;
  },
): Promise<Buffer | null> {
  if (isNetcdnImageUrl(imageUrl)) {
    return downloadNetcdnImage(imageUrl, opts);
  }
  if (isAvsexCdnUrl(imageUrl)) {
    return downloadAvsexCdnImage(imageUrl, opts);
  }
  if (isXchinaCdnUrl(imageUrl) || opts?.sourceId === "xiao_huang_shu") {
    const referer =
      opts?.referer ||
      resolveCoverImageReferer(imageUrl, { sourceId: "xiao_huang_shu", pageUrl: opts?.pageUrl });
    const timeoutMs = opts?.timeoutMs ?? 25_000;
    const direct = await fetchBinaryViaCurl(imageUrl, { timeoutMs, referer, direct: true });
    if (direct) return direct;
    return fetchBinaryViaCurl(imageUrl, { timeoutMs, referer });
  }
  if (isLulubarCdnUrl(imageUrl) || opts?.sourceId === "lulubar") {
    return downloadLulubarCdnImage(imageUrl, opts);
  }
  return null;
}
