import type { FileRow, ScrapeMetaView } from "../types";
import { displayRelativePath, toRelativePath } from "./paths";

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

type ImageProxyCtx = {
  pageUrl?: string | null;
  sourceId?: string | null;
};

/** 远程图片走服务端代理，避免 CDN Referer/Cookie 限制 */
export function resolveProxiedImageSrc(
  url: string | null | undefined,
  ctx?: ImageProxyCtx,
): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith("/api/")) return trimmed;
  if (!isHttpUrl(trimmed)) return trimmed;
  const params = new URLSearchParams({ url: trimmed });
  const pageUrl = ctx?.pageUrl?.trim();
  const sourceId = ctx?.sourceId?.trim();
  if (pageUrl && isHttpUrl(pageUrl)) params.set("pageUrl", pageUrl);
  if (sourceId) params.set("source", sourceId);
  return `/api/files/image-proxy?${params.toString()}`;
}

function imageProxyCtx(meta: ScrapeMetaView | null | undefined): ImageProxyCtx {
  return {
    pageUrl: meta?.website,
    sourceId: meta?.fieldSources?.cover || meta?.source,
  };
}

function galleryProxyCtx(meta: ScrapeMetaView | null | undefined): ImageProxyCtx {
  return {
    pageUrl: meta?.website,
    sourceId: meta?.fieldSources?.extrafanart || meta?.source,
  };
}

/** 是否为可点击的远程封面地址 */
function pickHttpUrl(raw: unknown): string {
  const u = String(raw ?? "").trim();
  return isHttpUrl(u) ? u : "";
}

function collectRemoteCoverUrls(
  meta: ScrapeMetaView | null,
  file?: FileRow | null,
): string[] {
  const urls: string[] = [];
  const add = (raw: unknown) => {
    const http = pickHttpUrl(raw);
    if (http && !urls.includes(http)) urls.push(http);
  };
  add(meta?.coverUrl);
  add(file?.cover_url);
  const coverSource = meta?.fieldSources?.cover;
  if (coverSource && meta?.sourceSnapshots?.[coverSource]) {
    const snap = meta.sourceSnapshots[coverSource];
    add(snap.coverUrl);
    for (const u of snap.alternateCoverUrls ?? []) add(u);
    for (const key of ["coverUrl", "cover", "thumbUrl", "posterUrl"]) {
      add(snap.fields?.[key]);
    }
  }
  for (const snap of Object.values(meta?.sourceSnapshots ?? {})) {
    add(snap.coverUrl);
    for (const u of snap.alternateCoverUrls ?? []) add(u);
    for (const key of ["coverUrl", "cover", "thumbUrl", "posterUrl"]) {
      add(snap.fields?.[key]);
    }
  }
  for (const u of meta?.extrafanartUrls ?? []) add(u);
  return urls;
}

function pickThumbUrl(urls: string[]): string {
  if (!urls.length) return "";
  return urls.find((u) => /ps\.jpg(\?|$)/i.test(u)) || urls[0] || "";
}

function pickPosterUrlFromList(urls: string[]): string {
  if (!urls.length) return "";
  return urls.find((u) => /pl\.jpg(\?|$)/i.test(u)) || urls[urls.length - 1] || urls[0] || "";
}

/** 从元数据/源快照解析远程封面 URL（不含本地缓存路径） */
export function resolveRemoteCoverUrl(
  meta: ScrapeMetaView | null,
  file?: FileRow | null,
): string {
  const urls = collectRemoteCoverUrls(meta, file);
  if (urls.length) return urls[0];
  return "";
}

/** 远程缩略图 URL（封面字段，优先 ps.jpg） */
export function resolveRemoteThumbUrl(
  meta: ScrapeMetaView | null,
  file?: FileRow | null,
): string {
  return pickThumbUrl(collectRemoteCoverUrls(meta, file));
}

/** 远程海报 URL（海报字段，优先 pl.jpg；不含本地路径） */
export function resolveRemotePosterUrl(
  meta: ScrapeMetaView | null,
  file?: FileRow | null,
): string {
  return pickPosterUrlFromList(collectRemoteCoverUrls(meta, file));
}

/** 远程封面 URL（编辑弹窗「封面」字段、详情「封面」行） */
export function resolveCoverUrl(meta: ScrapeMetaView | null, file?: FileRow | null): string {
  return resolveRemoteThumbUrl(meta, file) || resolveRemoteCoverUrl(meta, file);
}

const DMM_CID_IN_URL =
  /(?:pics\.dmm\.co\.jp|awsimgsrc\.dmm\.co\.jp|pics\.dmm\.com|jp\.netcdn\.space)\/(?:pics_dig\/)?digital\/video\/([a-z0-9]+)\//i;

function extractDmmCidFromUrl(url: string | null | undefined): string | null {
  const s = String(url || "").trim();
  if (!s) return null;
  const m = s.match(DMM_CID_IN_URL);
  return m?.[1] ? m[1].toLowerCase() : null;
}

/** 番号 → DMM CID 兜底（如 SONE-999 → sone00999） */
function guessPublishNumberFromCode(codeRaw: string): string | null {
  const code = String(codeRaw || "").trim().toUpperCase();
  if (!code || /^FC2/i.test(code)) return null;
  const m = code.match(/^([A-Z0-9]{2,10})-(\d{1,6})$/);
  if (!m) return null;
  const series = m[1]!.toLowerCase();
  const padded = String(Number(m[2])).padStart(5, "0");
  return `${series}${padded}`;
}

/** 发行码（DMM CID）；旧缓存无字段时从封面/官网 URL 推断 */
export function resolvePublishNumber(
  meta: ScrapeMetaView | null,
  file?: FileRow | null,
): string | null {
  const direct = String(meta?.publishNumber || "").trim();
  if (direct) return direct;

  for (const snap of Object.values(meta?.sourceSnapshots ?? {})) {
    const fromSnap = String(
      snap.fields?.publishNumber ?? snap.fields?.productId ?? "",
    ).trim();
    if (fromSnap) return fromSnap.toLowerCase();
  }

  for (const url of collectRemoteCoverUrls(meta, file)) {
    const cid = extractDmmCidFromUrl(url);
    if (cid) return cid;
  }

  const website = String(meta?.website || "").trim();
  const cidMatch = website.match(/cid=([a-z0-9]+)/i);
  if (cidMatch?.[1]) return cidMatch[1].toLowerCase();

  const code = String(meta?.code || file?.code || "").trim();
  if (code) {
    const guessed = guessPublishNumberFromCode(code);
    if (guessed) return guessed;
  }

  return null;
}

/** 本地海报路径（仅内部资源加载；详情展示请用 resolveRemotePosterUrl） */
export function resolvePosterUrl(meta: ScrapeMetaView | null, file?: FileRow | null): string {
  if (meta?.coverLocal?.trim()) return displayRelativePath(meta.coverLocal);
  return resolveRemotePosterUrl(meta, file);
}

/** 详情页资源 URL 防缓存版本（刮削/整理后刷新缩略图） */
export function fileAssetVersion(
  file?: FileRow | null,
  meta?: ScrapeMetaView | null,
): number {
  const scraped = Number(file?.scraped_at);
  const organized = Number(file?.organized_at);
  const mtime = Number(file?.file_mtime);
  const metaTs = meta?.scrapedAt ? Date.parse(meta.scrapedAt) : 0;
  return Math.max(
    Number.isFinite(scraped) ? scraped : 0,
    Number.isFinite(organized) ? organized : 0,
    Number.isFinite(mtime) ? mtime : 0,
    Number.isFinite(metaTs) ? metaTs : 0,
  );
}

export function appendAssetCacheBust(
  url: string,
  file?: FileRow | null,
  meta?: ScrapeMetaView | null,
): string {
  const version = fileAssetVersion(file, meta);
  if (version > 0) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}v=${version}`;
  }
  if (meta?.scrapedAt?.trim()) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}v=${encodeURIComponent(meta.scrapedAt.trim())}`;
  }
  return url;
}

/** 详情页 poster：优先本地 poster.jpg，否则缓存/远程代理 */
export function resolveCoverImageSrc(
  meta: ScrapeMetaView | null,
  file?: FileRow | null,
): string | null {
  if (file?.id) {
    return appendAssetCacheBust(`/api/files/${file.id}/asset/poster`, file, meta);
  }
  const kind = meta?.kind || file?.kind;
  const code = meta?.code || file?.code;
  if (meta?.coverLocal?.trim() && kind && code) {
    return appendAssetCacheBust(
      `/api/files/cover/${encodeURIComponent(kind)}/${encodeURIComponent(code)}`,
      file,
      meta,
    );
  }
  const remote = resolveCoverUrl(meta, file);
  const proxied = resolveProxiedImageSrc(remote, imageProxyCtx(meta));
  return proxied ? appendAssetCacheBust(proxied, file, meta) : null;
}

/** 详情页画廊：thumb + 剧照（无剧照时仅 thumb） */
export function resolveGalleryImageSrcs(
  meta: ScrapeMetaView | null,
  file?: FileRow | null,
): string[] {
  const withBust = (url: string) => appendAssetCacheBust(url, file, meta);

  if (file?.id) {
    const urls: string[] = [withBust(`/api/files/${file.id}/asset/thumb`)];
    const fanartCount = Math.max(
      meta?.extrafanartLocal?.length ?? 0,
      meta?.extrafanartUrls?.length ?? 0,
    );
    for (let i = 1; i <= fanartCount; i++) {
      urls.push(withBust(`/api/files/${file.id}/asset/fanart/${i}`));
    }
    return urls;
  }

  const urls: string[] = [];
  const seen = new Set<string>();
  const thumbRemote = resolveRemoteThumbUrl(meta, file) || resolveRemoteCoverUrl(meta, file);
  for (const u of meta?.extrafanartUrls ?? []) {
    if (!u || seen.has(u)) continue;
    seen.add(u);
    const proxied = resolveProxiedImageSrc(u, galleryProxyCtx(meta));
    if (proxied) urls.push(withBust(proxied));
  }
  if (!urls.length && thumbRemote) {
    const proxied = resolveProxiedImageSrc(thumbRemote, galleryProxyCtx(meta));
    if (proxied) urls.push(withBust(proxied));
  }
  return urls;
}

/** 画廊单项（保留兼容） */
export function resolveGalleryImageSrc(
  url: string,
  meta?: ScrapeMetaView | null,
): string | null {
  return resolveProxiedImageSrc(url, galleryProxyCtx(meta));
}

/** 封面/海报字段的数据源 badge */
export function resolveCoverSource(meta: ScrapeMetaView | null): string {
  const fs = meta?.fieldSources ?? {};
  return fs.cover || fs.coverUrl || fs.poster || meta?.source || "";
}

export function formatMetaLinkValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (isHttpUrl(trimmed)) return trimmed;
  return toRelativePath(trimmed) || trimmed;
}
