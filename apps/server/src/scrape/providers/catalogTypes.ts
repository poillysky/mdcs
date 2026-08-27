import type { SourceId } from "../types.js";

export type ProviderAccess = "direct" | "proxy" | "proxy_flare" | "proxy_adaptive";

/** 写出档仅两档：自适应（含旧 proxy/direct）| 强制过盾 */
export type NormalizedProviderAccess = "proxy_adaptive" | "proxy_flare";

export function normalizeProviderAccess(access?: string | null): NormalizedProviderAccess {
  if (access === "proxy_flare") return "proxy_flare";
  return "proxy_adaptive";
}

/** UI 同组内卡片顺序：自适应 → 过盾（旧 proxy 归一为自适应） */
export const PROVIDER_ACCESS_SORT_ORDER: Record<NormalizedProviderAccess, number> = {
  proxy_adaptive: 0,
  proxy_flare: 1,
};

export function providerAccessSortKey(access?: string | null): number {
  return PROVIDER_ACCESS_SORT_ORDER[normalizeProviderAccess(access)];
}

export function compareProviderCatalogEntries(
  a: Pick<ProviderCatalogEntry, "access" | "implemented" | "label">,
  b: Pick<ProviderCatalogEntry, "access" | "implemented" | "label">,
): number {
  const accessDiff = providerAccessSortKey(a.access) - providerAccessSortKey(b.access);
  if (accessDiff !== 0) return accessDiff;
  if (a.implemented !== b.implemented) return a.implemented ? -1 : 1;
  return a.label.localeCompare(b.label, "zh-CN");
}

export function sortProviderCatalogEntries<T extends ProviderCatalogEntry>(entries: T[]): T[] {
  return [...entries].sort(compareProviderCatalogEntries);
}

export type SourceTier = 1 | 2 | 3 | 4 | 5;

/** UI 分组：片种专组 + 综合（跨品类聚合） */
export type ProviderGroup = "av" | "uncensored" | "fc2" | "chinese" | "western" | "general";

export const PROVIDER_GROUP_ORDER: ProviderGroup[] = [
  "av",
  "uncensored",
  "fc2",
  "chinese",
  "western",
  "general",
];

export const PROVIDER_GROUP_LABELS: Record<ProviderGroup, string> = {
  av: "有码 AV",
  general: "综合",
  uncensored: "无码 AV",
  fc2: "FC2",
  chinese: "国产",
  western: "欧美",
};

export type ProviderCatalogEntry = {
  id: SourceId;
  label: string;
  defaultUrl: string;
  probePath: string;
  access: ProviderAccess;
  group: ProviderGroup;
  tier: SourceTier;
  probeable?: boolean;
  defaultCooldownSec?: number;
  defaultCookie?: string;
  needsApiKey?: boolean;
  implemented: boolean;
  mdcx?: string;
  notes?: string;
};

export type ProviderCatalogRow = ProviderCatalogEntry & {
  registered: boolean;
  enabled: boolean;
};
