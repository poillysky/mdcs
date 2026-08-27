export type SourcesTabId = "providers" | "fields" | "recognition" | "retry";

export type SourcesTabDef = {
  id: SourcesTabId;
  slug: string;
  label: string;
};

/** 色花式拆页：数据源 / 重试设置 / 自定义识别 / 优先级配置 */
export const SOURCES_TABS: SourcesTabDef[] = [
  { id: "providers", slug: "", label: "数据源" },
  { id: "retry", slug: "retry", label: "重试设置" },
  { id: "recognition", slug: "recognition", label: "自定义识别" },
  { id: "fields", slug: "fields", label: "优先级配置" },
];

export function parseSourcesTab(pathname: string): SourcesTabId {
  const m = pathname.match(/^\/sources(?:\/([^/?#]+))?/);
  const slug = (m?.[1] || "").toLowerCase();
  if (slug === "fields" || slug === "field" || slug === "priority") return "fields";
  if (slug === "recognition") return "recognition";
  if (slug === "retry") return "retry";
  return "providers";
}

export function sourcesTabPath(id: SourcesTabId): string {
  if (id === "fields") return "/sources/fields";
  if (id === "recognition") return "/sources/recognition";
  if (id === "retry") return "/sources/retry";
  return "/sources";
}
