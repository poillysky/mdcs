export type RouteId =
  | "dashboard"
  | "tasks"
  | "kindTasks"
  | "records"
  | "actors"
  | "files"
  | "sources"
  | "settings";

export type NavItem = {
  id: RouteId;
  path: string;
  label: string;
  group?: "system";
};

export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", path: "/", label: "主界面" },
  { id: "tasks", path: "/tasks", label: "手动任务" },
  { id: "kindTasks", path: "/kind-tasks", label: "七区任务" },
  { id: "records", path: "/records", label: "刮削记录" },
  { id: "actors", path: "/actors", label: "演员管理" },
  { id: "files", path: "/files", label: "文件管理" },
  { id: "sources", path: "/sources", label: "数据源", group: "system" },
  { id: "settings", path: "/settings", label: "设置", group: "system" },
];

const LEGACY_REDIRECTS: Record<string, string> = {
  "/config": "/settings/organize",
  "/jobs": "/tasks",
  "/live": "/records",
};

export function normalizePath(pathname: string): string {
  const p = pathname.replace(/\/+$/, "") || "/";
  return LEGACY_REDIRECTS[p] ?? p;
}

export function matchRoute(pathname: string): RouteId {
  const p = normalizePath(pathname);
  if (p === "/" || p.startsWith("/dashboard")) return "dashboard";
  if (p.startsWith("/kind-tasks")) return "kindTasks";
  if (p.startsWith("/tasks")) return "tasks";
  if (p.startsWith("/records")) return "records";
  if (p.startsWith("/actors")) return "actors";
  if (p.startsWith("/files")) return "files";
  if (p.startsWith("/sources")) return "sources";
  if (p.startsWith("/settings")) return "settings";
  return "dashboard";
}

export function routePath(id: RouteId): string {
  return NAV_ITEMS.find((n) => n.id === id)?.path ?? "/";
}
