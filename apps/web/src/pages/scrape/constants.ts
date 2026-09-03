import type { ProviderCatalogRow } from "../../types";

export const FIELD_LABELS: Record<string, string> = {
  cover: "封面",
  titleZh: "中文标题",
  outline: "简介",
  plot: "剧情简介",
  originalPlot: "原简介",
  studio: "片商",
  actors: "演员",
  tags: "标签",
  series: "系列",
  title: "标题",
  originaltitle: "原标题",
  poster: "海报",
};

export const PROVIDER_UI_GROUPS: Array<{ id: ProviderCatalogRow["group"]; label: string }> = [
  { id: "av", label: "有码 AV" },
  { id: "uncensored", label: "无码 AV" },
  { id: "fc2", label: "FC2" },
  { id: "chinese", label: "国产" },
  { id: "western", label: "欧美" },
  { id: "general", label: "综合" },
];
