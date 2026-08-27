import fs from "node:fs";
import path from "node:path";
import type { OrganizeConfig } from "../types.js";
import { buildVideoExtSet, isVideoFile } from "../paths.js";

export type WalkVideoFilter = {
  extensions: Set<string>;
  minBytes: number;
  blacklist: string[];
};

export function organizeWalkFilter(org: OrganizeConfig): WalkVideoFilter {
  return {
    extensions: buildVideoExtSet(org.videoExtensions),
    minBytes: Math.max(0, org.minFileSizeMb) * 1024 * 1024,
    blacklist: org.filenameBlacklist || [],
  };
}

export function hitsFilenameBlacklist(fileName: string, blacklist: string[]): boolean {
  if (!blacklist.length) return false;
  const lower = fileName.toLowerCase();
  return blacklist.some((b) => b && lower.includes(b.toLowerCase()));
}

/** 递归收集通过后缀/黑名单过滤的视频路径（体积在调用方再筛） */
export function walkVideoFiles(rootDir: string, filter: WalkVideoFilter): string[] {
  const out: string[] = [];
  if (!fs.existsSync(rootDir)) return out;
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        stack.push(full);
      } else if (ent.isFile() && isVideoFile(ent.name, filter.extensions)) {
        if (hitsFilenameBlacklist(ent.name, filter.blacklist)) continue;
        out.push(full);
      }
    }
  }
  return out;
}

/** .strm 仅为播放列表指针，体积极小，不参与最小体积过滤 */
export function isMinSizeExempt(absPath: string): boolean {
  return path.extname(absPath).toLowerCase() === ".strm";
}

export function passesMinSize(absPath: string, minBytes: number): boolean {
  if (minBytes <= 0) return true;
  if (isMinSizeExempt(absPath)) return true;
  try {
    return fs.statSync(absPath).size >= minBytes;
  } catch {
    return false;
  }
}
