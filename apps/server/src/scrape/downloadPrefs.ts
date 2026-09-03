/** 封面下载偏好：Amazon 跳过、DMM 高清升级 */

export function isAmazonCoverUrl(url: string): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.includes("amazon.") ||
      host.includes("images-amazon.") ||
      host.includes("ssl-images-amazon.") ||
      host.includes("m.media-amazon.")
    );
  } catch {
    return /amazon\./i.test(url);
  }
}

/** DMM/部分源：缩略图 ps.jpg → 横版大图 pl.jpg */
export function preferHighResCoverUrl(url: string): string {
  if (!url) return url;
  return url.replace(/ps\.jpg(\?|$)/i, "pl.jpg$1");
}

/** 整理 thumb：pl.jpg → ps.jpg，已是 ps 或非 DMM 则保持 */
export function preferThumbCoverUrl(url: string): string {
  if (!url) return url;
  if (/ps\.jpg(\?|$)/i.test(url)) return url;
  return url.replace(/pl\.jpg(\?|$)/i, "ps.jpg$1");
}

/** 流媒体预览 / 第三方 vod 缩略图，不宜作封面 */
export function isJunkCoverUrl(url: string): boolean {
  const raw = String(url || "").trim();
  if (!raw) return false;
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    const path = `${u.pathname}${u.search}`.toLowerCase();
    if (/tukaka\.space|iqqk\d*\.(quest|xyz)/i.test(host)) return true;
    if (/\/m3u8\//i.test(path)) return true;
    if (/\/vod\.jpg/i.test(path) && !/dmm\.co\.jp|awsimgsrc\.dmm/i.test(host)) return true;
    return false;
  } catch {
    return /tukaka\.space|\/m3u8\/|\/vod\.jpg/i.test(raw);
  }
}

/** 合并封面优先，垃圾 URL 置后 */
export function orderCoverDownloadCandidates(
  primaryUrl: string | null | undefined,
  candidates: string[],
): string[] {
  const seen = new Set<string>();
  const good: string[] = [];
  const junk: string[] = [];
  const push = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    (isJunkCoverUrl(trimmed) ? junk : good).push(trimmed);
  };
  if (primaryUrl) push(primaryUrl);
  for (const url of candidates) push(url);
  return [...good, ...junk];
}

export type DownloadPrefs = {
  downloadPoster: boolean;
  downloadThumb: boolean;
  preferHighResPoster: boolean;
  skipAmazon: boolean;
  amazonHdPoster: boolean;
  tenhowHdPoster: boolean;
  amazonStrictMode: boolean;
};

/**
 * 从候选封面 URL 中选出刮削阶段下载地址。
 * - 关闭 poster 且关闭 thumb → null（不下缓存；整理阶段亦不会写出对应文件）
 * - 任一开启 → 下载一张封面原图供整理分别生成 poster.jpg / thumb.jpg（MDC-NG 语义）
 * - skipAmazon 时过滤 Amazon 图；若过滤后为空则 null
 * - preferHighRes 时尝试 ps→pl
 */
export function pickCoverUrlForDownload(
  candidates: string[],
  prefs: DownloadPrefs,
): string | null {
  if (!prefs.downloadPoster && !prefs.downloadThumb) return null;

  let urls = [...new Set(candidates.map((u) => u.trim()).filter(Boolean))];
  if (prefs.skipAmazon) {
    urls = urls.filter((u) => !isAmazonCoverUrl(u));
  }
  const nonJunk = urls.filter((u) => !isJunkCoverUrl(u));
  if (nonJunk.length) urls = nonJunk;
  if (!urls.length) return null;

  let url = urls[0]!;
  if (prefs.preferHighResPoster) {
    url = preferHighResCoverUrl(url);
  }
  return url;
}
