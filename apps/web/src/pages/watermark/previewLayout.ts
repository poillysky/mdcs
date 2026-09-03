import type { CSSProperties } from "react";
import {
  asCorner,
  asPos,
  type PreviewMark,
  type Corner,
  type Wm,
} from "./types";

export const PREVIEW_ASSET = "/watermarks/default";

export function buildPreviewMarks(w: Wm, showAll: boolean): PreviewMark[] {
  const all: PreviewMark[] = [];
  if (w.markResolution) {
    all.push({
      id: "res4k",
      text: "4K",
      tone: "res",
      file: "4k.png",
      pos: asPos(w.posResolution),
    });
    if (showAll) {
      all.push({
        id: "res8k",
        text: "8K",
        tone: "res",
        file: "8k.png",
        pos: asPos(w.posResolution),
      });
    }
  }
  if (w.markSubtitle) {
    all.push({ id: "sub", text: "字幕", tone: "sub", file: "sub.png", pos: asPos(w.posSubtitle) });
  }
  if (w.markCracked) {
    all.push({
      id: "cracked",
      text: "破解",
      tone: "cracked",
      file: "umr.png",
      pos: asPos(w.posCracked),
    });
  }
  if (w.markLeak) {
    all.push({ id: "leak", text: "流出", tone: "leak", file: "leak.png", pos: asPos(w.posLeak) });
  }
  if (w.markUncensored) {
    all.push({
      id: "wuma",
      text: "无码",
      tone: "wuma",
      file: "wuma.png",
      pos: asPos(w.posUncensored),
    });
  }
  if (w.markCensored) {
    all.push({
      id: "youma",
      text: "有码",
      tone: "youma",
      file: "youma.png",
      pos: asPos(w.posCensored),
    });
  }

  if (showAll) return all;

  const out: PreviewMark[] = [];
  if (w.markResolution) out.push(all.find((x) => x.id === "res4k")!);
  if (w.markSubtitle) out.push(all.find((x) => x.id === "sub")!);
  const mosaic =
    (w.markCracked && all.find((x) => x.id === "cracked")) ||
    (w.markLeak && all.find((x) => x.id === "leak")) ||
    (w.markUncensored && all.find((x) => x.id === "wuma")) ||
    (w.markCensored && all.find((x) => x.id === "youma"));
  if (mosaic) out.push(mosaic);
  return out.filter(Boolean);
}

export function resolveCorner(mark: PreviewMark, index: number, w: Wm): Corner {
  const start = asCorner(w.startPosition || w.position || "top-left");
  if (mark.pos !== "auto") return mark.pos;
  if (w.layout === "stack") return start;
  const order: Corner[] = ["top-left", "top-right", "bottom-right", "bottom-left"];
  const i0 = order.indexOf(start);
  const dir = w.layout === "clockwise" ? 1 : -1;
  return order[(i0 + dir * index + 8) % 4]!;
}

/** 预览尺寸：跟 heightRatio，但预览框里再缩小一档（真整理仍按配置） */
export function markHeightPct(w: Wm): number {
  const r = Math.max(2, w.heightRatio || 9);
  const raw = 100 / r;
  return Math.max(4, Math.min(14, raw * 0.55));
}

/** 角标宽度约占预览框宽度的百分比（胶囊约 1.875，分辨率标约 1.11） */
export function markWidthPctOfFrame(mark: PreviewMark, hPct: number): number {
  const aspect = mark.tone === "res" ? 355 / 320 : 600 / 320;
  return hPct * aspect * 1.5;
}

export function placeStyle(
  mark: PreviewMark,
  index: number,
  w: Wm,
  marks: PreviewMark[],
): CSSProperties {
  const corner = resolveCorner(mark, index, w);
  const ox = w.offsetX || 0;
  const oy = w.offsetY || 0;
  const gapPct = Math.max(0, w.spacing || 0) * 0.05 + 0.6;
  const hPct = markHeightPct(w);
  const sameBefore = marks.slice(0, index).filter((m, j) => resolveCorner(m, j, w) === corner);
  const stackMode = mark.pos === "auto" && w.layout === "stack";
  const stackXPct = stackMode
    ? sameBefore.reduce((sum, m) => sum + markWidthPctOfFrame(m, hPct) + gapPct, 0)
    : 0;
  const stackYPct = stackMode ? 0 : sameBefore.length * (hPct * 0.55 + gapPct);

  const base: CSSProperties = {
    position: "absolute",
    height: `${hPct}%`,
    width: "auto",
  };

  const insetX = `calc(8px + ${ox}px)`;
  const insetY = `calc(8px + ${oy}px)`;

  if (corner === "top-left") {
    return {
      ...base,
      top: stackYPct ? `calc(${insetY} + ${stackYPct}%)` : insetY,
      left: stackXPct ? `calc(${insetX} + ${stackXPct}%)` : insetX,
    };
  }
  if (corner === "top-right") {
    return {
      ...base,
      top: stackYPct ? `calc(${insetY} + ${stackYPct}%)` : insetY,
      right: stackXPct ? `calc(${insetX} + ${stackXPct}%)` : insetX,
    };
  }
  if (corner === "bottom-left") {
    return {
      ...base,
      bottom: stackYPct ? `calc(${insetY} + ${stackYPct}%)` : insetY,
      left: stackXPct ? `calc(${insetX} + ${stackXPct}%)` : insetX,
    };
  }
  return {
    ...base,
    bottom: stackYPct ? `calc(${insetY} + ${stackYPct}%)` : insetY,
    right: stackXPct ? `calc(${insetX} + ${stackXPct}%)` : insetX,
  };
}
