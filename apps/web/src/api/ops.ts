import type { JobPreset, OpsConfig, WebhookEndpoint } from "../types/index.js";
import { api } from "./client.js";

export function fetchOpsConfig() {
  return api<{ config: OpsConfig }>("/api/ops/config");
}

export function saveOpsConfig(config: OpsConfig) {
  return api<{ config: OpsConfig }>("/api/ops/config", {
    method: "PUT",
    body: JSON.stringify({ config }),
  });
}

export function testWebhookEndpoint(body: {
  endpointId?: string;
  endpoint?: WebhookEndpoint;
  vars?: Record<string, string>;
}) {
  return api<{ ok: boolean; status?: number; message: string; ms: number }>(
    "/api/ops/webhook/test",
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function exportPresets() {
  return api<{ version: number; exportedAt: number; presets: JobPreset[] }>(
    "/api/ops/presets/export",
  );
}

export function importPresets(body: {
  mode: "merge" | "replace";
  presets: JobPreset[];
}) {
  return api<{ config: OpsConfig; imported: number }>("/api/ops/presets/import", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function savePreset(preset: Partial<JobPreset> & { name: string }) {
  return api<{ config: OpsConfig; preset?: JobPreset }>(
    "/api/ops/presets",
    { method: "POST", body: JSON.stringify({ preset }) },
  );
}

export function deletePreset(id: string) {
  return api<{ config: OpsConfig }>(`/api/ops/presets/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function testEmbyActorsConnection(body: {
  embyUrl: string;
  embyApiKey: string;
  embyUserId?: string;
}) {
  return api<{ serverName: string; version: string }>("/api/ops/actors/emby/test", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function fetchEmbyLibraries(params?: {
  embyUrl?: string;
  embyApiKey?: string;
  embyUserId?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.embyUrl) qs.set("embyUrl", params.embyUrl);
  if (params?.embyApiKey) qs.set("embyApiKey", params.embyApiKey);
  if (params?.embyUserId) qs.set("embyUserId", params.embyUserId);
  const q = qs.toString();
  return api<{ libraries: Array<{ id: string; name: string }> }>(
    `/api/ops/actors/emby/libraries${q ? `?${q}` : ""}`,
  );
}

export function syncEmbyActors(body?: Partial<OpsConfig["actors"]>) {
  return api<{
    total: number;
    updatedMeta: number;
    updatedImage: number;
    skipped: number;
    failed: number;
    fromLocal?: number;
    errors: string[];
    logs: string[];
  }>("/api/ops/actors/emby/sync", {
    method: "POST",
    body: JSON.stringify(body || {}),
  });
}
