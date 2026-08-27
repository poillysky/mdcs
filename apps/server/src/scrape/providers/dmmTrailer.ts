/** DMM 样片 URL 构建（对齐 MDCX dmm_new） */

const TRAILER_QUALITY = [
  { re: /4k/i, rank: 120 },
  { re: /hhb/i, rank: 100 },
  { re: /mhb/i, rank: 80 },
  { re: /mmb/i, rank: 60 },
  { re: /sm/i, rank: 40 },
];

export function trailerQualityRank(url: string): number {
  for (const { re, rank } of TRAILER_QUALITY) {
    if (re.test(url)) return rank;
  }
  return /\.mp4/i.test(url) ? 20 : 0;
}

export function withHttps(url: string): string {
  const s = String(url || "").trim().replace(/\\\//g, "/");
  if (!s) return "";
  if (s.startsWith("//")) return `https:${s}`;
  return s;
}

/** hls playlist → litevideo mp4；已是 mp4 则原样返回 */
export function buildFanzaTrailerUrl(sampleMovieUrl: string): string {
  const raw = withHttps(sampleMovieUrl);
  if (!raw) return "";
  if (/\.mp4(?:[?#].*)?$/i.test(raw)) return raw;
  const trailerUrl = raw.replace(/hlsvideo/gi, "litevideo");
  if (/\/pv\//i.test(trailerUrl) && /playlist\.m3u8/i.test(trailerUrl)) return "";
  const cidMatch = trailerUrl.match(/\/([^/]+)\/playlist\.m3u8/i);
  if (cidMatch?.[1]) {
    return trailerUrl.replace(/playlist\.m3u8/i, `${cidMatch[1]}_sm_w.mp4`);
  }
  return "";
}

export function buildFreepvTrailerFromCid(cid: string, qualitySuffix = "_hhb_w"): string {
  const id = String(cid || "").trim().toLowerCase();
  if (!id) return "";
  return `https://cc3001.dmm.co.jp/litevideo/freepv/${id[0]}/${id.slice(0, 3)}/${id}/${id}${qualitySuffix}.mp4`;
}

export function pickBestTrailer(candidates: string[]): string | undefined {
  let best = "";
  let bestRank = -1;
  for (const raw of candidates) {
    const built = buildFanzaTrailerUrl(raw);
    const url = built || (/\.mp4(?:[?#].*)?$/i.test(withHttps(raw)) ? withHttps(raw) : "");
    if (!url || /\.m3u8/i.test(url)) continue;
    const rank = trailerQualityRank(url);
    if (rank > bestRank) {
      best = url;
      bestRank = rank;
    }
  }
  return best || undefined;
}

export function buildTrailerCandidates(
  cid: string,
  sample2d?: { highestMovieUrl?: string | null; hlsMovieUrl?: string | null } | null,
  sampleVr?: { highestMovieUrl?: string | null } | null,
): string[] {
  const out: string[] = [];
  const push = (u?: string | null) => {
    const s = withHttps(u || "");
    if (s && !out.includes(s)) out.push(s);
  };
  push(sampleVr?.highestMovieUrl);
  push(sample2d?.highestMovieUrl);
  push(sample2d?.hlsMovieUrl);
  for (const suffix of ["_hhb_w", "_4k_w", "_mhb_w", "_sm_w"]) {
    push(buildFreepvTrailerFromCid(cid, suffix));
  }
  return out;
}

/** GraphQL 详情路径：仅用 API 返回的样片 URL（对齐 MDCX fetch_digital） */
export function buildGraphqlTrailerCandidates(
  sample2d?: { highestMovieUrl?: string | null; hlsMovieUrl?: string | null } | null,
  sampleVr?: { highestMovieUrl?: string | null } | null,
): string[] {
  const out: string[] = [];
  const push = (u?: string | null) => {
    const s = withHttps(u || "");
    if (s && !out.includes(s)) out.push(s);
  };
  push(sampleVr?.highestMovieUrl);
  push(sample2d?.highestMovieUrl);
  const hls = buildFanzaTrailerUrl(sample2d?.hlsMovieUrl || "");
  if (hls) push(hls);
  return out;
}
