import { KIND_LABELS } from "../../lib/labels";
import type { NotifyFn } from "../../lib/notify";
import type { ScrapeConfig } from "../../types";

export type Props = {
  notify: NotifyFn;
  embedded?: boolean;
  value?: ScrapeConfig;
  onChange?: (next: ScrapeConfig) => void;
};

export type Naming = NonNullable<ScrapeConfig["naming"]>;

export type PreviewResult = {
  targetRel: string;
  fileName: string;
  relativeDir: string;
  mediaTitle?: string;
};

export type FieldTab = "category" | "mosaic" | "subtitle" | "resolution";

export const DEFAULT_NAMING: Naming = {
  directoryTemplate: "{category}/{studio}/{series_name}/{number}",
  mediaTitleTemplate: "{title}",
  fileNameTemplate: "{number}",
  imageNameMode: "none",
  maxDirectoryLength: 0,
  actorDisplayLimit: 3,
  nameSuffixTemplate: "",
  videoSuffixTemplate: "{mosaic}{subtitle}{resolution}{part}",
  posterCrop: "right",
  categoryLabels: {
    japan_censored: "日本有码",
    japan_gravure: "日本写真",
    japan_uncensored: "日本无码",
    japan_amateur: "素人",
    fc2: "FC2",
    china: "国产",
    western: "欧美",
    unknown: "未知",
  },
  categoryRules: [],
  mosaicLabels: {
    cracked: "无码破解",
    leak: "无码流出",
    uncensored: "无码",
    censored: "有码",
  },
  mosaicSuffixLabels: {
    cracked: "-破解",
    leak: "-流出",
    uncensored: "",
    censored: "",
  },
  subtitleLabel: "中字",
  noSubtitleLabel: "无字幕",
  subtitleSuffixLabel: "",
  subtitleAddChsSuffix: false,
  partSuffixTemplate: "-cd{part}",
  resolutionFieldTemplate: "",
  resolutionTextMap: "720P, 1080P, 4K, 8K",
  resolutionEnabled: { "720P": true, "1080P": true, "4K": true, "8K": true },
  resolutionInactiveLabel: "1080P",
  resolutionSuffixTemplate: "",
  resolutionSuffixEnabled: { "720P": true, "1080P": true, "4K": true, "8K": true },
  resolutionSource: "prefer_path",
  resolutionFallback: true,
};

export const CATEGORY_KIND_ITEMS = (
  [
    "japan_censored",
    "japan_gravure",
    "japan_uncensored",
    "japan_amateur",
    "fc2",
    "china",
    "western",
  ] as const
).map((id) => [id, KIND_LABELS[id] || id] as const);

export const FIELD_TABS: { id: FieldTab; label: string; field: string }[] = [
  { id: "category", label: "分类", field: "category" },
  { id: "mosaic", label: "马赛克", field: "mosaic" },
  { id: "subtitle", label: "字幕", field: "subtitle" },
  { id: "resolution", label: "分辨率", field: "resolution" },
];
