import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, ensureDir, pathExists } from "../paths.js";
import { mapActors } from "../scrape/maps.js";

const GFRIENDS_RAW =
  "https://raw.githubusercontent.com/gfriends/gfriends/master";
const INDEX_URL = `${GFRIENDS_RAW}/Filetree.json`;
const CACHE_DIR = path.join(DATA_DIR, "emby_actor_cache");
const INDEX_CACHE = path.join(CACHE_DIR, "gfriends_index.json");

/** filename(lower) → 最优 url（兼容旧调用） */
let indexCache: Map<string, string> | null = null;
/** 原始 Filetree，用于按名取多候选 */
let filetreeCache: Filetree | null = null;

type Filetree = {
  Content?: Record<string, Record<string, string>>;
};

type RankedUrl = { url: string; score: number; category: string };

/** 写真站优先；AVDC 常偏裁，权重低于 Digigra/GRAPHIS */
export function scoreGfriendsCandidate(category: string, filepath: string): number {
  const cat = String(category || "");
  const fp = String(filepath || "").toLowerCase();
  let score = 0;

  if (/graphis|digigra/i.test(cat)) score += 140;
  else if (/minnano/i.test(cat)) score += 130;
  else if (/avdc/i.test(cat)) score += 90;
  else if (/^y-/i.test(cat)) score += 60;
  else if (/^z-derek/i.test(cat)) score += 40;
  else if (/^z-dmm/i.test(cat)) score += 10;
  else if (/ラグジュ|luxury/i.test(cat)) score -= 100;
  else if (/^[xwvuti]-/i.test(cat)) score -= 20;

  if (fp.includes("ai-fix")) score -= 80;
  else score += 25;

  return score;
}

function expandFiletree(data: Filetree): Map<string, string> {
  const map = new Map<string, string>();
  const best = new Map<string, number>();
  const content = data.Content || {};
  for (const [category, items] of Object.entries(content)) {
    for (const [filename, filepath] of Object.entries(items || {})) {
      const key = filename.toLowerCase();
      const url = `${GFRIENDS_RAW}/Content/${category}/${filepath}`;
      const score = scoreGfriendsCandidate(category, filepath);
      const prev = best.get(key);
      if (prev == null || score > prev) {
        best.set(key, score);
        map.set(key, url);
      }
    }
  }
  return map;
}

function collectRankedForName(data: Filetree, actorName: string): RankedUrl[] {
  const name = String(actorName || "").trim();
  if (!name) return [];
  const keys = new Set<string>();
  for (const ext of [".jpg", ".jpeg", ".png", ".webp", ""]) {
    keys.add(`${name}${ext}`.toLowerCase());
  }
  const out: RankedUrl[] = [];
  const seen = new Set<string>();
  const content = data.Content || {};
  for (const [category, items] of Object.entries(content)) {
    for (const [filename, filepath] of Object.entries(items || {})) {
      if (!keys.has(filename.toLowerCase())) continue;
      const url = `${GFRIENDS_RAW}/Content/${category}/${filepath}`;
      if (seen.has(url)) continue;
      seen.add(url);
      out.push({
        url,
        score: scoreGfriendsCandidate(category, filepath),
        category,
      });
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

async function ensureFiletree(force = false, signal?: AbortSignal): Promise<Filetree> {
  if (filetreeCache && !force) return filetreeCache;
  ensureDir(CACHE_DIR);

  if (!force && pathExists(INDEX_CACHE)) {
    try {
      const st = fs.statSync(INDEX_CACHE);
      if (Date.now() - st.mtimeMs < 7 * 24 * 3600 * 1000) {
        const raw = JSON.parse(fs.readFileSync(INDEX_CACHE, "utf8")) as Filetree;
        filetreeCache = raw;
        indexCache = expandFiletree(raw);
        if (indexCache.size) return raw;
      }
    } catch {
      /* fallthrough */
    }
  }

  const res = await fetch(INDEX_URL, { signal });
  if (!res.ok) throw new Error(`Gfriends 索引下载失败: ${res.status}`);
  const data = (await res.json()) as Filetree;
  fs.writeFileSync(INDEX_CACHE, `${JSON.stringify(data)}\n`, "utf8");
  filetreeCache = data;
  indexCache = expandFiletree(data);
  return data;
}

export async function loadGfriendsIndex(force = false, signal?: AbortSignal): Promise<Map<string, string>> {
  if (indexCache && !force) return indexCache;
  await ensureFiletree(force, signal);
  return indexCache!;
}

/** 按演员名查头像 URL（尝试 名.jpg / 名.png） */
export function lookupGfriendsUrl(index: Map<string, string>, actorName: string): string | null {
  const name = String(actorName || "").trim();
  if (!name) return null;
  for (const ext of [".jpg", ".jpeg", ".png", ".webp"]) {
    const hit = index.get(`${name}${ext}`.toLowerCase());
    if (hit) return hit;
  }
  const bare = index.get(name.toLowerCase());
  return bare || null;
}

/** 多名字合并候选，按源质量排序去重 */
export async function lookupGfriendsCandidates(
  names: string[],
  limit = 6,
  signal?: AbortSignal,
): Promise<RankedUrl[]> {
  const data = await ensureFiletree(false, signal);
  const merged = new Map<string, RankedUrl>();
  for (const name of names) {
    for (const hit of collectRankedForName(data, name)) {
      const prev = merged.get(hit.url);
      if (!prev || hit.score > prev.score) merged.set(hit.url, hit);
    }
  }
  return [...merged.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function downloadActorImage(
  url: string,
  signal?: AbortSignal,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100) return null;
  const ct = res.headers.get("content-type") || "image/jpeg";
  return { bytes: buf, contentType: ct.split(";")[0]!.trim() || "image/jpeg" };
}

/**
 * 用分辨率/比例给头像打分（无检脸依赖）。
 * 惩罚过小的 tight crop（如 200×300 AVDC），偏好 Digigra 类正常竖构图。
 */
export async function scoreAvatarFraming(bytes: Buffer): Promise<number> {
  const sharp = (await import("sharp")).default;
  const meta = await sharp(bytes).rotate().metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;
  if (w < 40 || h < 40) return -100;

  let score = 0;
  const ratio = w / h;
  if (ratio >= 0.55 && ratio <= 0.9) score += 40;
  else if (ratio >= 0.9 && ratio <= 1.05) score += 15;
  else if (ratio > 1.15) score -= 30;

  const area = w * h;
  if (area >= 200_000) score += 40;
  else if (area >= 100_000) score += 20;
  else if (area < 70_000) score -= 35;

  return score;
}

/** 下载多候选，选构图最正的一张 */
export async function downloadBestActorAvatar(
  names: string[],
  signal?: AbortSignal,
): Promise<{ bytes: Buffer; contentType: string; url: string } | null> {
  const candidates = await lookupGfriendsCandidates(names, 6, signal);
  if (!candidates.length) return null;

  let best: { bytes: Buffer; contentType: string; url: string; score: number } | null = null;
  for (const c of candidates.slice(0, 4)) {
    try {
      const img = await downloadActorImage(c.url, signal);
      if (!img) continue;
      const framing = await scoreAvatarFraming(img.bytes);
      const total = c.score + framing;
      if (!best || total > best.score) {
        best = { ...img, url: c.url, score: total };
      }
      // 足够好就提前结束
      if (framing >= 100) break;
    } catch {
      /* next */
    }
  }
  return best ? { bytes: best.bytes, contentType: best.contentType, url: best.url } : null;
}

/** 从 scrape_maps 解析演员标准名与外链（默认简中，空表由 maps 回退） */
export function resolveActorMapInfo(actorName: string): { name: string; url: string } {
  const key = String(actorName || "").trim();
  if (!key) return { name: "", url: "" };
  const mapped = mapActors([key], "zh-CN", true);
  const name = mapped.actors[0] || key;
  const url = mapped.actorUrls[name] || "";
  return { name, url };
}
