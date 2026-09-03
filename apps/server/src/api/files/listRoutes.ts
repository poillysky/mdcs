import { Router } from "express";
import { openDatabase } from "../../db/init.js";
import type { KindId } from "../../types.js";
import { recoverStaleInflightStatuses, revertOrphanPipelineFiles } from "../../jobs/jobFiles.js";
import { normalizeRelativePath } from "../../security/pathPolicy.js";
import { FILE_LIST_JOINS, FILE_LIST_SELECT, mapFileListRow } from "../fileListMap.js";
import { sendFail, sendOk } from "../respond.js";
import { appendFileListStatusFilter, resolveFileListOrderBy, shouldExcludeIndexed } from "./listFilters.js";
import { applyJobFilesScope } from "./scope.js";

export function registerListRoutes(filesRouter: Router) {
filesRouter.get("/stats/by-kind", (_req, res) => {
  const db = openDatabase();
  const rows = db
    .prepare(`SELECT kind, status, COUNT(*) AS c FROM files GROUP BY kind, status`)
    .all() as Array<{ kind: KindId; status: string; c: number }>;
  sendOk(res, { stats: rows });
});

filesRouter.get("/", (req, res) => {
  recoverStaleInflightStatuses();
  revertOrphanPipelineFiles();
  const db = openDatabase();
  const kind = req.query.kind ? String(req.query.kind) : undefined;
  const sourceRoot = req.query.sourceRoot ? String(req.query.sourceRoot).trim() : "";
  const status = req.query.status ? String(req.query.status) : undefined;
  const jobId = req.query.jobId ? String(req.query.jobId).trim() : "";
  const q = req.query.q ? String(req.query.q).trim() : "";
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const pageSize = Math.min(
    200,
    Math.max(1, parseInt(String(req.query.pageSize ?? "50"), 10) || 50),
  );
  const sort = req.query.sort ? String(req.query.sort) : undefined;
  const offset = (page - 1) * pageSize;

  const where: string[] = [];
  const params: (string | number)[] = [];

  if (jobId) {
    const scoped = applyJobFilesScope(jobId, where, params);
    if (!scoped.ok) {
      sendFail(res, scoped.message, 404, "job_not_found");
      return;
    }
  }

  if (kind) {
    where.push("f.kind = ?");
    params.push(kind);
  }
  if (sourceRoot && !jobId) {
    let root = "";
    try {
      root = normalizeRelativePath(sourceRoot);
    } catch {
      sendFail(res, "sourceRoot 路径无效", 400, "bad_request");
      return;
    }
    if (root) {
      const directOnly = req.query.directOnly === "1";
      if (directOnly) {
        where.push("f.source_path LIKE ? AND f.source_path NOT LIKE ?");
        params.push(`${root}/%`, `${root}/%/%`);
      } else {
        where.push("(f.source_path = ? OR f.source_path LIKE ?)");
        params.push(root, `${root}/%`);
      }
    }
  }
  appendFileListStatusFilter(status, where, params);
  const excludeIndexed = req.query.excludeIndexed === "1";
  if (shouldExcludeIndexed(excludeIndexed, status, jobId)) {
    where.push("f.status != 'indexed'");
  }
  if (q) {
    where.push(
      `(f.code LIKE ? OR f.file_name LIKE ? OR f.source_path LIKE ? OR IFNULL(json_extract(c.meta_json, '$.title'), '') LIKE ?)`,
    );
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const total = (
    db
      .prepare(
        `SELECT COUNT(*) AS c ${FILE_LIST_JOINS}
         ${whereSql}`,
      )
      .get(...params) as { c: number }
  ).c;

  const rows = db
    .prepare(
      `SELECT ${FILE_LIST_SELECT}
       ${FILE_LIST_JOINS}
       ${whereSql}
       ORDER BY ${resolveFileListOrderBy(sort)}
       LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, offset) as Array<Record<string, unknown>>;

  const files = rows.map(mapFileListRow);

  sendOk(res, { page, pageSize, total, files });
});
}
