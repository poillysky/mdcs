import type { ProviderCatalogRow } from "../types";

export const PROVIDER_REGION_GROUPS: Array<{
  id: string;
  label: string;
  serverGroups: ProviderCatalogRow["group"][];
}> = [
  { id: "japan", label: "日本", serverGroups: ["av", "uncensored", "fc2"] },
  { id: "chinese", label: "国产", serverGroups: ["chinese"] },
  { id: "western", label: "欧美", serverGroups: ["western"] },
  { id: "general", label: "综合", serverGroups: ["general"] },
];

function providerAccessRank(access: string): number {
  if (access === "proxy_flare") return 1;
  return 0;
}

export function sortProviderRows(rows: ProviderCatalogRow[]): ProviderCatalogRow[] {
  return [...rows].sort((a, b) => {
    const accessDiff = providerAccessRank(a.access) - providerAccessRank(b.access);
    if (accessDiff !== 0) return accessDiff;
    if (a.implemented !== b.implemented) return a.implemented ? -1 : 1;
    return a.label.localeCompare(b.label, "zh-CN");
  });
}

export function groupCatalogForDropdown(catalog: ProviderCatalogRow[]) {
  return PROVIDER_REGION_GROUPS.map((group) => ({
    ...group,
    items: sortProviderRows(catalog.filter((row) => group.serverGroups.includes(row.group))),
  })).filter((group) => group.items.length > 0);
}

export function providerAccessBadge(access: string): { label: string; kind: "adaptive" | "flare" } {
  if (access === "proxy_flare") return { label: "过盾", kind: "flare" };
  return { label: "自适应", kind: "adaptive" };
}

export function displayProviderName(id: string, catalog: ProviderCatalogRow[]): string {
  const row = catalog.find((c) => c.id === id);
  const label = row?.label ?? id;
  if (!id.includes("_") && label) return label.replace(/\s+/g, "");
  return id
    .split("_")
    .map((part, i) => (i === 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join("_");
}
