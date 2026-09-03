import type { ScrapeMeta } from "../scrape/types.js";
import type { LibraryFileRow } from "./libraryAssets.js";
import { findCachedCoverAbs, findCachedThumbCoverAbs, findLibraryAssetAbs } from "./libraryAssets.js";
import { isLandscapeImageFile } from "./imageProbe.js";
import { pickRemotePosterUrl, pickRemoteThumbUrl } from "../scrape/coverUrls.js";

export { pickRemotePosterUrl, pickRemoteThumbUrl } from "../scrape/coverUrls.js";

/** 片库 poster（无效小图跳过，由 asset 路由回退远程 pl.jpg） */
export function resolvePosterLocalAbs(file: LibraryFileRow): string | null {
  return findLibraryAssetAbs(file, "poster");
}

/** 片库横版 thumb；竖版副本（误用 poster 源）视为无效 */
export async function resolveThumbLocalAbs(file: LibraryFileRow): Promise<string | null> {
  const thumb = findLibraryAssetAbs(file, "thumb");
  if (thumb && (await isLandscapeImageFile(thumb))) return thumb;
  return null;
}

export function resolveCachedCoverAbs(file: LibraryFileRow): string | null {
  if (!file.code) return null;
  return findCachedCoverAbs(file.code, file.kind);
}

export async function resolveCachedThumbCoverAbs(file: LibraryFileRow): Promise<string | null> {
  if (!file.code) return null;
  const cached = findCachedThumbCoverAbs(file.code, file.kind);
  if (cached && (await isLandscapeImageFile(cached))) return cached;
  return null;
}
