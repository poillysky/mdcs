import { normalizeRelativePath } from "../../lib/paths";
import type { KindRow } from "../../types";

export const RECORDS_PAGE_SIZE = 30;

export type RecordsUrlScope = {
  jobId: string;
  kind: string;
  sourceRoot: string;
  status: string;
  q: string;
  page: number;
  detailId: number | null;
};

function normalizeScopePath(path: string): string {
  return normalizeRelativePath(path);
}

export function parseRecordsSearch(search: string): RecordsUrlScope {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  const jobId = params.get("jobId")?.trim() ?? "";
  const idRaw = params.get("id")?.trim() ?? "";
  const parsedId = idRaw ? parseInt(idRaw, 10) : NaN;
  const detailId = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null;
  return {
    jobId,
    kind: jobId ? "" : (params.get("kind")?.trim() ?? ""),
    sourceRoot: jobId ? "" : (params.get("sourceRoot")?.trim() ?? ""),
    status: params.get("status") ?? "",
    q: jobId ? "" : (params.get("q") ?? ""),
    page: Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1),
    detailId,
  };
}

export function buildRecordsListPath(
  search: string,
  patch: Partial<Pick<RecordsUrlScope, "status" | "q" | "page">>,
): string {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  if (patch.status !== undefined) {
    if (patch.status) params.set("status", patch.status);
    else params.delete("status");
  }
  if (patch.q !== undefined) {
    if (patch.q) params.set("q", patch.q);
    else params.delete("q");
  }
  if (patch.page !== undefined) {
    if (patch.page > 1) params.set("page", String(patch.page));
    else params.delete("page");
  }
  const q = params.toString();
  return q ? `/records?${q}` : "/records";
}

export function buildRecordsPath(search: string, detailId: number | null): string {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  if (detailId != null) {
    params.set("id", String(detailId));
  } else {
    params.delete("id");
  }
  const q = params.toString();
  return q ? `/records?${q}` : "/records";
}

export function resolveScopedKind(kindId: string, sourceRoot: string, kinds: KindRow[]): string {
  if (kindId) return kindId;
  if (!sourceRoot) return "";
  const norm = normalizeScopePath(sourceRoot);
  const matched = kinds.find((k) => normalizeScopePath(k.sourceRoot || "") === norm);
  return matched?.id ?? "";
}

export function resolveRecordsKind(scope: RecordsUrlScope, kinds: KindRow[]): string {
  if (scope.jobId) return "";
  if (scope.kind) return scope.kind;
  if (scope.sourceRoot) return resolveScopedKind("", scope.sourceRoot, kinds);
  return "";
}

export function recordsListQuery(
  scope: RecordsUrlScope,
  resolvedKind: string,
  status: string,
  q: string,
  page: number,
) {
  return {
    kind: scope.jobId ? undefined : resolvedKind || undefined,
    sourceRoot: scope.jobId ? undefined : scope.sourceRoot || undefined,
    jobId: scope.jobId || undefined,
    status: status || undefined,
    q: scope.jobId ? undefined : q.trim() || undefined,
    page,
    pageSize: RECORDS_PAGE_SIZE,
    excludeIndexed: false,
    sort: "id" as const,
  };
}
