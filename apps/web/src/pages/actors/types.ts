import type { NotifyFn } from "../../lib/notify";

export type ActorsPageProps = {
  path: string;
  locationSearch: string;
  onNavigate: (path: string) => void;
  notify: NotifyFn;
};

export type ActorsTab = "local" | "emby";

export type EmbyActorRow = {
  id: string;
  name: string;
  status: "success" | "failed" | "skipped";
  detail: string;
  error: string;
};

export const PAGE_SIZE = 50;

export const LOCAL_STATUS_OPTIONS = [
  { value: "", label: "全部" },
  { value: "scraped", label: "已刮削" },
  { value: "missing", label: "未刮削" },
] as const;

export const EMBY_STATUS_OPTIONS = [
  { value: "", label: "全部" },
  { value: "success", label: "成功" },
  { value: "failed", label: "失败" },
  { value: "skipped", label: "跳过" },
] as const;
