import type { ApiResponse } from "./types";
import type {
  FileRow,
  HealthInfo,
  IndexBrowse,
  JobRow,
  KindRow,
  OrganizeConfig,
  ProviderCatalogRow,
  ScrapeConfig,
} from "./types";

export class ApiError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  let json: ApiResponse<T> | null = null;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError(`HTTP ${res.status}`, res.status, "invalid_json");
  }
  if (!json.ok) throw new ApiError(json.message ?? "请求失败", res.status, json.code);
  return json.data as T;
}

export function fetchHealth() {
  return api<HealthInfo>("/health");
}

export function fetchKinds() {
  return api<{ organize: OrganizeConfig; indexRoot: string; kinds: KindRow[] }>("/api/kinds");
}

export function fetchIndexFolders(parent = "") {
  const q = parent ? `?parent=${encodeURIComponent(parent)}` : "";
  return api<IndexBrowse>(`/api/kinds/folders${q}`);
}

export function updateKind(
  kindId: string,
  patch: Partial<{
    enabled: boolean;
    label: string;
    sourceRoot: string;
    libraryRoot: string;
    organizeMode: string;
    organizeFallback: string;
    useGlobalOrganize: boolean;
    metadataDir: string;
    deleteMetadataOnFail: boolean;
  }>,
) {
  return api<{ kind: KindRow; stats: Record<string, number> }>(
    `/api/kinds/${encodeURIComponent(kindId)}`,
    { method: "PUT", body: JSON.stringify(patch) },
  );
}

export function updateOrganizeConfig(patch: Partial<OrganizeConfig>) {
  return api<{ organize: OrganizeConfig }>("/api/kinds/organize", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

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

export function fetchFiles(params?: {
  kind?: string;
  status?: string;
  q?: string;
  jobId?: string;
  sourceRoot?: string;
  page?: number;
  pageSize?: number;
}) {
  const q = new URLSearchParams();
  if (params?.kind) q.set("kind", params.kind);
  if (params?.status) q.set("status", params.status);
  if (params?.q) q.set("q", params.q);
  if (params?.jobId) q.set("jobId", params.jobId);
  if (params?.sourceRoot) q.set("sourceRoot", params.sourceRoot);
  q.set("page", String(params?.page ?? 1));
  q.set("pageSize", String(params?.pageSize ?? 50));
  return api<{ total: number; page: number; pageSize: number; files: FileRow[] }>(
    `/api/files?${q}`,
  );
}

export function fetchFileDetail(id: number) {
  return api<{ file: FileRow | null; meta: import("./types").ScrapeMetaView | null }>(
    `/api/files/${id}`,
  );
}

export type PipelineLogStepView = {
  title: string;
  done: boolean;
  items: Array<{ tone: "ok" | "warn" | "info" | "fail"; text: string }>;
};

export type PipelineRunKind = "initial" | "retry" | "rescrape" | "reorganize";

export type PipelineRunView = {
  id: string;
  kind: PipelineRunKind;
  at: number;
  mode: "rescrape" | "reorganize";
  steps: PipelineLogStepView[];
};

export function fetchFilePipelineLog(id: number) {
  return api<{
    active: boolean;
    mode?: "rescrape" | "reorganize";
    kind?: PipelineRunKind;
    steps: PipelineLogStepView[];
    runs?: PipelineRunView[];
  }>(`/api/files/${id}/pipeline-log`);
}

export function fetchFileGallery(id: number) {
  return api<{ items: Array<{ url: string }> }>(`/api/files/${id}/gallery`);
}

export type CoverCropStyle = "full" | "emby" | "horizontal";

export type CoverCropMarks = {
  subtitle?: boolean;
  mosaic?: "none" | "censored" | "uncensored" | "leak";
  cracked?: boolean;
  resolution?: "none" | "4K" | "8K";
};

export type CoverCropSourceInfo = {
  sourceKey: string;
  path: string;
  width: number;
  height: number;
  previewUrl: string;
};

export function fetchCoverCropSource(
  fileId: number,
  opts?: { uploadToken?: string; source?: string },
) {
  const q = new URLSearchParams();
  if (opts?.uploadToken) {
    q.set("source", "upload");
    q.set("uploadToken", opts.uploadToken);
  } else if (opts?.source && opts.source !== "local") {
    q.set("source", opts.source);
  } else {
    q.set("source", "local");
  }
  return api<CoverCropSourceInfo>(`/api/files/${fileId}/cover-crop/source?${q}`);
}

export type CoverCropBrowseEntry = {
  name: string;
  relative: string;
  kind: "dir" | "file";
  mtime: number;
};

export function fetchCoverCropBrowse(fileId: number, parent = "") {
  const q = parent ? `?parent=${encodeURIComponent(parent)}` : "";
  return api<{
    parent: string;
    folders: CoverCropBrowseEntry[];
    files: CoverCropBrowseEntry[];
  }>(`/api/files/${fileId}/cover-crop/browse${q}`);
}

export function uploadCoverCropImage(
  fileId: number,
  dataUrl: string,
  filename?: string,
) {
  return api<{ uploadToken: string; previewUrl: string }>(
    `/api/files/${fileId}/cover-crop/upload`,
    {
      method: "POST",
      body: JSON.stringify({ data: dataUrl, filename }),
    },
  );
}

export function submitCoverCrop(
  fileId: number,
  body: {
    source?: string;
    uploadToken?: string;
    cropStyle: CoverCropStyle;
    cropRect?: { left: number; top: number; width: number; height: number };
    marks?: CoverCropMarks;
    replaceThumb?: boolean;
  },
) {
  return api<{
    fileId: number;
    posterUrl?: string;
    thumbUrl?: string;
    updatedAt: number;
  }>(`/api/files/${fileId}/cover-crop`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function retryFile(id: number) {
  return api(`/api/files/${id}/retry`, { method: "POST" });
}

export function retryFiles(ids: number[]) {
  return api<{ updated: number; ids: number[] }>("/api/files/retry", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

export function stopFiles(ids: number[]) {
  return api<{ updated: number; ids: number[] }>("/api/files/stop", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

export function reorganizeFiles(ids: number[]) {
  return api<{ updated: number; ids: number[] }>("/api/files/reorganize", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

export function deleteFiles(ids: number[]) {
  return api<{ deleted: number; ids: number[] }>("/api/files/delete", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

export type FileTaskActionMode = "rescrape" | "reorganize";

export function runFileTaskAction(
  id: number,
  opts: {
    mode: FileTaskActionMode;
    kind?: PipelineRunKind;
    force?: boolean;
    code?: string;
    pageUrl?: string;
  },
) {
  return api<{
    meta?: import("./types").ScrapeMetaView;
    fileId: number;
    mode?: FileTaskActionMode;
    organized?: boolean;
    message?: string;
    organize?: { organized: number; failed: number; skipped: number };
  }>(`/api/files/${id}/rescrape`, {
    method: "POST",
    body: JSON.stringify({
      mode: opts.mode,
      kind:
        opts.kind ??
        (opts.mode === "reorganize" ? "reorganize" : "retry"),
      force: opts.force ?? true,
      code: opts.code,
      pageUrl: opts.pageUrl,
    }),
  });
}

/** @deprecated 使用 runFileTaskAction */
export function rescrapeFile(id: number, force = true) {
  return runFileTaskAction(id, { mode: "rescrape", force });
}

export function updateFileMeta(
  id: number,
  fields: Record<string, { value: string; source: string }>,
) {
  return api<{ meta: import("./types").ScrapeMetaView; fileId: number }>(
    `/api/files/${id}/meta`,
    { method: "PATCH", body: JSON.stringify({ fields }) },
  );
}

export function ensureFileSourceSnapshots(id: number) {
  return api<{ meta: import("./types").ScrapeMetaView; fileId: number }>(
    `/api/files/${id}/source-snapshots`,
    { method: "POST", body: "{}" },
  );
}

export function scrapeCode(body: {
  code: string;
  kind: string;
  force?: boolean;
  channel?: string;
}) {
  return api<{ meta: Record<string, unknown> }>("/api/scrape", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function fetchScrapeConfig() {
  return api<{ config: ScrapeConfig; providers: string[]; catalog: ProviderCatalogRow[] }>(
    "/api/scrape/config",
  );
}

export function saveScrapeConfig(config: ScrapeConfig) {
  return api<{ config: ScrapeConfig; catalog: ProviderCatalogRow[] }>("/api/scrape/config", {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

export function probeProviders(body?: {
  id?: string;
  onlyImplemented?: boolean;
  timeoutSec?: number;
  clearCooldown?: boolean;
}) {
  return api<{
    results: Array<{
      id: string;
      label: string;
      ok: boolean;
      ms: number;
      message: string;
      status?: number;
    }>;
    cooldown: string[];
  }>("/api/scrape/providers/probe", {
    method: "POST",
    body: JSON.stringify(body ?? { onlyImplemented: true }),
  });
}

export function scanKind(kindId: string) {
  return api(`/api/kinds/${encodeURIComponent(kindId)}/scan`, { method: "POST" });
}

export function testNetworkConnection(body: {
  target: "direct" | "proxy" | "flare";
  proxyUrl?: string;
  flareSolverrUrl?: string;
  timeoutSec?: number;
}) {
  return api<{ ok: boolean; target: string; message: string; ms: number }>(
    "/api/scrape/network/test",
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function fetchWatermarkStyles() {
  return api<{ styles: string[] }>("/api/scrape/watermark/styles");
}

export function fetchOpsConfig() {
  return api<{ config: import("./types").OpsConfig }>("/api/ops/config");
}

export function saveOpsConfig(config: import("./types").OpsConfig) {
  return api<{ config: import("./types").OpsConfig }>("/api/ops/config", {
    method: "PUT",
    body: JSON.stringify({ config }),
  });
}

export function testWebhookEndpoint(body: {
  endpointId?: string;
  endpoint?: import("./types").WebhookEndpoint;
  vars?: Record<string, string>;
}) {
  return api<{ ok: boolean; status?: number; message: string; ms: number }>(
    "/api/ops/webhook/test",
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function exportPresets() {
  return api<{ version: number; exportedAt: number; presets: import("./types").JobPreset[] }>(
    "/api/ops/presets/export",
  );
}

export function importPresets(body: {
  mode: "merge" | "replace";
  presets: import("./types").JobPreset[];
}) {
  return api<{ config: import("./types").OpsConfig; imported: number }>("/api/ops/presets/import", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function savePreset(preset: Partial<import("./types").JobPreset> & { name: string }) {
  return api<{ config: import("./types").OpsConfig; preset?: import("./types").JobPreset }>(
    "/api/ops/presets",
    { method: "POST", body: JSON.stringify({ preset }) },
  );
}

export function deletePreset(id: string) {
  return api<{ config: import("./types").OpsConfig }>(`/api/ops/presets/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

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
    actors: import("./types").ActorRow[];
  }>(`/api/actors${q ? `?${q}` : ""}`);
}

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

export function fetchActorDetail(name: string) {
  const qs = new URLSearchParams({ name });
  return api<{ actor: import("./types").ActorRow }>(`/api/actors/detail?${qs}`);
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

export function syncEmbyActors(body?: Partial<import("./types").OpsConfig["actors"]>) {
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

export type { FileRow, HealthInfo, JobRow, KindRow, ScrapeConfig };
