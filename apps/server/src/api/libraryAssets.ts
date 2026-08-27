import fs from "node:fs";
import path from "node:path";
import { loadLibrariesConfig, resolveKind, resolveOrganizeForKind } from "../config/loadConfig.js";
import { openDatabase } from "../db/init.js";
import { buildPlanForFile } from "../organize/plan.js";
import { findLocalCover } from "../scrape/cache.js";
import { PROJECT_ROOT, pathExists, resolveProjectPath } from "../paths.js";
import type { KindId } from "../types.js";
import { KIND_IDS } from "../types.js";

export type LibraryAssetRole = "poster" | "thumb" | "fanart";

type FileRow = {
  id: number;
  kind: KindId;
  source_path: string;
  file_name: string;
  code: string | null;
  mosaic?: string | null;
  status: string;
  target_path?: string | null;
};

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function isImageFile(name: string): boolean {
  return IMAGE_EXT.has(path.extname(name).toLowerCase());
}

function firstExistingFile(candidates: string[]): string | null {
  for (const p of candidates) {
    if (pathExists(p) && fs.statSync(p).size > 0) return p;
  }
  return null;
}

function absFromRelative(rel: string): string {
  return path.isAbsolute(rel) ? rel : path.join(PROJECT_ROOT, rel.replace(/\\/g, "/"));
}

/** 解析入库目录：target_path 目录 > 整理计划目录 > 库内按番号搜索 */
export function resolveMovieDirForFile(file: FileRow): string | null {
  const target = file.target_path?.trim();
  if (target) {
    const abs = absFromRelative(target);
    const dir = fs.existsSync(abs) && fs.statSync(abs).isFile() ? path.dirname(abs) : abs;
    if (pathExists(dir) && fs.statSync(dir).isDirectory()) return dir;
  }

  const kind = resolveKind(file.kind, loadLibrariesConfig());
  if (kind && file.code) {
    const plan = buildPlanForFile(
      {
        id: file.id,
        kind: file.kind,
        source_path: file.source_path,
        file_name: file.file_name,
        code: file.code,
        mosaic: file.mosaic,
        status: file.status,
      },
      kind,
      {
        projectRoot: PROJECT_ROOT,
        onConflict: resolveOrganizeForKind(file.kind).onConflict,
        organize: resolveOrganizeForKind(file.kind),
      },
    );
    if (plan?.targetAbs) {
      const dir = path.dirname(plan.targetAbs);
      if (pathExists(dir) && fs.statSync(dir).isDirectory()) return dir;
    }
  }

  if (kind?.libraryAbs && file.code) {
    const code = file.code.trim();
    const found = findCodeDirUnder(kind.libraryAbs, code, 4);
    if (found) return found;
  }

  return null;
}

function findCodeDirUnder(root: string, code: string, maxDepth: number): string | null {
  if (!pathExists(root) || maxDepth < 0) return null;
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const abs = path.join(root, ent.name);
    if (ent.name.toLowerCase() === code.toLowerCase()) {
      if (firstExistingFile([path.join(abs, "poster.jpg"), path.join(abs, "thumb.jpg")])) {
        return abs;
      }
    }
    const nested = findCodeDirUnder(abs, code, maxDepth - 1);
    if (nested) return nested;
  }
  return null;
}

function posterCandidates(dir: string, videoStem: string): string[] {
  return [
    path.join(dir, "poster.jpg"),
    path.join(dir, "poster.jpeg"),
    path.join(dir, "poster.png"),
    path.join(dir, "poster.webp"),
    path.join(dir, `${videoStem}-poster.jpg`),
    path.join(dir, `${videoStem}-poster.jpeg`),
  ];
}

function thumbCandidates(dir: string, videoStem: string): string[] {
  return [
    path.join(dir, "thumb.jpg"),
    path.join(dir, "thumb.jpeg"),
    path.join(dir, "thumb.png"),
    path.join(dir, "thumb.webp"),
    path.join(dir, `${videoStem}-thumb.jpg`),
    path.join(dir, `${videoStem}-thumb.jpeg`),
  ];
}

function listFanartFiles(dir: string): string[] {
  const fanartDir = path.join(dir, "extrafanart");
  if (!pathExists(fanartDir)) return [];
  let names: string[] = [];
  try {
    names = fs
      .readdirSync(fanartDir)
      .filter((name) => isImageFile(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  } catch {
    return [];
  }
  return names.map((name) => path.join(fanartDir, name));
}

export function findLibraryAssetAbs(
  file: FileRow,
  role: LibraryAssetRole,
  fanartIndex = 1,
): string | null {
  const dir = resolveMovieDirForFile(file);
  if (!dir) return null;
  const videoStem = path.parse(file.file_name || file.code || "video").name;
  if (role === "poster") return firstExistingFile(posterCandidates(dir, videoStem));
  if (role === "thumb") return firstExistingFile(thumbCandidates(dir, videoStem));
  const fanarts = listFanartFiles(dir);
  const idx = Math.max(1, fanartIndex) - 1;
  return fanarts[idx] ?? null;
}

export function listGalleryAssets(file: FileRow): Array<{
  role: LibraryAssetRole;
  index?: number;
  abs: string;
}> {
  const dir = resolveMovieDirForFile(file);
  if (!dir) return [];
  const videoStem = path.parse(file.file_name || file.code || "video").name;
  const items: Array<{ role: LibraryAssetRole; index?: number; abs: string }> = [];
  const thumb = firstExistingFile(thumbCandidates(dir, videoStem));
  if (thumb) items.push({ role: "thumb", abs: thumb });
  listFanartFiles(dir).forEach((abs, i) => {
    items.push({ role: "fanart", index: i + 1, abs });
  });
  return items;
}

export function galleryAssetUrl(fileId: number, item: { role: LibraryAssetRole; index?: number }): string {
  if (item.role === "thumb") return `/api/files/${fileId}/asset/thumb`;
  if (item.role === "poster") return `/api/files/${fileId}/asset/poster`;
  return `/api/files/${fileId}/asset/fanart/${item.index ?? 1}`;
}

export function loadFileRow(fileId: number): FileRow | null {
  const db = openDatabase();
  const row = db
    .prepare(
      `SELECT id, kind, source_path, file_name, code, mosaic, status, target_path
       FROM files WHERE id = ?`,
    )
    .get(fileId) as FileRow | undefined;
  if (!row || !KIND_IDS.includes(row.kind)) return null;
  return row;
}

export function findCachedCoverAbs(code: string, kind: KindId): string | null {
  const rel = findLocalCover(code, kind);
  return rel ? resolveProjectPath(rel) : null;
}
