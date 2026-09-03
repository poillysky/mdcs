import {
  heightRatioToScalePercent,
  scalePercentToHeightRatio,
  type GlobalWatermarkConfig,
  type WatermarkCorner,
  type WatermarkLayout,
  type WatermarkPos,
} from "../../organize/watermarkConfig.js";
import { toBooleanOr, toNumberOr, toStringOr } from "./helpers.js";

function parseCorner(v: unknown, fallback: WatermarkCorner): WatermarkCorner {
  if (v === "top-left" || v === "top-right" || v === "bottom-left" || v === "bottom-right") {
    return v;
  }
  return fallback;
}

function parsePos(v: unknown, fallback: WatermarkPos): WatermarkPos {
  if (v === "auto") return "auto";
  if (v === "top-left" || v === "top-right" || v === "bottom-left" || v === "bottom-right") {
    return v;
  }
  return fallback;
}

function parseLayout(v: unknown, fallback: WatermarkLayout): WatermarkLayout {
  if (v === "stack" || v === "clockwise" || v === "counterclockwise") return v;
  return fallback;
}

export function normalizeWatermarkConfig(
  raw: Record<string, unknown>,
  base: GlobalWatermarkConfig,
): GlobalWatermarkConfig {
  const startPosition = parseCorner(
    raw.startPosition ?? raw.position,
    base.startPosition || base.position,
  );
  const position = parseCorner(raw.position, startPosition);

  let heightRatio: number;
  if (typeof raw.heightRatio === "number" && Number.isFinite(raw.heightRatio)) {
    heightRatio = Math.max(2, Math.min(40, Math.floor(raw.heightRatio)));
  } else if (typeof raw.scalePercent === "number" && Number.isFinite(raw.scalePercent)) {
    heightRatio = scalePercentToHeightRatio(raw.scalePercent);
  } else {
    heightRatio = base.heightRatio;
  }
  const scalePercent =
    typeof raw.scalePercent === "number" && Number.isFinite(raw.scalePercent)
      ? Math.max(1, Math.min(40, Math.floor(raw.scalePercent)))
      : heightRatioToScalePercent(heightRatio);

  return {
    enabled: toBooleanOr(raw.enabled, base.enabled),
    position,
    scalePercent,
    style: toStringOr(raw.style, base.style) || "default",
    style4k: toStringOr(raw.style4k, base.style4k) || "default",
    customDir: toStringOr(raw.customDir, base.customDir),
    layout: parseLayout(raw.layout, base.layout),
    startPosition,
    heightRatio,
    offsetX: Math.max(0, Math.floor(toNumberOr(raw.offsetX, base.offsetX))),
    offsetY: Math.max(0, Math.floor(toNumberOr(raw.offsetY, base.offsetY))),
    spacing: Math.max(0, Math.floor(toNumberOr(raw.spacing, base.spacing))),
    applyPoster: toBooleanOr(raw.applyPoster, base.applyPoster),
    applyThumb: toBooleanOr(raw.applyThumb, base.applyThumb),
    applyFanart: toBooleanOr(raw.applyFanart, base.applyFanart),
    markSubtitle: toBooleanOr(raw.markSubtitle, base.markSubtitle),
    markCracked: toBooleanOr(raw.markCracked, base.markCracked),
    markLeak: toBooleanOr(raw.markLeak, base.markLeak),
    markUncensored: toBooleanOr(raw.markUncensored, base.markUncensored),
    markCensored: toBooleanOr(raw.markCensored, base.markCensored),
    markResolution: toBooleanOr(raw.markResolution, base.markResolution),
    posSubtitle: parsePos(raw.posSubtitle, base.posSubtitle),
    posCracked: parsePos(raw.posCracked, base.posCracked),
    posLeak: parsePos(raw.posLeak, base.posLeak),
    posUncensored: parsePos(raw.posUncensored, base.posUncensored),
    posCensored: parsePos(raw.posCensored, base.posCensored),
    posResolution: parsePos(raw.posResolution, base.posResolution),
  };
}
