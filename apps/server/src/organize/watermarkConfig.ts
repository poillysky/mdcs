/** 全局水印配置（设置·水印） */

export type WatermarkCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type WatermarkPos = "auto" | WatermarkCorner;
export type WatermarkLayout = "stack" | "clockwise" | "counterclockwise";
export type WatermarkMarkId =
  | "subtitle"
  | "cracked"
  | "leak"
  | "uncensored"
  | "censored"
  | "resolution";

export type GlobalWatermarkConfig = {
  enabled: boolean;
  /** 兼容旧字段 / 任务覆盖：等同 startPosition */
  position: WatermarkCorner;
  /** 兼容旧字段：由 heightRatio 同步，约等于 100/heightRatio */
  scalePercent: number;
  /** 基本样式 id（暂仅 default） */
  style: string;
  /** 4K/8K 样式 id（暂仅 default） */
  style4k: string;
  /** 自定义 PNG 目录（相对项目根或绝对路径） */
  customDir: string;
  layout: WatermarkLayout;
  startPosition: WatermarkCorner;
  /** 图片高度 / 水印高度，默认 9 */
  heightRatio: number;
  offsetX: number;
  offsetY: number;
  spacing: number;
  applyPoster: boolean;
  applyThumb: boolean;
  applyFanart: boolean;
  markSubtitle: boolean;
  markCracked: boolean;
  markLeak: boolean;
  markUncensored: boolean;
  markCensored: boolean;
  /** 4K / 8K */
  markResolution: boolean;
  posSubtitle: WatermarkPos;
  posCracked: WatermarkPos;
  posLeak: WatermarkPos;
  posUncensored: WatermarkPos;
  posCensored: WatermarkPos;
  posResolution: WatermarkPos;
};

export const WATERMARK_PNG: Record<WatermarkMarkId, string> = {
  censored: "youma.png",
  uncensored: "wuma.png",
  cracked: "umr.png",
  leak: "leak.png",
  subtitle: "sub.png",
  resolution: "4k.png", // 8K 运行时改用 8k.png
};

export function defaultWatermarkConfig(): GlobalWatermarkConfig {
  return {
    enabled: true,
    position: "top-left",
    scalePercent: 11,
    style: "default",
    style4k: "default",
    customDir: "assets/watermarks/default",
    layout: "stack",
    startPosition: "top-left",
    heightRatio: 9,
    offsetX: 0,
    offsetY: 0,
    spacing: 0,
    applyPoster: true,
    applyThumb: true,
    applyFanart: false,
    markSubtitle: true,
    markCracked: true,
    markLeak: true,
    markUncensored: true,
    markCensored: false,
    markResolution: true,
    posSubtitle: "auto",
    posCracked: "auto",
    posLeak: "auto",
    posUncensored: "auto",
    posCensored: "auto",
    posResolution: "auto",
  };
}

export function heightRatioToScalePercent(ratio: number): number {
  const r = Math.max(2, Math.min(40, Math.floor(ratio) || 9));
  return Math.max(1, Math.min(40, Math.round(100 / r)));
}

export function scalePercentToHeightRatio(percent: number): number {
  const p = Math.max(1, Math.min(40, Math.floor(percent) || 12));
  return Math.max(2, Math.min(40, Math.round(100 / p)));
}

/** 解析水印 PNG 目录：customDir 优先，否则 assets/watermarks/{style|style4k} */
export function resolveWatermarkAssetDir(
  cfg: Pick<GlobalWatermarkConfig, "customDir" | "style" | "style4k">,
  markId?: WatermarkMarkId,
): string {
  const custom = (cfg.customDir || "").trim();
  if (custom) return custom;
  const isRes = markId === "resolution";
  const styleId = (isRes ? cfg.style4k : cfg.style) || "default";
  const safe = styleId.replace(/[^a-zA-Z0-9_-]/g, "") || "default";
  return `assets/watermarks/${safe}`;
}
