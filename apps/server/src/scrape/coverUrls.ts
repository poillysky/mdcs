import { preferThumbCoverUrl } from "./downloadPrefs.js";
import type { ScrapeMeta } from "./types.js";

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function collectMetaCoverUrls(meta: ScrapeMeta): string[] {
  const urls: string[] = [];
  const add = (raw: unknown) => {
    const u = String(raw ?? "").trim();
    if (isHttpUrl(u) && !urls.includes(u)) urls.push(u);
  };
  add(meta.coverUrl);
  const coverSource = meta.fieldSources?.cover;
  if (coverSource && meta.sourceSnapshots?.[coverSource]) {
    const snap = meta.sourceSnapshots[coverSource];
    add(snap.coverUrl);
    for (const u of snap.alternateCoverUrls ?? []) add(u);
    for (const key of ["coverUrl", "cover", "thumbUrl", "posterUrl"]) {
      add(snap.fields?.[key]);
    }
  }
  for (const snap of Object.values(meta.sourceSnapshots ?? {})) {
    add(snap.coverUrl);
    for (const u of snap.alternateCoverUrls ?? []) add(u);
    for (const key of ["coverUrl", "cover", "thumbUrl", "posterUrl"]) {
      add(snap.fields?.[key]);
    }
  }
  return urls;
}

/** DMM 竖版海报 pl.jpg */
export function pickRemotePosterUrl(meta: ScrapeMeta): string | null {
  const urls = collectMetaCoverUrls(meta);
  const pick =
    urls.find((u) => /pl\.jpg(\?|$)/i.test(u)) ||
    urls[urls.length - 1] ||
    String(meta.coverUrl ?? "").trim();
  return pick && isHttpUrl(pick) ? pick : null;
}

/** DMM 横版缩略图 ps.jpg（画廊 thumb 原样保留） */
export function pickRemoteThumbUrl(meta: ScrapeMeta): string | null {
  const urls = collectMetaCoverUrls(meta);
  const pick =
    urls.find((u) => /ps\.jpg(\?|$)/i.test(u)) ||
    urls[0] ||
    String(meta.coverUrl ?? "").trim();
  return pick && isHttpUrl(pick) ? pick : null;
}

/** 整理 thumb 下载地址（优先 ps.jpg 横版） */
export function resolveThumbDownloadUrl(meta: ScrapeMeta): string | null {
  const remote = pickRemoteThumbUrl(meta);
  if (remote) return remote;
  const base = String(meta.coverUrl ?? "").trim();
  if (!base || !/^https?:\/\//i.test(base)) return null;
  return preferThumbCoverUrl(base);
}
