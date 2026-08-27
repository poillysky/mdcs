import fs from "node:fs";
import path from "node:path";
import { ensureDir } from "../paths.js";

const SUB_EXTS = [".srt", ".ass", ".ssa", ".vtt", ".sub"];

function normalizeCodeKey(code: string): string {
  return code.replace(/[-_\s]/g, "").toUpperCase();
}

/** 在字幕库中按番号匹配字幕文件（文件名含番号即可） */
export function findSubtitlesForCode(libraryAbs: string, code: string): string[] {
  if (!libraryAbs || !code || !fs.existsSync(libraryAbs)) return [];
  const key = normalizeCodeKey(code);
  const hits: string[] = [];

  const walk = (dir: string, depth: number) => {
    if (depth > 6 || hits.length >= 8) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full, depth + 1);
        continue;
      }
      const ext = path.extname(ent.name).toLowerCase();
      if (!SUB_EXTS.includes(ext)) continue;
      const base = normalizeCodeKey(path.basename(ent.name, ext));
      if (base.includes(key) || key.includes(base)) {
        hits.push(full);
      }
    }
  };

  walk(libraryAbs, 0);
  return hits;
}

/**
 * 按番号从字幕库复制到视频旁。
 * addChsSuffix=true 时在扩展名前插入 .chs（如 video.chs.srt）。
 */
export function copySubtitlesBesideVideo(opts: {
  libraryAbs: string;
  code: string;
  videoAbs: string;
  addChsSuffix?: boolean;
  /** skip=已存在则跳过；overwrite=覆盖。默认 overwrite */
  onConflict?: "skip" | "overwrite" | "rename";
  dryRun?: boolean;
}): string[] {
  const found = findSubtitlesForCode(opts.libraryAbs, opts.code);
  if (!found.length) return [];
  const videoBase = path.basename(opts.videoAbs, path.extname(opts.videoAbs));
  const dir = path.dirname(opts.videoAbs);
  const copied: string[] = [];
  const onConflict = opts.onConflict ?? "overwrite";
  const chs = opts.addChsSuffix ? ".chs" : "";

  for (const src of found) {
    const ext = path.extname(src);
    const dest = path.join(dir, `${videoBase}${chs}${ext}`);
    if (fs.existsSync(dest) && onConflict === "skip") {
      copied.push(dest);
      continue;
    }
    if (opts.dryRun) {
      copied.push(dest);
      continue;
    }
    ensureDir(dir);
    fs.copyFileSync(src, dest);
    copied.push(dest);
  }
  return copied;
}
