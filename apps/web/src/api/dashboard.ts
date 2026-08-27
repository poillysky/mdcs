import type { FileRow } from "../types/index.js";
import { api } from "./client.js";

export type DashboardWeekCompare = {
  text: string;
  tone: "up" | "down" | "flat";
};

export function fetchDashboard(params?: { page?: number; pageSize?: number; kind?: string }) {
  const q = new URLSearchParams();
  q.set("page", String(params?.page ?? 1));
  q.set("pageSize", String(params?.pageSize ?? 20));
  if (params?.kind) q.set("kind", params.kind);
  return api<{
    scrapeMax: number;
    actorTotal: number;
    recentAdded7d: number;
    weekCompare: DashboardWeekCompare | null;
    activity: { files: FileRow[]; total: number; page: number; pageSize: number };
  }>(`/api/dashboard?${q}`);
}
