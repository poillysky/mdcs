import { Router } from "express";
import { openDatabase } from "../../db/init.js";
import { ensureSourceSnapshots } from "../../scrape/orchestrator.js";
import type { KindId } from "../../types.js";
import { API_CODES } from "../codes.js";
import { sendFail, sendOk } from "../respond.js";

export function registerSnapshotRoutes(filesRouter: Router) {
filesRouter.post("/:id/source-snapshots", async (req, res) => {
  const db = openDatabase();
  const row = db
    .prepare(`SELECT id, kind, code FROM files WHERE id = ?`)
    .get(req.params.id) as { id: number; kind: KindId; code: string | null } | undefined;
  if (!row) {
    sendFail(res, "文件不存在", 404, API_CODES.not_found);
    return;
  }
  if (!row.code) {
    sendFail(res, "无番号，无法补全数据源", 400, API_CODES.missing_code);
    return;
  }
  try {
    const meta = await ensureSourceSnapshots(row.code, row.kind);
    if (!meta) {
      sendFail(res, "尚无刮削缓存", 404, "no_meta_cache");
      return;
    }
    sendOk(res, { meta, fileId: row.id });
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 500, API_CODES.internal_error);
  }
});
}
