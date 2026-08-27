import type { ActorRow } from "../types/index.js";
import { api } from "./client.js";

export function fetchActors(params?: {
  q?: string;
  page?: number;
  pageSize?: number;
  status?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params?.status) qs.set("status", params.status);
  const q = qs.toString();
  return api<{
    total: number;
    page: number;
    pageSize: number;
    actors: ActorRow[];
  }>(`/api/actors${q ? `?${q}` : ""}`);
}

export function fetchActorDetail(name: string) {
  const qs = new URLSearchParams({ name });
  return api<{ actor: ActorRow }>(`/api/actors/detail?${qs}`);
}

export function scrapeActors(body: {
  names?: string[];
  missingOnly?: boolean;
  forceImage?: boolean;
  limit?: number;
}) {
  return api<{
    total: number;
    ok: number;
    skipped: number;
    failed: number;
    results: Array<{
      name: string;
      ok: boolean;
      skipped?: boolean;
      mappedName?: string;
      avatarPath?: string;
      error?: string;
    }>;
    logs: string[];
  }>("/api/actors/scrape", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
