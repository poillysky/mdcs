import type { FileRow, ScrapeMetaView } from "../types/index.js";
import { api } from "./client.js";

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

export type CoverCropBrowseEntry = {
  name: string;
  relative: string;
  kind: "dir" | "file";
  mtime: number;
};

export type FileTaskActionMode = "rescrape" | "reorganize";

export function fetchFiles(params?: {
  kind?: string;
  status?: string;
  q?: string;
  jobId?: string;
  sourceRoot?: string;
  directOnly?: boolean;
  page?: number;
  pageSize?: number;
  excludeIndexed?: boolean;
  sort?: "code" | "id" | "activity";
}) {
  const q = new URLSearchParams();
  if (params?.kind) q.set("kind", params.kind);
  if (params?.status) q.set("status", params.status);
  if (params?.q) q.set("q", params.q);
  if (params?.jobId) q.set("jobId", params.jobId);
  if (params?.sourceRoot) q.set("sourceRoot", params.sourceRoot);
  if (params?.directOnly) q.set("directOnly", "1");
  if (params?.excludeIndexed) q.set("excludeIndexed", "1");
  if (params?.sort) q.set("sort", params.sort);
  q.set("page", String(params?.page ?? 1));
  q.set("pageSize", String(params?.pageSize ?? 50));
  return api<{ total: number; page: number; pageSize: number; files: FileRow[] }>(
    `/api/files?${q}`,
  );
}

export function fetchFileDetail(id: number) {
  return api<{ file: FileRow | null; meta: ScrapeMetaView | null }>(`/api/files/${id}`);
}

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
  return api<{
    updated: number;
    ids: number[];
    jobId: string | null;
    merged?: boolean;
    resumed?: boolean;
    error?: "no_candidates" | "no_origin_job";
  }>("/api/files/retry", {
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
  return api<{ reverted: number; skipped: number; ids: number[] }>("/api/files/delete", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

/** 对当前范围内 indexed 文件创建刮削任务 */
export function scrapeIndexedFiles(opts: { kind: string; sourceRoot?: string }) {
  return api<{ queued: number; matched?: number; jobId: string | null }>("/api/files/scrape-indexed", {
    method: "POST",
    body: JSON.stringify(opts),
  });
}

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
    meta?: ScrapeMetaView;
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
  return api<{ meta: ScrapeMetaView; fileId: number }>(
    `/api/files/${id}/meta`,
    { method: "PATCH", body: JSON.stringify({ fields }) },
  );
}

export function ensureFileSourceSnapshots(id: number) {
  return api<{ meta: ScrapeMetaView; fileId: number }>(
    `/api/files/${id}/source-snapshots`,
    { method: "POST", body: "{}" },
  );
}

export type IndexAllStatus = {
  running: boolean;
  kindTotal: number;
  kindIndex: number;
  currentKind?: string;
  currentLabel?: string;
  discovered: number;
  inserted: number;
  updated: number;
  skipped: number;
  message?: string;
  error?: string;
};

export function startIndexAll(kinds: string[]) {
  return api<{ index: IndexAllStatus }>("/api/files/index-all", {
    method: "POST",
    body: JSON.stringify({ kinds }),
  });
}

export function fetchIndexAllStatus() {
  return api<{ index: IndexAllStatus }>("/api/files/index-all/status");
}
