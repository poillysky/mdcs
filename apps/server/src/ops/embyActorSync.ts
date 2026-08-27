import fs from "node:fs";
import {
  collectActorsFromLibraries,
  createEmbyClientFromActorsConfig,
  listEmbyPersons,
  refreshEmbyLibrary,
  type EmbyPerson,
  updateEmbyPerson,
  uploadEmbyPersonPrimaryImage,
} from "./embyClient.js";
import {
  getActorProfile,
  resolveAvatarAbs,
  saveActorAvatarBytes,
  upsertActorProfile,
} from "./actorProfiles.js";
import {
  downloadBestActorAvatar,
  loadGfriendsIndex,
  resolveActorMapInfo,
} from "./gfriends.js";
import { loadOpsConfig } from "./loadOps.js";
import type { OpsConfig } from "./types.js";

export type EmbyActorSyncResult = {
  total: number;
  updatedMeta: number;
  updatedImage: number;
  skipped: number;
  failed: number;
  /** 使用本地档案导入的次数 */
  fromLocal: number;
  errors: string[];
};

export type EmbyActorSyncOptions = {
  signal?: AbortSignal;
  onProgress?: (text: string) => void;
  /** 覆盖配置；默认读 ops.json */
  actors?: OpsConfig["actors"];
};

async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const n = Math.max(1, concurrency);
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (queue.length) {
        const item = queue.shift();
        if (item === undefined) return;
        await worker(item);
      }
    }),
  );
}

export async function runEmbyActorSync(opts: EmbyActorSyncOptions = {}): Promise<EmbyActorSyncResult> {
  const actorsCfg = opts.actors ?? loadOpsConfig().actors;
  const log = opts.onProgress || (() => undefined);
  const result: EmbyActorSyncResult = {
    total: 0,
    updatedMeta: 0,
    updatedImage: 0,
    skipped: 0,
    failed: 0,
    fromLocal: 0,
    errors: [],
  };

  if (!actorsCfg.embyUrl?.trim() || !actorsCfg.embyApiKey?.trim()) {
    throw new Error("请先配置 Emby 地址与 API Key");
  }
  if (!actorsCfg.scrapeMetadata && !actorsCfg.scrapeImages) {
    throw new Error("请至少勾选「元数据」或「图片」");
  }

  const client = createEmbyClientFromActorsConfig(actorsCfg, opts.signal);
  log("连接 Emby…");

  let persons: EmbyPerson[];
  if (actorsCfg.libraryIds.length) {
    log(`从 ${actorsCfg.libraryIds.length} 个媒体库收集演员…`);
    persons = await collectActorsFromLibraries(
      client,
      actorsCfg.libraryIds,
      actorsCfg.autoScrapeRecentDays,
    );
  } else {
    log("拉取 Emby 演员列表…");
    persons = await listEmbyPersons(client);
  }

  result.total = persons.length;
  log(`共 ${persons.length} 位演员`);

  let gfriends: Map<string, string> | null = null;
  if (actorsCfg.scrapeImages) {
    try {
      log("加载 Gfriends 头像索引…");
      gfriends = await loadGfriendsIndex(false, opts.signal);
      log(`Gfriends 索引 ${gfriends.size} 条`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Gfriends: ${msg}`);
      log(`Gfriends 加载失败: ${msg}`);
      if (!actorsCfg.scrapeMetadata) throw err;
    }
  }

  const overwriteAll = actorsCfg.metadataOverwrite === "all";

  await runPool(persons, 3, async (person) => {
    if (opts.signal?.aborted) return;
    try {
      let did = false;
      let usedLocal = false;
      const mapped = resolveActorMapInfo(person.name);
      const local =
        getActorProfile(person.name) ||
        (mapped.name !== person.name ? getActorProfile(mapped.name) : null);

      if (actorsCfg.scrapeMetadata) {
        const localOverview = local?.overview?.trim() || "";
        const localUrl = local?.providerIds?.Url || local?.providerIds?.url || "";
        const needMeta =
          overwriteAll ||
          !person.overview?.trim() ||
          ((mapped.url || localUrl) && !person.providerIds?.ScrapUrl && !person.providerIds?.Url);

        if (needMeta) {
          let overview = person.overview?.trim() || "";
          if (overwriteAll || !overview) {
            if (localOverview) {
              overview = localOverview;
              usedLocal = true;
            } else if (mapped.name !== person.name) {
              overview = `映射名: ${mapped.name}`;
            }
          }
          const providerIds: Record<string, string> = { ...(person.providerIds || {}) };
          if (localUrl) {
            providerIds.Url = localUrl;
            usedLocal = true;
          } else if (mapped.url) {
            providerIds.Url = mapped.url;
          }
          await updateEmbyPerson(client, person.id, {
            overview: overview || undefined,
            providerIds,
          });
          result.updatedMeta += 1;
          did = true;

          // 网络/映射补全后回写本地（本地已有则合并）
          if (!local?.scrapedAt || !localOverview) {
            upsertActorProfile({
              name: person.name,
              mappedName: local?.mappedName || mapped.name,
              overview: overview || local?.overview || "",
              providerIds: {
                ...(local?.providerIds || {}),
                ...(mapped.url ? { Url: mapped.url } : {}),
                ...(localUrl ? { Url: localUrl } : {}),
              },
              sources: {
                ...(local?.sources || {}),
                map: "scrape_maps",
                emby: "sync",
              },
              scrapedAt: local?.scrapedAt ?? Date.now(),
            });
          }
        }
      }

      if (actorsCfg.scrapeImages) {
        const needImage = overwriteAll || !person.hasPrimaryImage;
        if (needImage) {
          const localAbs = local ? resolveAvatarAbs(local.avatarPath) : null;
          if (localAbs) {
            const bytes = fs.readFileSync(localAbs);
            const ext = localAbs.toLowerCase();
            const contentType = ext.endsWith(".png")
              ? "image/png"
              : ext.endsWith(".webp")
                ? "image/webp"
                : "image/jpeg";
            await uploadEmbyPersonPrimaryImage(client, person.id, bytes, contentType);
            result.updatedImage += 1;
            usedLocal = true;
            did = true;
          } else if (gfriends) {
            const img = await downloadBestActorAvatar(
              [person.name, mapped.name].filter(Boolean),
              opts.signal,
            );
            if (img) {
              await uploadEmbyPersonPrimaryImage(client, person.id, img.bytes, img.contentType);
              result.updatedImage += 1;
              did = true;
              const avatarPath = await saveActorAvatarBytes(person.name, img.bytes, img.contentType);
              upsertActorProfile({
                name: person.name,
                mappedName: local?.mappedName || mapped.name,
                avatarPath,
                overview: local?.overview || "",
                providerIds: {
                  ...(local?.providerIds || {}),
                  ...(mapped.url ? { Url: mapped.url } : {}),
                },
                sources: {
                  ...(local?.sources || {}),
                  avatar: "gfriends",
                  emby: "sync",
                },
                scrapedAt: local?.scrapedAt ?? Date.now(),
                imageScrapedAt: Date.now(),
              });
            }
          }
        }
      }

      if (usedLocal) result.fromLocal += 1;
      if (!did) result.skipped += 1;
    } catch (err) {
      result.failed += 1;
      const msg = `${person.name}: ${err instanceof Error ? err.message : String(err)}`;
      if (result.errors.length < 20) result.errors.push(msg);
    }
  });

  if (actorsCfg.refreshLibraryAfterScrape) {
    log("刷新媒体库…");
    try {
      await refreshEmbyLibrary(
        client,
        actorsCfg.libraryIds.length ? actorsCfg.libraryIds : undefined,
      );
    } catch (err) {
      result.errors.push(
        `刷新库失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  log(
    `完成: meta=${result.updatedMeta} image=${result.updatedImage} local=${result.fromLocal} skip=${result.skipped} fail=${result.failed}`,
  );
  return result;
}
