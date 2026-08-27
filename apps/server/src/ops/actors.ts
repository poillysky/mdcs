import { openDatabase } from "../db/init.js";
import {
  getActorProfile,
  listActorProfiles,
  resolveAvatarAbs,
  type ActorProfile,
} from "./actorProfiles.js";

export type ActorRow = {
  name: string;
  workCount: number;
  kinds: string[];
  codes: string[];
  lastScrapedAt: number | null;
  /** 作品缓存聚合；档案是否已本地刮削 */
  profileStatus: "scraped" | "missing";
  mappedName: string;
  avatarUrl: string | null;
  overview: string;
  profileScrapedAt: number | null;
  imageScrapedAt: number | null;
  birthday: string;
  birthplace: string;
  providerIds: Record<string, string>;
  tags: string[];
};

function avatarUrlFor(name: string, profile: ActorProfile | undefined): string | null {
  if (!profile?.avatarPath || !resolveAvatarAbs(profile.avatarPath)) return null;
  // t= 强制换图后绕过浏览器对同 URL 的长缓存
  const t = profile.imageScrapedAt || profile.scrapedAt || 0;
  return `/api/actors/avatar?name=${encodeURIComponent(name)}&t=${t}`;
}

function toActorRow(
  base: {
    name: string;
    workCount: number;
    kinds: string[];
    codes: string[];
    lastScrapedAt: number | null;
  },
  profile: ActorProfile | undefined,
): ActorRow {
  return {
    ...base,
    profileStatus: profile?.scrapedAt ? "scraped" : "missing",
    mappedName: profile?.mappedName || base.name,
    avatarUrl: avatarUrlFor(base.name, profile),
    overview: profile?.overview || "",
    profileScrapedAt: profile?.scrapedAt ?? null,
    imageScrapedAt: profile?.imageScrapedAt ?? null,
    birthday: profile?.birthday || "",
    birthplace: profile?.birthplace || "",
    providerIds: profile?.providerIds || {},
    tags: profile?.tags || [],
  };
}

/** 从 scrape_cache 聚合本地演员库，并合并 actor_profiles */
export function listActors(opts: {
  q?: string;
  page?: number;
  pageSize?: number;
  /** scraped | missing | 空=全部 */
  status?: string;
}): { total: number; page: number; pageSize: number; actors: ActorRow[] } {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 50));
  const q = (opts.q || "").trim().toLowerCase();
  const status = (opts.status || "").trim().toLowerCase();

  const db = openDatabase();
  const rows = db
    .prepare(`SELECT code, kind, meta_json, scraped_at FROM scrape_cache`)
    .all() as Array<{ code: string; kind: string; meta_json: string; scraped_at: number }>;

  const map = new Map<
    string,
    { name: string; kinds: Set<string>; codes: Set<string>; last: number }
  >();

  for (const row of rows) {
    let actors: string[] = [];
    try {
      const meta = JSON.parse(row.meta_json) as { actors?: unknown };
      if (Array.isArray(meta.actors)) {
        actors = meta.actors
          .filter((a): a is string => typeof a === "string" && a.trim().length > 0)
          .map((a) => a.trim());
      }
    } catch {
      continue;
    }
    for (const name of actors) {
      const key = name.toLowerCase();
      let cur = map.get(key);
      if (!cur) {
        cur = { name, kinds: new Set(), codes: new Set(), last: 0 };
        map.set(key, cur);
      }
      cur.kinds.add(row.kind);
      cur.codes.add(row.code);
      if (row.scraped_at > cur.last) cur.last = row.scraped_at;
    }
  }

  const profiles = listActorProfiles();
  const profileByLower = new Map(profiles.map((p) => [p.name.toLowerCase(), p]));

  let list = [...map.values()].map((v) =>
    toActorRow(
      {
        name: v.name,
        workCount: v.codes.size,
        kinds: [...v.kinds],
        codes: [...v.codes].slice(0, 20),
        lastScrapedAt: v.last || null,
      },
      profileByLower.get(v.name.toLowerCase()),
    ),
  );

  if (q) {
    list = list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.mappedName.toLowerCase().includes(q),
    );
  }
  if (status === "scraped" || status === "missing") {
    list = list.filter((a) => a.profileStatus === status);
  }
  list.sort((a, b) => b.workCount - a.workCount || a.name.localeCompare(b.name, "zh"));

  const total = list.length;
  const start = (page - 1) * pageSize;
  return {
    total,
    page,
    pageSize,
    actors: list.slice(start, start + pageSize),
  };
}

/** 列出缓存中尚无本地档案的演员名（最多 limit 条） */
export function listMissingActorNames(limit = 200): string[] {
  const data = listActors({ page: 1, pageSize: Math.min(100, Math.max(1, limit)), status: "missing" });
  // listActors 分页上限 100；缺额时多翻几页
  const names = data.actors.map((a) => a.name);
  if (names.length >= limit || data.total <= names.length) return names.slice(0, limit);
  let page = 2;
  while (names.length < limit) {
    const more = listActors({
      page,
      pageSize: 100,
      status: "missing",
    });
    if (!more.actors.length) break;
    for (const a of more.actors) {
      names.push(a.name);
      if (names.length >= limit) break;
    }
    page += 1;
  }
  return names.slice(0, limit);
}

export function getActorDetail(name: string): ActorRow | null {
  const key = String(name || "").trim();
  if (!key) return null;
  const listed = listActors({ q: key, page: 1, pageSize: 50 });
  const matched =
    listed.actors.find((a) => a.name === key) ||
    listed.actors.find((a) => a.name.toLowerCase() === key.toLowerCase()) ||
    null;
  if (matched) return matched;

  const profile = getActorProfile(key);
  if (!profile) return null;
  return toActorRow(
    {
      name: profile.name,
      workCount: 0,
      kinds: [],
      codes: [],
      lastScrapedAt: null,
    },
    profile,
  );
}
