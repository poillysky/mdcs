import fs from "node:fs";
import path from "node:path";
import { openDatabase } from "../db/init.js";
import {
  DATA_DIR,
  ensureDir,
  pathExists,
  resolveProjectPath,
  toProjectRelativePath,
} from "../paths.js";

export const ACTORS_DIR = path.join(DATA_DIR, "actors");

export type ActorProfile = {
  name: string;
  mappedName: string;
  avatarPath: string;
  backdropPath: string;
  overview: string;
  birthday: string;
  birthplace: string;
  tags: string[];
  providerIds: Record<string, string>;
  sources: Record<string, string>;
  scrapedAt: number | null;
  imageScrapedAt: number | null;
};

export type ActorProfileInput = {
  name: string;
  mappedName?: string;
  avatarPath?: string;
  backdropPath?: string;
  overview?: string;
  birthday?: string;
  birthplace?: string;
  tags?: string[];
  providerIds?: Record<string, string>;
  sources?: Record<string, string>;
  scrapedAt?: number | null;
  imageScrapedAt?: number | null;
};

type DbRow = {
  name: string;
  mapped_name: string;
  avatar_path: string;
  backdrop_path: string;
  overview: string;
  birthday: string;
  birthplace: string;
  tags_json: string;
  provider_ids_json: string;
  sources_json: string;
  scraped_at: number | null;
  image_scraped_at: number | null;
};

function parseJsonArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw || "[]") as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function parseJsonObject(raw: string): Record<string, string> {
  try {
    const v = JSON.parse(raw || "{}") as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === "string" && val.trim()) out[k] = val;
    }
    return out;
  } catch {
    return {};
  }
}

function rowToProfile(row: DbRow): ActorProfile {
  return {
    name: row.name,
    mappedName: row.mapped_name || "",
    avatarPath: row.avatar_path || "",
    backdropPath: row.backdrop_path || "",
    overview: row.overview || "",
    birthday: row.birthday || "",
    birthplace: row.birthplace || "",
    tags: parseJsonArray(row.tags_json),
    providerIds: parseJsonObject(row.provider_ids_json),
    sources: parseJsonObject(row.sources_json),
    scrapedAt: row.scraped_at ?? null,
    imageScrapedAt: row.image_scraped_at ?? null,
  };
}

/** 文件系统安全目录名 */
export function actorDirSlug(name: string): string {
  const trimmed = String(name || "").trim();
  const safe = trimmed.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/\s+/g, " ").trim();
  return (safe || "unknown").slice(0, 120);
}

export function actorAvatarAbsPath(name: string, ext = ".jpg"): string {
  return path.join(ACTORS_DIR, actorDirSlug(name), `avatar${ext}`);
}

export function resolveAvatarAbs(avatarPath: string): string | null {
  const rel = String(avatarPath || "").trim();
  if (!rel) return null;
  const abs = resolveProjectPath(rel);
  if (pathExists(abs) && fs.statSync(abs).size > 0) return abs;
  return null;
}

export function listActorProfiles(): ActorProfile[] {
  const db = openDatabase();
  const rows = db.prepare(`SELECT * FROM actor_profiles`).all() as DbRow[];
  return rows.map(rowToProfile);
}

export function getActorProfile(name: string): ActorProfile | null {
  const key = String(name || "").trim();
  if (!key) return null;
  const db = openDatabase();
  const exact = db.prepare(`SELECT * FROM actor_profiles WHERE name = ?`).get(key) as
    | DbRow
    | undefined;
  if (exact) return rowToProfile(exact);
  const rows = db.prepare(`SELECT * FROM actor_profiles`).all() as DbRow[];
  const hit = rows.find((r) => r.name.toLowerCase() === key.toLowerCase());
  return hit ? rowToProfile(hit) : null;
}

export function getActorProfilesByNames(names: string[]): Map<string, ActorProfile> {
  const map = new Map<string, ActorProfile>();
  if (!names.length) return map;
  const all = listActorProfiles();
  const byLower = new Map(all.map((p) => [p.name.toLowerCase(), p]));
  for (const name of names) {
    const p = byLower.get(name.toLowerCase());
    if (p) map.set(name.toLowerCase(), p);
  }
  return map;
}

export function upsertActorProfile(input: ActorProfileInput): ActorProfile {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("演员名不能为空");
  const existing = getActorProfile(name);
  const now = Date.now();
  const mappedName = input.mappedName ?? existing?.mappedName ?? name;
  const avatarPath = input.avatarPath ?? existing?.avatarPath ?? "";
  const backdropPath = input.backdropPath ?? existing?.backdropPath ?? "";
  const overview = input.overview ?? existing?.overview ?? "";
  const birthday = input.birthday ?? existing?.birthday ?? "";
  const birthplace = input.birthplace ?? existing?.birthplace ?? "";
  const tags = input.tags ?? existing?.tags ?? [];
  const providerIds = input.providerIds ?? existing?.providerIds ?? {};
  const sources = input.sources ?? existing?.sources ?? {};
  const scrapedAt =
    input.scrapedAt !== undefined ? input.scrapedAt : (existing?.scrapedAt ?? now);
  const imageScrapedAt =
    input.imageScrapedAt !== undefined
      ? input.imageScrapedAt
      : (existing?.imageScrapedAt ?? null);

  const db = openDatabase();
  db.prepare(
    `INSERT INTO actor_profiles (
      name, mapped_name, avatar_path, backdrop_path, overview, birthday, birthplace,
      tags_json, provider_ids_json, sources_json, scraped_at, image_scraped_at
    ) VALUES (
      @name, @mapped_name, @avatar_path, @backdrop_path, @overview, @birthday, @birthplace,
      @tags_json, @provider_ids_json, @sources_json, @scraped_at, @image_scraped_at
    )
    ON CONFLICT(name) DO UPDATE SET
      mapped_name = excluded.mapped_name,
      avatar_path = excluded.avatar_path,
      backdrop_path = excluded.backdrop_path,
      overview = excluded.overview,
      birthday = excluded.birthday,
      birthplace = excluded.birthplace,
      tags_json = excluded.tags_json,
      provider_ids_json = excluded.provider_ids_json,
      sources_json = excluded.sources_json,
      scraped_at = excluded.scraped_at,
      image_scraped_at = excluded.image_scraped_at`,
  ).run({
    name,
    mapped_name: mappedName,
    avatar_path: avatarPath,
    backdrop_path: backdropPath,
    overview,
    birthday,
    birthplace,
    tags_json: JSON.stringify(tags),
    provider_ids_json: JSON.stringify(providerIds),
    sources_json: JSON.stringify(sources),
    scraped_at: scrapedAt,
    image_scraped_at: imageScrapedAt,
  });

  return getActorProfile(name)!;
}

export async function saveActorAvatarBytes(
  actorName: string,
  bytes: Buffer,
  contentType?: string,
): Promise<string> {
  ensureDir(ACTORS_DIR);
  const ct = (contentType || "").toLowerCase();
  let ext = ".jpg";
  if (ct.includes("png")) ext = ".png";
  else if (ct.includes("webp")) ext = ".webp";
  else if (ct.includes("jpeg") || ct.includes("jpg")) ext = ".jpg";

  // 完整原图落盘，不做人脸/方裁（列表用 object-fit: contain 显示）
  let out = bytes;
  try {
    const sharp = (await import("sharp")).default;
    out = await sharp(bytes).rotate().toBuffer();
    const meta = await sharp(out).metadata();
    const fmt = meta.format;
    if (fmt === "png") ext = ".png";
    else if (fmt === "webp") ext = ".webp";
    else {
      ext = ".jpg";
      out = await sharp(out).jpeg({ quality: 92 }).toBuffer();
    }
  } catch {
    /* 保留原始 bytes */
  }

  const abs = actorAvatarAbsPath(actorName, ext);
  ensureDir(path.dirname(abs));
  for (const e of [".jpg", ".jpeg", ".png", ".webp"]) {
    const other = actorAvatarAbsPath(actorName, e);
    if (other !== abs && pathExists(other)) {
      try {
        fs.unlinkSync(other);
      } catch {
        /* ignore */
      }
    }
  }
  fs.writeFileSync(abs, out);
  return toProjectRelativePath(abs);
}
