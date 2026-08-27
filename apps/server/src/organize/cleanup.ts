import fs from "node:fs";
import path from "node:path";
import type { OrganizeConfig } from "../types.js";
import { buildVideoExtSet, isVideoFile } from "../paths.js";
import { hitsFilenameBlacklist, isMinSizeExempt } from "../library/scanFilter.js";

function normalizeExt(ext: string): string {
  return ext.replace(/^\./, "").toLowerCase();
}

/**
 * 整理成功后，按规则清理源文件所在目录内的杂项（不递归子目录，避免误伤）。
 * 白名单保护开启时：视频后缀 + 补充白名单不删。
 */
export function cleanupSourceDirectory(
  sourceDirAbs: string,
  org: OrganizeConfig,
  opts?: { dryRun?: boolean },
): { deleted: string[]; skipped: string[] } {
  const deleted: string[] = [];
  const skipped: string[] = [];
  if (!org.cleanup?.enabled || !sourceDirAbs || !fs.existsSync(sourceDirAbs)) {
    return { deleted, skipped };
  }

  const videoExt = buildVideoExtSet(org.videoExtensions);
  const extraWhite = new Set(
    (org.cleanup.extraWhitelistExt || []).map(normalizeExt).filter(Boolean),
  );
  const minBytes = Math.max(0, org.minFileSizeMb) * 1024 * 1024;
  const blacklist = org.filenameBlacklist || [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(sourceDirAbs, { withFileTypes: true });
  } catch {
    return { deleted, skipped };
  }

  for (const ent of entries) {
    if (!ent.isFile()) continue;
    const full = path.join(sourceDirAbs, ent.name);
    const ext = normalizeExt(path.extname(ent.name));
    const isVideo = isVideoFile(ent.name, videoExt);
    const isExtra = extraWhite.has(ext);

    if (org.cleanup.whitelistProtect && (isVideo || isExtra)) {
      skipped.push(full);
      continue;
    }

    let size = 0;
    try {
      size = fs.statSync(full).size;
    } catch {
      continue;
    }

    let kill = false;
    if (org.cleanup.deleteBlacklist && hitsFilenameBlacklist(ent.name, blacklist)) {
      kill = true;
    } else if (
      org.cleanup.deleteSmallFiles &&
      minBytes > 0 &&
      size < minBytes &&
      !isMinSizeExempt(full)
    ) {
      kill = true;
    } else if (org.cleanup.deleteNonWhitelist && !isVideo && !isExtra) {
      kill = true;
    }

    if (!kill) {
      skipped.push(full);
      continue;
    }

    if (!opts?.dryRun) {
      try {
        fs.unlinkSync(full);
      } catch {
        skipped.push(full);
        continue;
      }
    }
    deleted.push(full);
  }

  return { deleted, skipped };
}
