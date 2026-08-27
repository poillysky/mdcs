import { Router } from "express";
import { openDatabase } from "../../db/init.js";
import { API_CODES } from "../codes.js";
import { sendFail, sendOk } from "../respond.js";
import { parseFileIds } from "./helpers.js";

export function registerBatchRoutes(filesRouter: Router) {
filesRouter.post("/retry", (req, res) => {
  const db = openDatabase();
  const ids = Array.isArray(req.body?.ids)
    ? req.body.ids.map((x: unknown) => Number(x)).filter((n: number) => Number.isFinite(n))
    : [];
  if (!ids.length) {
    sendFail(res, "缺少 ids", 400, API_CODES.missing_code);
    return;
  }
  const stmt = db.prepare(`UPDATE files SET status = 'pending', error = NULL WHERE id = ?`);
  let updated = 0;
  for (const id of ids) {
    const r = stmt.run(id);
    updated += Number(r.changes || 0);
  }
  sendOk(res, { updated, ids });
});
filesRouter.post("/stop", (req, res) => {
  const db = openDatabase();
  const ids = parseFileIds(req.body);
  if (!ids.length) {
    sendFail(res, "缺少 ids", 400, API_CODES.missing_code);
    return;
  }
  const placeholders = ids.map(() => "?").join(",");
  const result = db
    .prepare(
      `UPDATE files
       SET status = 'failed', error = '已手动停止'
       WHERE id IN (${placeholders})
         AND status IN ('pending', 'scraping', 'organizing', 'planned')`,
    )
    .run(...ids);
  sendOk(res, { updated: Number(result.changes || 0), ids });
});

filesRouter.post("/reorganize", (req, res) => {
  const db = openDatabase();
  const ids = parseFileIds(req.body);
  if (!ids.length) {
    sendFail(res, "缺少 ids", 400, API_CODES.missing_code);
    return;
  }
  const placeholders = ids.map(() => "?").join(",");
  const result = db
    .prepare(
      `UPDATE files
       SET status = 'planned', target_path = NULL, organized_at = NULL, error = NULL
       WHERE id IN (${placeholders}) AND code IS NOT NULL`,
    )
    .run(...ids);
  sendOk(res, { updated: Number(result.changes || 0), ids });
});

filesRouter.post("/delete", (req, res) => {
  const db = openDatabase();
  const ids = parseFileIds(req.body);
  if (!ids.length) {
    sendFail(res, "缺少 ids", 400, API_CODES.missing_code);
    return;
  }
  const placeholders = ids.map(() => "?").join(",");
  const result = db.prepare(`DELETE FROM files WHERE id IN (${placeholders})`).run(...ids);
  sendOk(res, { deleted: Number(result.changes || 0), ids });
});

filesRouter.post("/:id/retry", (req, res) => {
  const db = openDatabase();
  db.prepare(`UPDATE files SET status = 'pending', error = NULL WHERE id = ?`).run(
    req.params.id,
  );
  const row = db.prepare(`SELECT * FROM files WHERE id = ?`).get(req.params.id);
  sendOk(res, { file: row });
});
}
