/** Jav321 DMM 图片校验 — 对齐 MDCX mdcx/crawlers/jav321.py */

export type Jav321CheckUrlFn = (url: string) => Promise<string | null>;

export function normalizeMediaUrl(url: string): string {
  const raw = String(url || "").trim();
  if (!raw) return "";
  try {
    const normalized = raw.startsWith("//") ? `https:${raw}` : raw;
    const u = new URL(normalized);
    if (/\.dmm\.(co\.jp|com)$/i.test(u.hostname)) {
      u.pathname = u.pathname.replace(/\/{2,}/g, "/");
    }
    return u.toString().replace(/\?$/, "");
  } catch {
    return raw.replace(/\?$/, "");
  }
}

export function isDmmImageUrl(url: string): boolean {
  const normalized = normalizeMediaUrl(url);
  if (!normalized) return false;
  try {
    const u = new URL(normalized.startsWith("//") ? `https:${normalized}` : normalized);
    const host = u.hostname.toLowerCase();
    if (!host.endsWith("dmm.co.jp") && !host.endsWith("dmm.com")) return false;
    return /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function preferDmmAwsUrl(url: string): string {
  const normalized = normalizeMediaUrl(url);
  if (!normalized) return "";
  if (normalized.includes("pics.dmm.co.jp")) {
    return normalized
      .replace("pics.dmm.co.jp", "awsimgsrc.dmm.co.jp/pics_dig")
      .replace("/adult/", "/");
  }
  return normalized;
}

export function iterDmmImageCandidates(url: string): string[] {
  const normalized = normalizeMediaUrl(url);
  if (!normalized) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const candidate of [preferDmmAwsUrl(normalized), normalized]) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    out.push(candidate);
  }
  return out;
}

export function toPosterUrl(thumbUrl: string): string {
  const normalized = normalizeMediaUrl(thumbUrl);
  if (normalized.endsWith("pl.jpg")) return `${normalized.slice(0, -6)}ps.jpg`;
  return normalized;
}

export function normalizeExtrafanartUrls(imageUrls: string[]): string[] {
  const valid: string[] = [];
  for (const imageUrl of imageUrls) {
    const normalized = normalizeMediaUrl(imageUrl);
    if (normalized && !valid.includes(normalized)) valid.push(normalized);
  }
  return valid;
}

export function imageMatchKey(url: string): string {
  const normalized = normalizeMediaUrl(url);
  if (!normalized) return "";
  if (!isDmmImageUrl(normalized)) return normalized;
  try {
    const u = new URL(normalized.startsWith("//") ? `https:${normalized}` : normalized);
    let path = u.pathname;
    if (u.hostname.toLowerCase() === "awsimgsrc.dmm.co.jp" && path.startsWith("/pics_dig/")) {
      path = path.slice("/pics_dig".length);
    }
    return path.replace("/adult/", "/");
  } catch {
    return normalized;
  }
}

export function removeCoverFromExtrafanart(coverUrl: string, imageUrls: string[]): string[] {
  const coverKey = imageMatchKey(coverUrl);
  if (!coverKey) return imageUrls;
  return imageUrls.filter((imageUrl) => imageMatchKey(imageUrl) !== coverKey);
}

export async function validateDmmImageIfNeeded(
  url: string,
  _label: string,
  checkUrl: Jav321CheckUrlFn,
): Promise<string> {
  const normalized = normalizeMediaUrl(url);
  if (!normalized) return "";
  if (!isDmmImageUrl(normalized)) return normalized;

  for (const candidate of iterDmmImageCandidates(normalized)) {
    const validated = await checkUrl(candidate);
    if (!validated) continue;
    return normalizeMediaUrl(validated);
  }
  return "";
}

export async function validatePreferredDmmImageIfNeeded(
  url: string,
  _label: string,
  checkUrl: Jav321CheckUrlFn,
): Promise<string> {
  const normalized = normalizeMediaUrl(url);
  if (!normalized) return "";
  const preferred = preferDmmAwsUrl(normalized);
  if (!isDmmImageUrl(preferred)) return preferred;

  const validated = await checkUrl(preferred);
  if (!validated) return "";
  return normalizeMediaUrl(validated);
}

export type PickSampleIndexesFn = (length: number) => number[];

function defaultPickSampleIndexes(length: number): number[] {
  const indexes = Array.from({ length }, (_, i) => i);
  if (length <= 3) return indexes;
  const picked = new Set<number>();
  while (picked.size < 3) {
    picked.add(Math.floor(Math.random() * length));
  }
  return [...picked].sort((a, b) => a - b);
}

export async function filterDmmExtrafanart(
  imageUrls: string[],
  checkUrl: Jav321CheckUrlFn,
  pickSampleIndexes: PickSampleIndexesFn = defaultPickSampleIndexes,
): Promise<string[]> {
  const candidates = normalizeExtrafanartUrls(imageUrls);
  if (!candidates.length) return [];

  const sampleIndexes = pickSampleIndexes(candidates.length);
  const sampledCandidates = sampleIndexes.map((index) => [index, candidates[index]!] as const);
  const sampledResults = await Promise.all(
    sampledCandidates.map(([index, imageUrl]) =>
      validatePreferredDmmImageIfNeeded(imageUrl, `extrafanart[${index + 1}]`, checkUrl),
    ),
  );
  const validatedByIndex = new Map<number, string>();
  sampledCandidates.forEach(([index], i) => {
    const validated = sampledResults[i];
    if (validated) validatedByIndex.set(index, validated);
  });

  if (sampledResults.every(Boolean)) {
    const validUrls: string[] = [];
    for (const [index, imageUrl] of candidates.entries()) {
      const resolved = validatedByIndex.get(index) || preferDmmAwsUrl(imageUrl) || imageUrl;
      if (!validUrls.includes(resolved)) validUrls.push(resolved);
    }
    return validUrls;
  }

  const remainingCandidates = candidates
    .map((imageUrl, index) => [index, imageUrl] as const)
    .filter(([index]) => !validatedByIndex.get(index));
  if (remainingCandidates.length) {
    const remainingResults = await Promise.all(
      remainingCandidates.map(([index, imageUrl]) =>
        validateDmmImageIfNeeded(imageUrl, `extrafanart[${index + 1}]`, checkUrl),
      ),
    );
    remainingCandidates.forEach(([index], i) => {
      validatedByIndex.set(index, remainingResults[i] || "");
    });
  }

  const validUrls: string[] = [];
  for (let index = 0; index < candidates.length; index++) {
    const validatedUrl = validatedByIndex.get(index) || "";
    if (validatedUrl && !validUrls.includes(validatedUrl)) validUrls.push(validatedUrl);
  }
  return validUrls;
}

export async function resolveDmmPosterUrl(
  thumbUrl: string,
  posterUrl: string,
  checkUrl: Jav321CheckUrlFn,
): Promise<string> {
  const candidates = normalizeExtrafanartUrls([posterUrl, toPosterUrl(thumbUrl)].filter(Boolean));
  for (const candidate of candidates) {
    const validated = await validateDmmImageIfNeeded(candidate, "poster", checkUrl);
    if (validated) return validated;
  }
  return "";
}
