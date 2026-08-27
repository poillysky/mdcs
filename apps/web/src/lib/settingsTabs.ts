export type SettingsTabId =
  | "organize"
  | "monitor"
  | "download"
  | "naming"
  | "watermark"
  | "network"
  | "metadata"
  | "nfo"
  | "actors"
  | "system"
  | "webhook";

export type SettingsTabDef = {
  id: SettingsTabId;
  slug: string;
  label: string;
  enabled: boolean;
};

export const SETTINGS_TABS: SettingsTabDef[] = [
  { id: "organize", slug: "organize", label: "整理", enabled: true },
  { id: "monitor", slug: "monitor", label: "监控", enabled: true },
  { id: "download", slug: "download", label: "下载", enabled: true },
  { id: "naming", slug: "naming", label: "命名", enabled: true },
  { id: "watermark", slug: "watermark", label: "水印", enabled: true },
  { id: "network", slug: "network", label: "网络", enabled: true },
  { id: "metadata", slug: "metadata", label: "元数据", enabled: true },
  { id: "nfo", slug: "nfo", label: "NFO", enabled: true },
  { id: "actors", slug: "actors", label: "演员", enabled: true },
  { id: "system", slug: "system", label: "系统", enabled: true },
  { id: "webhook", slug: "webhook", label: "Webhook", enabled: true },
];

export function parseSettingsTab(pathname: string): SettingsTabId {
  const m = pathname.match(/^\/settings(?:\/([^/?#]+))?/);
  const slug = m?.[1];
  const found = SETTINGS_TABS.find((t) => t.slug === slug);
  return found?.id ?? "organize";
}

export function settingsTabPath(id: SettingsTabId): string {
  const tab = SETTINGS_TABS.find((t) => t.id === id);
  return `/settings/${tab?.slug ?? "organize"}`;
}
