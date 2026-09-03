import type { SettingsSaveActions } from "../../hooks/useDirtyBaseline";
import type { NotifyFn } from "../../lib/notify";
import type { ScrapeConfig } from "../../types";

export type WatermarkSettingsPanelProps = {
  notify: NotifyFn;
  embedded?: boolean;
  value?: ScrapeConfig;
  onChange?: (next: ScrapeConfig) => void;
  onActionsChange?: (actions: SettingsSaveActions | null) => void;
};

export type { SettingsSaveActions as WatermarkSaveActions };

export type Wm = NonNullable<ScrapeConfig["watermark"]>;
export type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type Pos = "auto" | Corner;

export const DEFAULT_WATERMARK: Wm = {
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

export const CORNER_OPTS: { value: Corner; label: string }[] = [
  { value: "top-left", label: "左上角" },
  { value: "top-right", label: "右上角" },
  { value: "bottom-left", label: "左下角" },
  { value: "bottom-right", label: "右下角" },
];

export const POS_OPTS: { value: Pos; label: string }[] = [
  { value: "auto", label: "自动" },
  ...CORNER_OPTS,
];

export type PreviewMark = { id: string; text: string; tone: string; file: string; pos: Pos };

export function asPos(v: string | undefined): Pos {
  if (
    v === "auto" ||
    v === "top-left" ||
    v === "top-right" ||
    v === "bottom-left" ||
    v === "bottom-right"
  ) {
    return v;
  }
  return "auto";
}

export function asCorner(v: string | undefined): Corner {
  if (v === "top-left" || v === "top-right" || v === "bottom-left" || v === "bottom-right") {
    return v;
  }
  return "top-left";
}
