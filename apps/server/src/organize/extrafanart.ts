import fs from "node:fs";
import path from "node:path";
import { fetchBuffer } from "../scrape/network/fetch.js";
import { isAvsexCdnUrl, isNetcdnImageUrl, resolveCoverImageReferer } from "../scrape/network/imageReferer.js";
import { downloadAvsexCdnImage, downloadNetcdnImage } from "../scrape/network/coverDownload.js";
import { cookieForUrl } from "../scrape/network/sourceCookies.js";
import { ensureDir } from "../paths.js";

export type DownloadExtrafanartOpts = {
  signal?: AbortSignal;
  referer?: string;
  sourceId?: string;
  force?: boolean;
  dryRun?: boolean;
};

async function fetchExtrafanartBuffer(
  url: string,
  opts: DownloadExtrafanartOpts,
): Promise<Buffer | null> {
  const referer = resolveCoverImageReferer(url, { pageUrl: opts.referer, sourceId: opts.sourceId }) || opts.referer || "";
  if (isNetcdnImageUrl(url)) {
    const buf = await downloadNetcdnImage(url, { pageUrl: opts.referer, referer, sourceId: opts.sourceId });
    if (buf?.length) return buf;
  }
  if (isAvsexCdnUrl(url)) {
    const buf = await downloadAvsexCdnImage(url, { pageUrl: opts.referer, referer });
    if (buf?.length) return buf;
  }
  try {
    return await fetchBuffer(url, {
      signal: opts.signal,
      referer,
      cookie: cookieForUrl(url, opts.sourceId),
      timeoutMs: 30_000,
    });
  } catch {
    return null;
  }
}

/** 下载剧照到 `{movieDir}/extrafanart/1.jpg` …（Emby/Kodi 约定） */
export async function downloadExtrafanartToDir(
  movieDir: string,
  urls: string[],
  opts: DownloadExtrafanartOpts = {},
): Promise<string[]> {
  const unique = [...new Set(urls.filter(Boolean))];
  if (!unique.length) return [];

  const outDir = path.join(movieDir, "extrafanart");
  if (!opts.dryRun) ensureDir(outDir);

  const saved: string[] = [];
  for (let i = 0; i < unique.length; i++) {
    const url = unique[i]!;
    const ext = url.match(/\.(jpe?g|png|webp)(\?|$)/i)?.[1]?.toLowerCase() ?? "jpg";
    const dest = path.join(outDir, `${i + 1}.${ext}`);
    if (!opts.force && fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      saved.push(dest);
      continue;
    }
    if (opts.dryRun) {
      saved.push(dest);
      continue;
    }
    const buf = await fetchExtrafanartBuffer(url, opts);
    if (!buf?.length) continue;
    fs.writeFileSync(dest, buf);
    saved.push(dest);
  }
  return saved;
}
