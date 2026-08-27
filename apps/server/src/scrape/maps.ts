import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, ensureDir, pathExists } from "../paths.js";

export type MappingLang = "zh-CN" | "zh-TW" | "ja" | "en";

type ActorHit = string | { name?: string; zh?: string; title?: string; javdb?: string; javdbUrl?: string; url?: string; link?: string };

const MAPS_DIR = path.join(DATA_DIR, "scrape_maps");
const FORUM_TITLES_PATH = path.join(DATA_DIR, "forum_titles.json");

const mapCache = new Map<string, Record<string, unknown>>();
let forumTitleCache: Record<string, string> | null = null;

function langStem(lang: MappingLang): string {
  return lang;
}

function loadJsonMap(filePath: string): Record<string, unknown> {
  if (mapCache.has(filePath)) return mapCache.get(filePath)!;
  if (!pathExists(filePath)) {
    mapCache.set(filePath, {});
    return {};
  }
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
    const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    mapCache.set(filePath, obj);
    return obj;
  } catch {
    mapCache.set(filePath, {});
    return {};
  }
}

function loadNamedMap(kind: "actors" | "tags", lang: MappingLang): Record<string, unknown> {
  ensureDir(MAPS_DIR);
  // 目标语种优先；文件为空/缺失时按常用语种回退，避免 zh-CN 空表导致映射全失效
  const fallbacks: MappingLang[] = ["zh-CN", "zh-TW", "ja", "en"];
  const order = [lang, ...fallbacks.filter((l) => l !== lang)];
  for (const l of order) {
    const candidates =
      l === lang
        ? [`${kind}.${langStem(l)}.json`, `${kind}.json`]
        : [`${kind}.${langStem(l)}.json`];
    for (const name of candidates) {
      const m = loadJsonMap(path.join(MAPS_DIR, name));
      if (Object.keys(m).length) return m;
    }
  }
  return {};
}

export function clearMetadataMapCache(): void {
  mapCache.clear();
  forumTitleCache = null;
}

const ACTOR_DIRTY_RE = /^[+\-~～\s　]+|[+\-~～\s　]+$/g;

export function cleanActorName(name: string): string {
  const s = String(name || "")
    .replace(ACTOR_DIRTY_RE, "")
    .replace(/\s+/g, " ")
    .trim();
  return s;
}

function lookupCaseInsensitive(table: Record<string, unknown>, key: string): unknown {
  if (Object.prototype.hasOwnProperty.call(table, key)) return table[key];
  const low = key.toLowerCase();
  for (const [k, v] of Object.entries(table)) {
    if (k.toLowerCase() === low) return v;
  }
  return undefined;
}

export function mapActorEntry(
  rawName: string,
  table: Record<string, unknown>,
): { name: string; javdb: string } {
  const key = String(rawName || "").trim();
  if (!key) return { name: "", javdb: "" };
  const cleaned = cleanActorName(key);
  let hit = lookupCaseInsensitive(table, key);
  if (hit == null && cleaned && cleaned !== key) {
    hit = lookupCaseInsensitive(table, cleaned);
  }
  const fallback = cleaned || key;
  if (hit == null) return { name: fallback, javdb: "" };
  if (typeof hit === "string") return { name: hit.trim() || fallback, javdb: "" };
  if (typeof hit === "object" && hit) {
    const o = hit as Exclude<ActorHit, string>;
    const name = String(o.name || o.zh || o.title || "").trim();
    const javdb = String(o.javdb || o.javdbUrl || o.url || o.link || "").trim();
    return { name: name || fallback, javdb };
  }
  return { name: fallback, javdb: "" };
}

export function mapTagEntry(raw: string, table: Record<string, unknown>): string {
  const key = String(raw || "").trim();
  if (!key) return "";
  const hit = lookupCaseInsensitive(table, key);
  if (hit == null) return key;
  if (typeof hit === "string") return hit.trim() || key;
  if (typeof hit === "object" && hit) {
    const o = hit as { name?: string; zh?: string; title?: string };
    return String(o.name || o.zh || o.title || key).trim() || key;
  }
  return key;
}

export function mapActors(
  actors: string[],
  lang: MappingLang,
  enabled: boolean,
): { actors: string[]; actorUrls: Record<string, string> } {
  const raw = (actors || []).map((a) => String(a).trim()).filter(Boolean);
  if (!raw.length) return { actors: [], actorUrls: {} };

  if (!enabled) {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const a of raw) {
      const name = cleanActorName(a) || a;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      out.push(name);
    }
    return { actors: out, actorUrls: {} };
  }

  const table = loadNamedMap("actors", lang);
  const out: string[] = [];
  const actorUrls: Record<string, string> = {};
  const seen = new Set<string>();
  for (const a of raw) {
    const { name, javdb } = mapActorEntry(a, table);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
    if (javdb) actorUrls[name] = javdb;
  }
  return { actors: out, actorUrls };
}

export function mapTags(tags: string[], lang: MappingLang, enabled: boolean): string[] {
  const raw = (tags || []).map((t) => String(t).trim()).filter(Boolean);
  if (!raw.length) return [];
  if (!enabled) {
    return [...new Set(raw)];
  }
  const table = loadNamedMap("tags", lang);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of raw) {
    const name = mapTagEntry(t, table);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

/** 本地色花堂/论坛标题库：data/forum_titles.json → { "SSIS-001": "中文标题" } */
export function lookupForumTitle(code: string): string {
  const key = String(code || "").trim().toUpperCase();
  if (!key) return "";
  if (!forumTitleCache) {
    if (!pathExists(FORUM_TITLES_PATH)) {
      forumTitleCache = {};
    } else {
      try {
        const raw = JSON.parse(fs.readFileSync(FORUM_TITLES_PATH, "utf8")) as unknown;
        const obj =
          raw && typeof raw === "object" && !Array.isArray(raw)
            ? (raw as Record<string, unknown>)
            : {};
        const normalized: Record<string, string> = {};
        for (const [k, v] of Object.entries(obj)) {
          const ck = String(k).trim().toUpperCase();
          const title = String(v ?? "").trim();
          if (ck && title) normalized[ck] = title;
        }
        forumTitleCache = normalized;
      } catch {
        forumTitleCache = {};
      }
    }
  }
  return forumTitleCache[key] || "";
}

export function getMapsDir(): string {
  return MAPS_DIR;
}
