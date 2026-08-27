import {
  getActorProfile,
  saveActorAvatarBytes,
  upsertActorProfile,
  type ActorProfile,
} from "./actorProfiles.js";
import {
  downloadBestActorAvatar,
  loadGfriendsIndex,
  resolveActorMapInfo,
} from "./gfriends.js";
import { fetchMinnanoActor } from "./minnano.js";

export type ActorScrapeItemResult = {
  name: string;
  ok: boolean;
  skipped?: boolean;
  mappedName?: string;
  avatarPath?: string;
  profile?: ActorProfile;
  error?: string;
};

export type ActorScrapeResult = {
  total: number;
  ok: number;
  skipped: number;
  failed: number;
  results: ActorScrapeItemResult[];
};

export type ScrapeActorOptions = {
  /** 已有档案（scraped_at）则跳过 */
  missingOnly?: boolean;
  /** 强制重下头像 */
  forceImage?: boolean;
  signal?: AbortSignal;
  onProgress?: (text: string) => void;
};

/** 刮削单个演员：minnano 档案 + Gfriends 头像 */
export async function scrapeActorProfile(
  name: string,
  opts: ScrapeActorOptions = {},
): Promise<ActorScrapeItemResult> {
  const actorName = String(name || "").trim();
  if (!actorName) {
    return { name: "", ok: false, error: "演员名不能为空" };
  }

  const existing = getActorProfile(actorName);
  if (opts.missingOnly && existing?.scrapedAt) {
    return {
      name: actorName,
      ok: true,
      skipped: true,
      mappedName: existing.mappedName,
      avatarPath: existing.avatarPath,
      profile: existing,
    };
  }

  try {
    const mapped = resolveActorMapInfo(actorName);
    const providerIds: Record<string, string> = {
      ...(existing?.providerIds || {}),
    };
    if (mapped.url) providerIds.Url = mapped.url;

    let overview = "";
    let birthday = existing?.birthday || "";
    let birthplace = existing?.birthplace || "";
    let tags = existing?.tags || [];
    const avatarNames = new Set<string>([actorName, mapped.name].filter(Boolean));
    const sources: Record<string, string> = {
      ...(existing?.sources || {}),
      map: "scrape_maps",
    };

    // 1) minnano 档案
    try {
      opts.onProgress?.(`minnano: ${actorName}`);
      const mn = await fetchMinnanoActor(actorName, { signal: opts.signal });
      if (mn) {
        if (mn.overview) overview = mn.overview;
        if (mn.birthday) birthday = mn.birthday;
        if (mn.birthplace) birthplace = mn.birthplace;
        if (mn.tags.length) tags = mn.tags;
        if (mn.url) providerIds["minnano-av"] = mn.url;
        if (mn.twitter) providerIds.Twitter = mn.twitter;
        sources.profile = "minnano";
        if (mn.name) avatarNames.add(mn.name);
        for (const a of mn.aliases || []) {
          if (a?.trim()) avatarNames.add(a.trim());
        }
      }
    } catch (err) {
      opts.onProgress?.(
        `minnano 失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // 清除历史假「映射名」简介
    if (!overview) {
      const prev = existing?.overview?.trim() || "";
      if (prev && !/^映射名\s*[:：]/.test(prev)) overview = prev;
    }

    // 2) Gfriends 头像：多名字候选 + 脸部居中择优（完整原图，不裁）
    let avatarPath = existing?.avatarPath || "";
    let imageScrapedAt = existing?.imageScrapedAt ?? null;
    const needImage = opts.forceImage || !avatarPath;
    let imageError = "";

    if (needImage) {
      try {
        opts.onProgress?.(`gfriends: ${actorName}`);
        await loadGfriendsIndex(false, opts.signal);
        const img = await downloadBestActorAvatar([...avatarNames], opts.signal);
        if (img) {
          avatarPath = await saveActorAvatarBytes(actorName, img.bytes, img.contentType);
          imageScrapedAt = Date.now();
          sources.avatar = "gfriends";
        }
      } catch (err) {
        imageError = err instanceof Error ? err.message : String(err);
      }
    } else if (avatarPath) {
      sources.avatar = sources.avatar || "gfriends";
    }

    const profile = upsertActorProfile({
      name: actorName,
      mappedName: mapped.name,
      avatarPath,
      overview,
      birthday,
      birthplace,
      tags,
      providerIds,
      sources,
      scrapedAt: Date.now(),
      imageScrapedAt,
    });

    return {
      name: actorName,
      ok: true,
      mappedName: profile.mappedName,
      avatarPath: profile.avatarPath || undefined,
      profile,
      ...(imageError && !avatarPath ? { error: `头像未下载: ${imageError}` } : {}),
    };
  } catch (err) {
    return {
      name: actorName,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function scrapeActorProfiles(
  names: string[],
  opts: ScrapeActorOptions = {},
): Promise<ActorScrapeResult> {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const n = String(raw || "").trim();
    if (!n) continue;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(n);
  }

  const log = opts.onProgress || (() => undefined);
  if (
    unique.some((n) => {
      const p = getActorProfile(n);
      return !(opts.missingOnly && p?.scrapedAt);
    })
  ) {
    try {
      log("加载 Gfriends 头像索引…");
      await loadGfriendsIndex(false, opts.signal);
    } catch (err) {
      log(`Gfriends 索引加载失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const results: ActorScrapeItemResult[] = [];
  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const name of unique) {
    if (opts.signal?.aborted) break;
    log(`刮削演员: ${name}`);
    const item = await scrapeActorProfile(name, { ...opts, onProgress: log });
    results.push(item);
    if (item.skipped) skipped += 1;
    else if (item.ok) ok += 1;
    else failed += 1;
  }

  return { total: unique.length, ok, skipped, failed, results };
}
