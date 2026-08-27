import { Router } from "express";
import { openDatabase } from "../../db/init.js";
import type { KindId } from "../../types.js";
import { FILE_LIST_JOINS, FILE_LIST_SELECT, mapFileListRow } from "../fileListMap.js";
import { sendFail, sendOk } from "../respond.js";
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
    const root = sourceRoot.replace(/\\/g, "/").replace(/^\/+/, "");
    if (root) {
      where.push("f.source_path LIKE ?");
      params.push(`%${root}%`);
    }
  }
  if (status) {
    where.push("f.status = ?");
    params.push(status);
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
       ORDER BY f.id DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, offset) as Array<Record<string, unknown>>;

  const files = rows.map(mapFileListRow);

  sendOk(res, { page, pageSize, total, files });
});
}
