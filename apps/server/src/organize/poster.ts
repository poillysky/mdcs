import fs from "node:fs";
import path from "node:path";
import type { ScrapeConfig } from "../scrape/types.js";
import { PROJECT_ROOT, ensureDir, resolveFromRoot } from "../paths.js";
import { centerCropBox, resolveFaceCropRect } from "./faceCrop.js";
import {
  WATERMARK_PNG,
  type WatermarkCorner,
  type WatermarkMarkId,
  type WatermarkPos,
  resolveWatermarkAssetDir,
} from "./watermarkConfig.js";

export type WatermarkLabel = {
  id: WatermarkMarkId;
  text: string;
  color: string;
  fileName: string;
  fixedPos: WatermarkPos;
};

const CORNERS_CW: WatermarkCorner[] = [
  "top-left",
  "top-right",
  "bottom-right",
  "bottom-left",
];

/** 根据 mosaic / 字幕 / 分辨率决定角标；有码→无码→流出→破解逐级覆盖 */
export function resolveWatermarkLabels(
  mosaic: string | undefined,
  hasSubtitle: boolean,
  cfg: ScrapeConfig["watermark"],
  resolution?: string,
): WatermarkLabel[] {
  if (!cfg.enabled) return [];
  const labels: WatermarkLabel[] = [];
  const m = String(mosaic || "");

  if (cfg.markCracked && /破解/.test(m)) {
    labels.push({
      id: "cracked",
      text: "破解",
      color: "#ef4444",
      fileName: WATERMARK_PNG.cracked,
      fixedPos: cfg.posCracked || "auto",
    });
  } else if (cfg.markLeak && /流出/.test(m)) {
    labels.push({
      id: "leak",
      text: "流出",
      color: "#f97316",
      fileName: WATERMARK_PNG.leak,
      fixedPos: cfg.posLeak || "auto",
    });
  } else if (cfg.markUncensored && /无码/.test(m)) {
    labels.push({
      id: "uncensored",
      text: "无码",
      color: "#22c55e",
      fileName: WATERMARK_PNG.uncensored,
      fixedPos: cfg.posUncensored || "auto",
    });
  } else if (cfg.markCensored && /有码/.test(m)) {
    labels.push({
      id: "censored",
      text: "有码",
      color: "#64748b",
      fileName: WATERMARK_PNG.censored,
      fixedPos: cfg.posCensored || "auto",
    });
  }

  if (cfg.markSubtitle && hasSubtitle) {
    labels.push({
      id: "subtitle",
      text: "字幕",
      color: "#3b82f6",
      fileName: WATERMARK_PNG.subtitle,
      fixedPos: cfg.posSubtitle || "auto",
    });
  }

  const res = String(resolution || "").toUpperCase();
  if (cfg.markResolution && (res === "4K" || res === "8K")) {
    labels.push({
      id: "resolution",
      text: res,
      color: "#eab308",
      fileName: res === "8K" ? "8k.png" : "4k.png",
      fixedPos: cfg.posResolution || "auto",
    });
  }
  return labels;
}

function svgBadge(text: string, color: string, width: number, height: number): Buffer {
  const fontSize = Math.max(14, Math.floor(height * 0.55));
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${width}" height="${height}" rx="${Math.floor(height / 5)}" fill="${color}" fill-opacity="0.88"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
    font-family="Segoe UI, Microsoft YaHei, sans-serif" font-size="${fontSize}" font-weight="700" fill="#fff">${text}</text>
</svg>`;
  return Buffer.from(svg);
}

const BUILTIN_WATERMARK_DIR = "assets/watermarks/default";

async function loadMarkBuffer(
  cfg: ScrapeConfig["watermark"],
  mark: WatermarkLabel,
  fallback: { text: string; color: string; width: number; height: number },
): Promise<Buffer> {
  const customDir = resolveWatermarkAssetDir(cfg, mark.id);
  const candidates = [customDir.trim(), BUILTIN_WATERMARK_DIR].filter(Boolean);
  const sharp = (await import("sharp")).default;
  for (const dir of candidates) {
    const abs = path.isAbsolute(dir) ? dir : resolveFromRoot(dir, PROJECT_ROOT);
    const file = path.join(abs, mark.fileName);
    if (!fs.existsSync(file)) continue;
    try {
      return await sharp(file)
        .resize({ height: fallback.height, fit: "inside" })
        .png()
        .toBuffer();
    } catch {
      /* try next */
    }
  }
  return svgBadge(fallback.text, fallback.color, fallback.width, fallback.height);
}

function cornerXY(
  corner: WatermarkCorner,
  aw: number,
  ah: number,
  badgeW: number,
  badgeH: number,
  offsetX: number,
  offsetY: number,
): { left: number; top: number } {
  const ox = Math.max(0, offsetX);
  const oy = Math.max(0, offsetY);
  if (corner === "top-left") return { left: ox, top: oy };
  if (corner === "top-right") return { left: aw - badgeW - ox, top: oy };
  if (corner === "bottom-left") return { left: ox, top: ah - badgeH - oy };
  return { left: aw - badgeW - ox, top: ah - badgeH - oy };
}

function nextCorner(start: WatermarkCorner, index: number, dir: 1 | -1): WatermarkCorner {
  const i0 = CORNERS_CW.indexOf(start);
  const i = (i0 + dir * index + CORNERS_CW.length * 8) % CORNERS_CW.length;
  return CORNERS_CW[i]!;
}

export type CropRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type ProcessPosterOpts = {
  cropMode: string;
  cropRatio?: "full" | "emby";
  cropIndependentPoster?: boolean;
  preferCropResult?: boolean;
  /** 手动裁剪框（原图像素）；有则优先于自动 right/face */
  cropRect?: CropRect | null;
  watermark: ScrapeConfig["watermark"];
  mosaic?: string;
  hasSubtitle?: boolean;
  /** 720P/1080P/4K/8K */
  resolution?: string;
  /** 当前处理的图片类型（控制 applyPoster/Thumb/Fanart） */
  imageKind?: "poster" | "thumb" | "fanart";
  overwriteImages?: boolean;
  dryRun?: boolean;
};

function clampCropRect(
  rect: CropRect,
  imageWidth: number,
  imageHeight: number,
): CropRect {
  const w = Math.max(1, Math.min(Math.round(rect.width), imageWidth));
  const h = Math.max(1, Math.min(Math.round(rect.height), imageHeight));
  const maxLeft = Math.max(0, imageWidth - w);
  const maxTop = Math.max(0, imageHeight - h);
  return {
    left: Math.max(0, Math.min(Math.round(rect.left), maxLeft)),
    top: Math.max(0, Math.min(Math.round(rect.top), maxTop)),
    width: w,
    height: h,
  };
}

function allowWatermarkOnKind(
  cfg: ScrapeConfig["watermark"],
  kind: "poster" | "thumb" | "fanart",
): boolean {
  if (kind === "thumb") return cfg.applyThumb !== false;
  if (kind === "fanart") return Boolean(cfg.applyFanart);
  return cfg.applyPoster !== false;
}

/**
 * 裁剪（right / face / 独立中心）+ 可选水印，写出到 dest。
 */
export async function processPosterImage(
  src: string,
  dest: string,
  opts: ProcessPosterOpts,
): Promise<boolean> {
  if (opts.dryRun) return true;
  if (opts.overwriteImages === false && fs.existsSync(dest)) {
    return false;
  }

  const imageKind = opts.imageKind || "poster";
  const labels = allowWatermarkOnKind(opts.watermark, imageKind)
    ? resolveWatermarkLabels(
        opts.mosaic,
        Boolean(opts.hasSubtitle),
        opts.watermark,
        opts.resolution,
      )
    : [];

  const manualRect = opts.cropRect;
  const hasManualRect =
    manualRect &&
    Number.isFinite(manualRect.width) &&
    Number.isFinite(manualRect.height) &&
    manualRect.width > 0 &&
    manualRect.height > 0;

  const allowKindCrop = opts.preferCropResult !== false;
  const needKindCrop =
    !hasManualRect && allowKindCrop && (opts.cropMode === "right" || opts.cropMode === "face");
  const needIndependent = !hasManualRect && Boolean(opts.cropIndependentPoster) && !needKindCrop;
  if (!hasManualRect && !needKindCrop && !needIndependent && !labels.length) {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
    return true;
  }

  const sharp = (await import("sharp")).default;
  ensureDir(path.dirname(dest));

  const targetRatio = opts.cropRatio === "emby" ? 2 / 3 : 2.12 / 3;
  const meta = await sharp(src).metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;
  let extract: { left: number; top: number; width: number; height: number } | null = null;

  if (w > 0 && h > 0) {
    if (hasManualRect && manualRect) {
      extract = clampCropRect(manualRect, w, h);
    } else if (needKindCrop && opts.cropMode === "right") {
      const cropW = Math.max(1, Math.floor(w * 0.47));
      const left0 = Math.max(0, w - cropW);
      const box = centerCropBox(cropW, h, targetRatio);
      extract = {
        left: left0 + box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      };
    } else if (needKindCrop && opts.cropMode === "face") {
      const { rect } = await resolveFaceCropRect(src, w, h, targetRatio);
      extract = rect;
    } else if (needIndependent) {
      extract = centerCropBox(w, h, targetRatio);
    }
  }

  let img = extract ? sharp(src).extract(extract) : sharp(src);

  if (labels.length) {
    const buf = await img.toBuffer();
    const after = sharp(buf);
    const am = await after.metadata();
    const aw = am.width || w || 800;
    const ah = am.height || h || 1200;
    const cfg = opts.watermark;
    const ratio = Math.max(2, cfg.heightRatio || Math.round(100 / (cfg.scalePercent || 12)));
    const badgeH = Math.max(20, Math.floor(ah / ratio));
    const gap = Math.max(0, cfg.spacing ?? 0) || Math.floor(badgeH * 0.15);
    const offsetX = Math.max(0, cfg.offsetX ?? 0);
    const offsetY = Math.max(0, cfg.offsetY ?? 0);
    const start = cfg.startPosition || cfg.position || "top-left";
    const layout = cfg.layout || "stack";

    const composites: Array<{ input: Buffer; left: number; top: number }> = [];
    let stackIndex = 0;
    let cornerIndex = 0;

    for (const label of labels) {
      const badgeW = Math.max(badgeH * 2, label.text.length * Math.floor(badgeH * 0.7) + badgeH);
      const input = await loadMarkBuffer(cfg, label, {
        text: label.text,
        color: label.color,
        width: badgeW,
        height: badgeH,
      });
      const metaMark = await sharp(input).metadata();
      const mw = metaMark.width || badgeW;
      const mh = metaMark.height || badgeH;

      let left = 0;
      let top = 0;
      if (label.fixedPos && label.fixedPos !== "auto") {
        const xy = cornerXY(label.fixedPos, aw, ah, mw, mh, offsetX, offsetY);
        left = xy.left;
        top = xy.top;
      } else if (layout === "stack") {
        const xy = cornerXY(start, aw, ah, mw, mh, offsetX, offsetY);
        // 横向堆叠：沿起始角水平方向延伸
        const goRight = start.includes("left");
        left = goRight ? xy.left + stackIndex * (mw + gap) : xy.left - stackIndex * (mw + gap);
        top = xy.top;
        stackIndex += 1;
      } else {
        const dir: 1 | -1 = layout === "clockwise" ? 1 : -1;
        const corner = nextCorner(start, cornerIndex, dir);
        const xy = cornerXY(corner, aw, ah, mw, mh, offsetX, offsetY);
        left = xy.left;
        top = xy.top;
        cornerIndex += 1;
      }

      composites.push({
        input,
        left: Math.max(0, Math.min(aw - mw, Math.round(left))),
        top: Math.max(0, Math.min(ah - mh, Math.round(top))),
      });
    }
    await after.composite(composites).jpeg({ quality: 90 }).toFile(dest);
    return true;
  }

  await img.jpeg({ quality: 90 }).toFile(dest);
  return true;
}

/** thumb：不裁剪，可选 thumb 水印，从原始封面源写出 */
export async function processThumbImage(
  src: string,
  dest: string,
  opts: Omit<ProcessPosterOpts, "cropMode" | "cropIndependentPoster" | "preferCropResult" | "imageKind">,
): Promise<boolean> {
  return processPosterImage(src, dest, {
    ...opts,
    cropMode: "none",
    cropIndependentPoster: false,
    preferCropResult: false,
    imageKind: "thumb",
  });
}
