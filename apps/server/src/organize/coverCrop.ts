import fs from "node:fs";
import path from "node:path";
import {
  getPathRoot,
  loadLibrariesConfig,
  resolveKind,
} from "../config/loadConfig.js";
import { resolveKindScrapePrefs } from "../config/loadScrape.js";
import {
  DATA_DIR,
  ensureDir,
  pathExists,
  PROJECT_ROOT,
  resolveFromRoot,
  toPosixRelative,
} from "../paths.js";
import { assertRelativePathAllowed } from "../security/pathPolicy.js";
import type { GlobalWatermarkConfig } from "./watermarkConfig.js";
import {
  findCachedCoverAbs,
  findLibraryAssetAbs,
  listGalleryAssets,
  resolveMovieDirForFile,
  type LibraryAssetRole,
} from "../api/libraryAssets.js";
import type { KindId } from "../types.js";
import { processPosterImage, processThumbImage, type CropRect } from "./poster.js";

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"]);

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  "dist",
  "apps",
  "references",
  "data",
]);

export type CoverCropBrowseEntry = {
  name: string;
  relative: string;
  kind: "dir" | "file";
  mtime: number;
};

export type CoverCropBrowseResult = {
  parent: string;
  folders: CoverCropBrowseEntry[];
  files: CoverCropBrowseEntry[];
};

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

export type CoverCropStyle = "full" | "emby" | "horizontal";

export type CoverCropMarks = {
  subtitle?: boolean;
  /** censored | uncensored | leak | none */
  mosaic?: string;
  cracked?: boolean;
  /** none | 4K | 8K */
  resolution?: string;
};

export type CoverCropRequest = {
  source?: string;
  uploadToken?: string;
  cropStyle: CoverCropStyle;
  cropRect?: CropRect | null;
  marks?: CoverCropMarks;
  replaceThumb?: boolean;
};

export type CoverCropSourceInfo = {
  sourceKey: string;
  path: string;
  abs: string;
  width: number;
  height: number;
  previewUrl: string;
};

const UPLOAD_DIR = path.join(DATA_DIR, "tmp", "cover-crop");

function absFromToken(token: string): string | null {
  const safe = String(token || "").trim();
  if (!safe || safe.includes("..") || safe.includes("/") || safe.includes("\\")) return null;
  const abs = path.join(UPLOAD_DIR, safe);
  if (!pathExists(abs)) return null;
  return abs;
}

export function saveCoverCropUpload(fileId: number, buffer: Buffer, ext = ".jpg"): string {
  ensureDir(UPLOAD_DIR);
  const token = `${fileId}-${Date.now()}${ext}`;
  const abs = path.join(UPLOAD_DIR, token);
  fs.writeFileSync(abs, buffer);
  return token;
}

function displayPathForAbs(abs: string): string {
  const rel = toPosixRelative(abs, PROJECT_ROOT).replace(/^\/+/, "");
  if (!rel.startsWith("..")) return rel ? `/${rel}` : "/";
  return abs.replace(/\\/g, "/");
}

async function readImageSize(abs: string): Promise<{ width: number; height: number }> {
  const sharp = (await import("sharp")).default;
  const meta = await sharp(abs).metadata();
  return { width: meta.width || 0, height: meta.height || 0 };
}

function pickLocalSource(
  file: FileRow,
  role: LibraryAssetRole,
  fanartIndex?: number,
): string | null {
  return findLibraryAssetAbs(file, role, fanartIndex);
}

function resolveCustomSourceAbs(source: string): string | null {
  const raw = String(source || "").trim();
  if (!raw || raw === "local" || raw === "upload") return null;
  const config = loadLibrariesConfig();
  const root = getPathRoot(config);
  if (path.isAbsolute(raw) || /^[a-zA-Z]:[\\/]/.test(raw)) {
    const abs = path.resolve(raw);
    const inside = path.relative(root, abs);
    if (inside.startsWith("..") || path.isAbsolute(inside)) return null;
    if (!pathExists(abs) || !fs.statSync(abs).isFile()) return null;
    return abs;
  }
  const rel = assertRelativePathAllowed(raw, config);
  const abs = resolveFromRoot(rel, root);
  if (!pathExists(abs) || !fs.statSync(abs).isFile()) return null;
  return abs;
}

/** 浏览 pathRoot 下目录与图片文件（封面裁剪手动选择） */
export function listCoverCropBrowse(parent = ""): CoverCropBrowseResult {
  const config = loadLibrariesConfig();
  const root = getPathRoot(config);
  const rel = parent.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (rel) assertRelativePathAllowed(rel, config);
  const abs = rel ? resolveFromRoot(rel, root) : root;
  const inside = path.relative(root, abs);
  if (inside.startsWith("..") || path.isAbsolute(inside)) {
    return { parent: "", folders: [], files: [] };
  }

  const folders: CoverCropBrowseEntry[] = [];
  const files: CoverCropBrowseEntry[] = [];
  if (!pathExists(abs)) return { parent: rel, folders, files };

  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(abs, { withFileTypes: true });
  } catch {
    return { parent: rel, folders, files };
  }

  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    const childRel = rel ? `${rel}/${ent.name}` : ent.name;
    let mtime = 0;
    try {
      mtime = Math.floor(fs.statSync(path.join(abs, ent.name)).mtimeMs);
    } catch {
      /* ignore */
    }
    if (ent.isDirectory()) {
      if (SKIP_DIR_NAMES.has(ent.name)) continue;
      folders.push({ name: ent.name, relative: childRel, kind: "dir", mtime });
      continue;
    }
    if (!ent.isFile()) continue;
    const ext = path.extname(ent.name).toLowerCase();
    if (!IMAGE_EXTS.has(ext)) continue;
    files.push({ name: ent.name, relative: childRel, kind: "file", mtime });
  }

  folders.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  files.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  return { parent: rel, folders, files };
}

/** 解析裁剪原图：upload > custom > thumb > cache > poster > fanart */
export async function resolveCoverCropSource(
  file: FileRow,
  opts?: { source?: string; uploadToken?: string },
): Promise<CoverCropSourceInfo | null> {
  let abs: string | null = null;
  let sourceKey = "local";
  let customRel = "";

  if (opts?.uploadToken) {
    abs = absFromToken(opts.uploadToken);
    sourceKey = "upload";
  } else if (opts?.source === "upload" && opts.uploadToken) {
    abs = absFromToken(opts.uploadToken);
    sourceKey = "upload";
  } else if (opts?.source && opts.source !== "local") {
    abs = resolveCustomSourceAbs(opts.source);
    if (abs) {
      sourceKey = "custom";
      customRel = String(opts.source).replace(/\\/g, "/").replace(/^\/+/, "");
    }
  }

  if (!abs) {
    abs =
      pickLocalSource(file, "thumb") ||
      (file.code ? findCachedCoverAbs(file.code, file.kind) : null) ||
      pickLocalSource(file, "poster") ||
      listGalleryAssets(file).find((g) => g.role === "fanart")?.abs ||
      null;
    sourceKey = "local";
  }

  if (!abs || !pathExists(abs)) return null;
  const { width, height } = await readImageSize(abs);
  if (width <= 0 || height <= 0) return null;

  const qs = new URLSearchParams();
  if (sourceKey === "upload" && opts?.uploadToken) {
    qs.set("uploadToken", opts.uploadToken);
  } else if (sourceKey === "custom" && customRel) {
    qs.set("source", customRel);
  }
  const q = qs.toString();
  const previewUrl = `/api/files/${file.id}/cover-crop/preview${q ? `?${q}` : ""}`;

  return {
    sourceKey,
    path: displayPathForAbs(abs),
    abs,
    width,
    height,
    previewUrl,
  };
}

export function buildCropWatermarkConfig(
  base: GlobalWatermarkConfig,
  marks: CoverCropMarks | undefined,
): GlobalWatermarkConfig {
  const m = marks ?? {};
  const mosaic = String(m.mosaic || "none");
  return {
    ...base,
    enabled: true,
    markSubtitle: Boolean(m.subtitle),
    markCensored: mosaic === "censored",
    markUncensored: mosaic === "uncensored",
    markLeak: mosaic === "leak",
    markCracked: Boolean(m.cracked),
    markResolution: m.resolution === "4K" || m.resolution === "8K",
  };
}

function marksToMosaic(marks: CoverCropMarks | undefined, fallback?: string | null): string {
  if (marks?.cracked) return "破解";
  const mosaic = String(marks?.mosaic || "");
  if (mosaic === "leak") return "流出";
  if (mosaic === "uncensored") return "无码";
  if (mosaic === "censored") return "有码";
  return String(fallback || "");
}

function defaultCropRect(
  width: number,
  height: number,
  style: CoverCropStyle,
): CropRect {
  const ratio =
    style === "emby" ? 2 / 3 : style === "horizontal" ? 16 / 9 : 2.12 / 3;
  let cw: number;
  let ch: number;
  if (width / height >= ratio) {
    ch = height;
    cw = Math.floor(height * ratio);
  } else {
    cw = width;
    ch = Math.floor(width / ratio);
  }
  cw = Math.max(1, Math.min(cw, width));
  ch = Math.max(1, Math.min(ch, height));
  const left =
    style === "horizontal"
      ? Math.max(0, Math.floor((width - cw) / 2))
      : Math.max(0, width - cw);
  const top = Math.max(0, Math.floor((height - ch) / 2));
  return { left, top, width: cw, height: ch };
}

export async function applyCoverCrop(
  file: FileRow,
  body: CoverCropRequest,
): Promise<{ posterPath: string; thumbPath?: string; updatedAt: number }> {
  const movieDir = resolveMovieDirForFile(file);
  if (!movieDir) {
    throw new Error("未找到片库目录，请先整理入库或配置库路径");
  }

  const source = await resolveCoverCropSource(file, {
    source: body.source,
    uploadToken: body.uploadToken,
  });
  if (!source) throw new Error("原图不存在");

  const prefs = resolveKindScrapePrefs(file.kind);
  const watermark = buildCropWatermarkConfig(prefs.watermark, body.marks);
  const mosaic = marksToMosaic(body.marks, file.mosaic);
  const resolution =
    body.marks?.resolution && body.marks.resolution !== "none"
      ? body.marks.resolution
      : undefined;
  const hasSubtitle = Boolean(body.marks?.subtitle);
  const cropStyle = body.cropStyle || "full";
  const cropRatio = cropStyle === "emby" ? "emby" : "full";
  const cropRect =
    body.cropRect && body.cropRect.width > 0 && body.cropRect.height > 0
      ? body.cropRect
      : defaultCropRect(source.width, source.height, cropStyle);

  const posterAbs = path.join(movieDir, "poster.jpg");
  const thumbAbs = path.join(movieDir, "thumb.jpg");
  ensureDir(movieDir);

  if (cropStyle === "horizontal") {
    await processPosterImage(source.abs, thumbAbs, {
      cropMode: "none",
      cropRatio,
      cropRect,
      watermark,
      mosaic,
      hasSubtitle,
      resolution,
      imageKind: "thumb",
      overwriteImages: true,
      preferCropResult: true,
    });
    return {
      posterPath: toPosixRelative(posterAbs),
      thumbPath: toPosixRelative(thumbAbs),
      updatedAt: Date.now(),
    };
  }

  await processPosterImage(source.abs, posterAbs, {
    cropMode: "none",
    cropRatio,
    cropRect,
    watermark,
    mosaic,
    hasSubtitle,
    resolution,
    imageKind: "poster",
    overwriteImages: true,
    preferCropResult: true,
  });

  if (body.replaceThumb) {
    await processThumbImage(source.abs, thumbAbs, {
      cropRatio,
      watermark,
      mosaic,
      hasSubtitle,
      resolution,
      overwriteImages: true,
    });
  }

  return {
    posterPath: toPosixRelative(posterAbs),
    thumbPath: body.replaceThumb ? toPosixRelative(thumbAbs) : undefined,
    updatedAt: Date.now(),
  };
}

export function resolveCoverCropPreviewAbs(
  file: FileRow,
  opts?: { uploadToken?: string; source?: string },
): Promise<string | null> {
  return resolveCoverCropSource(file, opts).then((s) => s?.abs ?? null);
}

export function libraryDisplayRoot(kindId: KindId): string {
  const kind = resolveKind(kindId, loadLibrariesConfig());
  if (!kind?.libraryAbs) return "";
  return kind.libraryAbs.replace(/\\/g, "/");
}
