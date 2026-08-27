import type { JobRow } from "../types/index.js";
import { api } from "./client.js";

export function fetchJobs(params?: {
  status?: string;
  mode?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.mode) q.set("mode", params.mode);
  if (params?.q) q.set("q", params.q);
  q.set("page", String(params?.page ?? 1));
  q.set("pageSize", String(params?.pageSize ?? 20));
  return api<{ jobs: JobRow[]; total: number; page: number; pageSize: number }>(
    `/api/jobs?${q}`,
  );
}

export function fetchJob(id: string) {
  return api<{ job: JobRow }>(`/api/jobs/${encodeURIComponent(id)}`);
}

export function createJob(body: {
  kinds: string[];
  mode: string;
  dryRun?: boolean;
  options?: Record<string, unknown>;
}) {
  return api<{ job: JobRow }>("/api/jobs", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function pauseJob(id: string) {
  return api<{ job: JobRow }>(`/api/jobs/${encodeURIComponent(id)}/pause`, {
    method: "POST",
  });
}

export function resumeJob(id: string) {
  return api<{ job: JobRow }>(`/api/jobs/${encodeURIComponent(id)}/resume`, {
    method: "POST",
  });
}

export function cancelJob(id: string) {
  return api<{ job: JobRow }>(`/api/jobs/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
  });
}

export function deleteJob(id: string) {
  return api<{ deleted: boolean }>(`/api/jobs/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
