import fs from "node:fs";
import path from "node:path";
import type { OnConflict, OrganizeFallback, OrganizeMode } from "../types.js";
import { ensureDir, pathsReferToSameLocation } from "../paths.js";

export type FsOpResult = {
  ok: boolean;
  action:
    | "hardlink"
    | "softlink"
    | "inplace"
    | "copy"
    | "move"
    | "skip"
    | "overwrite"
    | "rename";
  targetAbs: string;
  message?: string;
};

function sameFile(a: string, b: string): boolean {
  try {
    const sa = fs.statSync(a);
    const sb = fs.statSync(b);
    return sa.dev === sb.dev && sa.ino === sb.ino;
  } catch {
    return false;
  }
}

function renameTarget(targetAbs: string): string {
  const dir = path.dirname(targetAbs);
  const ext = path.extname(targetAbs);
  const base = path.basename(targetAbs, ext);
  for (let i = 1; i < 1000; i++) {
    const candidate = path.join(dir, `${base} (${i})${ext}`);
    if (!fs.existsSync(candidate)) return candidate;
  }
  return path.join(dir, `${base}-${Date.now()}${ext}`);
}

function transfer(mode: "copy" | "move" | "hardlink", src: string, dest: string): "hardlink" | "copy" | "move" {
  if (mode === "hardlink") {
    try {
      fs.linkSync(src, dest);
      return "hardlink";
    } catch {
      fs.copyFileSync(src, dest);
      return "copy";
    }
  }
  if (mode === "move") {
    try {
      fs.renameSync(src, dest);
      return "move";
    } catch {
      fs.copyFileSync(src, dest);
      fs.unlinkSync(src);
      return "move";
    }
  }
  fs.copyFileSync(src, dest);
  return "copy";
}

export function applyFileTransfer(opts: {
  sourceAbs: string;
  targetAbs: string;
  mode: OrganizeMode;
  fallback: OrganizeFallback;
  onConflict: OnConflict;
  dryRun?: boolean;
}): FsOpResult {
  const { sourceAbs, mode, fallback, onConflict, dryRun } = opts;
  let targetAbs = opts.targetAbs;

  if (!fs.existsSync(sourceAbs)) {
    return { ok: false, action: "skip", targetAbs, message: "源文件不存在" };
  }

  if (mode === "inplace") {
    return {
      ok: true,
      action: "inplace",
      targetAbs: sourceAbs,
      message: dryRun ? "dry-run 原地整理" : "原地整理，不迁移视频",
    };
  }

  ensureDir(path.dirname(targetAbs));

  if (fs.existsSync(targetAbs)) {
    if (sameFile(sourceAbs, targetAbs)) {
      return { ok: true, action: "skip", targetAbs, message: "目标已是同一文件" };
    }
    if (onConflict === "skip") {
      return { ok: true, action: "skip", targetAbs, message: "目标已存在，已跳过" };
    }
    if (onConflict === "rename") {
      targetAbs = renameTarget(targetAbs);
    } else if (onConflict === "overwrite" && !dryRun) {
      try {
        fs.unlinkSync(targetAbs);
      } catch {
        /* ignore */
      }
    } else if (onConflict === "overwrite" && dryRun) {
      return { ok: true, action: "overwrite", targetAbs, message: "dry-run 将覆盖" };
    }
  }

  if (dryRun) {
    return { ok: true, action: mode, targetAbs, message: "dry-run" };
  }

  try {
    if (mode === "softlink") {
      try {
        fs.symlinkSync(sourceAbs, targetAbs);
        return { ok: true, action: "softlink", targetAbs };
      } catch (err) {
        if (fallback === "fail") {
          return {
            ok: false,
            action: "softlink",
            targetAbs,
            message: err instanceof Error ? err.message : String(err),
          };
        }
        fs.copyFileSync(sourceAbs, targetAbs);
        return { ok: true, action: "copy", targetAbs, message: "软链失败，已 fallback copy" };
      }
    }

    if (mode === "hardlink") {
      try {
        fs.linkSync(sourceAbs, targetAbs);
      } catch (err) {
        if (fallback === "fail") {
          return {
            ok: false,
            action: "hardlink",
            targetAbs,
            message: err instanceof Error ? err.message : String(err),
          };
        }
        fs.copyFileSync(sourceAbs, targetAbs);
        return { ok: true, action: "copy", targetAbs, message: "硬链失败，已 fallback copy" };
      }
      return { ok: true, action: "hardlink", targetAbs };
    }

    const action = transfer(mode, sourceAbs, targetAbs);
    return { ok: true, action, targetAbs };
  } catch (err) {
    return {
      ok: false,
      action: mode,
      targetAbs,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export function copySidecar(src: string | null, dest: string | null, dryRun?: boolean): boolean {
  if (!src || !dest || !fs.existsSync(src)) return false;
  if (pathsReferToSameLocation(src, dest)) return true;
  if (dryRun) return true;
  ensureDir(path.dirname(dest));
  if (fs.existsSync(dest)) {
    try {
      fs.unlinkSync(dest);
    } catch {
      /* ignore */
    }
  }
  fs.copyFileSync(src, dest);
  return true;
}
