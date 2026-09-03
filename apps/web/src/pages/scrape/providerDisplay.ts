import type { ProviderCatalogRow, ProviderSiteConfig } from "../../types";
import { PROVIDER_UI_GROUPS } from "./constants";

export function orderedProviderIds(catalog: ProviderCatalogRow[], onlyEnabled = false): string[] {
  const ids: string[] = [];
  for (const g of PROVIDER_UI_GROUPS) {
    const rows = sortProviderRows(
      catalog.filter((r) => r.group === g.id && (!onlyEnabled || r.enabled)),
    );
    for (const row of rows) ids.push(row.id);
  }
  return ids;
}

export function displayProviderName(id: string, label: string): string {
  // 对齐参考图：Airav_io / Avsox 风格
  if (!id.includes("_") && label) return label.replace(/\s+/g, "");
  return id
    .split("_")
    .map((part, i) => (i === 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join("_");
}

export function formatAgo(ts: number | null): string {
  if (!ts) return "尚未测试";
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec} 秒前`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr} 小时前`;
  return `${Math.floor(hr / 24)} 天前`;
}

/** 同组卡片顺序：自适应 → 过盾（与 server catalogTypes 一致） */
export function providerAccessRank(access: string): number {
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

export function emptySite(): ProviderSiteConfig {
  return {
    baseUrl: "",
    cookie: "",
    userAgent: "",
    cooldownSec: 0,
    overrideRetry: false,
    retry: 0,
    proxyUrl: "",
  };
}
