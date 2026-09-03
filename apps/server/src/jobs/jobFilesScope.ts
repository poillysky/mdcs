import { openDatabase } from "../db/init.js";
import { normalizeRelativePath } from "../security/pathPolicy.js";
import type { JobRecord } from "../types.js";

export type JobFilesScopeInput = Pick<JobRecord, "id" | "kinds" | "options">;

function col(alias: string, name: string): string {
  return alias ? `${alias}.${name}` : name;
}

/** 与任务进度统计一致的范围 WHERE（可选表别名，如 f） */
export function buildJobFilesScopeWhere(
  job: JobFilesScopeInput,
  alias = "",
): { sql: string; params: (string | number)[] } | null {
  const kinds = job.kinds?.length ? job.kinds : [];
  if (!kinds.length) return null;

  const fileIds = Array.isArray(job.options?.fileIds)
    ? job.options.fileIds.filter((id): id is number => Number.isFinite(id))
    : [];
  if (fileIds.length) {
    return {
      sql: `${col(alias, "id")} IN (${fileIds.map(() => "?").join(",")})`,
      params: [...fileIds],
    };
  }

  const scanPath = typeof job.options?.scanPath === "string" ? job.options.scanPath.trim() : "";
  if (scanPath) {
    const rel = normalizeRelativePath(scanPath);
    return {
      sql: `${col(alias, "kind")} IN (${kinds.map(() => "?").join(",")}) AND (${col(alias, "source_path")} = ? OR ${col(alias, "source_path")} LIKE ?)`,
      params: [...kinds, rel, `${rel}/%`],
    };
  }

  const db = openDatabase();
  const roots = db
    .prepare(
      `SELECT id, source_root FROM kinds WHERE id IN (${kinds.map(() => "?").join(",")})`,
    )
    .all(...kinds) as Array<{ id: string; source_root: string | null }>;

  const rootClauses: string[] = [];
  const params: (string | number)[] = [];
  for (const row of roots) {
    const root = row.source_root?.trim();
    if (!root) continue;
    const rel = normalizeRelativePath(root);
    rootClauses.push(
      `(${col(alias, "kind")} = ? AND (${col(alias, "source_path")} = ? OR ${col(alias, "source_path")} LIKE ?))`,
    );
    params.push(row.id, rel, `${rel}/%`);
  }
  if (!rootClauses.length) {
    return {
      sql: `${col(alias, "kind")} IN (${kinds.map(() => "?").join(",")})`,
      params: [...kinds],
    };
  }

  return { sql: rootClauses.join(" OR "), params };
}

export function jobHasBoundedFileScope(job: JobFilesScopeInput): boolean {
  const fileIds = Array.isArray(job.options?.fileIds) ? job.options.fileIds.length > 0 : false;
  const scanPath =
    typeof job.options?.scanPath === "string" ? Boolean(job.options.scanPath.trim()) : false;
  return fileIds || scanPath;
}
