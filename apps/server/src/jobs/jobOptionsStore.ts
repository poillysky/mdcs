import { openDatabase } from "../db/init.js";
import { normalizeJobOptions, type JobOptions } from "./options.js";

export function loadJobOptions(jobId: string): JobOptions | undefined {
  const db = openDatabase();
  const row = db.prepare(`SELECT options_json FROM jobs WHERE id = ?`).get(jobId) as
    | { options_json: string | null }
    | undefined;
  if (!row?.options_json) return undefined;
  try {
    return normalizeJobOptions(JSON.parse(row.options_json));
  } catch {
    return undefined;
  }
}

export function patchJobOptionsInDb(
  jobId: string,
  patch: Partial<JobOptions>,
): JobOptions | undefined {
  const current = loadJobOptions(jobId) ?? {};
  const next = normalizeJobOptions({ ...current, ...patch });
  const db = openDatabase();
  db.prepare(`UPDATE jobs SET options_json = ?, updated_at = ? WHERE id = ?`).run(
    JSON.stringify(next),
    Date.now(),
    jobId,
  );
  return next;
}

/** 新插队 id 排在最前，保留既有优先顺序 */
export function mergePriorityFileIds(
  existing: number[] | undefined,
  incoming: number[],
): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const id of incoming) {
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  for (const id of existing ?? []) {
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function mergeNumericIds(
  existing: number[] | undefined,
  incoming: number[],
): number[] {
  return [...new Set([...incoming, ...(existing ?? [])])]
    .filter((id): id is number => Number.isFinite(id))
    .sort((a, b) => a - b);
}

export function areJobFileIdsTerminal(options?: { fileIds?: number[] }): boolean {
  return areFileIdsTerminal(options?.fileIds);
}

export function areRetryBatchTerminal(options?: {
  retryBatchFileIds?: number[];
}): boolean {
  return areFileIdsTerminal(options?.retryBatchFileIds);
}

function areFileIdsTerminal(ids?: number[]): boolean {
  if (!ids?.length) return false;
  const db = openDatabase();
  const placeholders = ids.map(() => "?").join(",");
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM files
       WHERE id IN (${placeholders}) AND status NOT IN ('done', 'failed', 'skipped')`,
    )
    .get(...ids) as { c: number };
  return Number(row.c) === 0;
}

export function clearRetryBatchMarkers(jobId: string): void {
  const current = loadJobOptions(jobId);
  if (!current) return;
  const { closeWhenRetryBatchDone: _a, retryBatchFileIds: _b, ...rest } = current;
  const db = openDatabase();
  db.prepare(`UPDATE jobs SET options_json = ?, updated_at = ? WHERE id = ?`).run(
    JSON.stringify(normalizeJobOptions(rest)),
    Date.now(),
    jobId,
  );
}
