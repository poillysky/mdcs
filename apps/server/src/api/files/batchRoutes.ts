import { Router } from "express";
import { createJob } from "../../jobs/scheduler.js";
import { enqueueFailedRescrape } from "../../jobs/retryQueue.js";
import { deleteOrRevertFileRecord, releaseInflightFileState } from "../../jobs/jobFiles.js";
import { getIndexAllStatus, startIndexAll } from "../../jobs/indexAll.js";
import { openDatabase } from "../../db/init.js";
import { notifyFileChanges } from "../../files/events.js";
import { API_CODES } from "../codes.js";
import { sendFail, sendOk } from "../respond.js";
import { parseFileIds } from "./helpers.js";
import type { KindId } from "../../types.js";
import { normalizeRelativePath } from "../../security/pathPolicy.js";

function listScrapeableIdsInScope(kind: KindId, sourceRoot?: string): number[] {
  const db = openDatabase();
  const where = ["kind = ?", "status IN ('indexed', 'pending')", "code IS NOT NULL"];
  const params: (string | number)[] = [kind];
  let root = "";
  if (sourceRoot?.trim()) {
    try {
      root = normalizeRelativePath(sourceRoot);
    } catch {
      return [];
    }
  }
  if (root) {
    where.push("(source_path = ? OR source_path LIKE ?)");
    params.push(root, `${root}/%`);
  }
  const rows = db
    .prepare(`SELECT id FROM files WHERE ${where.join(" AND ")} ORDER BY id ASC`)
    .all(...params) as Array<{ id: number }>;
  return rows.map((r) => r.id);
}

export function registerBatchRoutes(filesRouter: Router) {
filesRouter.post("/scrape-indexed", async (req, res) => {
  const kind = String(req.body?.kind ?? "").trim() as KindId;
  if (!kind) {
    sendFail(res, "缺少 kind", 400, API_CODES.missing_code);
    return;
  }
  const sourceRoot = typeof req.body?.sourceRoot === "string" ? req.body.sourceRoot.trim() : "";
  const ids = listScrapeableIdsInScope(kind, sourceRoot || undefined);
  if (!ids.length) {
    sendOk(res, { queued: 0, matched: 0, jobId: null });
    return;
  }
  try {
    const job = await createJob({
      kinds: [kind],
      mode: "scrape_only",
      remember: false,
      options: { fileIds: ids },
    });
    sendOk(res, { queued: ids.length, matched: ids.length, jobId: job.id });
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 400, "job_create_invalid");
  }
});
filesRouter.post("/retry", async (req, res) => {
  const ids = Array.isArray(req.body?.ids)
    ? req.body.ids.map((x: unknown) => Number(x)).filter((n: number) => Number.isFinite(n))
    : [];
  if (!ids.length) {
    sendFail(res, "缺少 ids", 400, API_CODES.missing_code);
    return;
  }
  try {
    const { updatedIds, jobId, merged, resumed, error } = await enqueueFailedRescrape(ids);
    sendOk(res, {
      updated: updatedIds.length,
      ids: updatedIds,
      jobId,
      merged,
      resumed,
      error,
    });
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 400, "job_create_invalid");
  }
});
filesRouter.post("/stop", (req, res) => {
  const ids = parseFileIds(req.body);
  if (!ids.length) {
    sendFail(res, "缺少 ids", 400, API_CODES.missing_code);
    return;
  }
  let updated = 0;
  const changedIds: number[] = [];
  for (const id of ids) {
    if (releaseInflightFileState(id)) {
      updated += 1;
      changedIds.push(id);
      continue;
    }
    const db = openDatabase();
    const r = db
      .prepare(
        `UPDATE files SET status = 'indexed', error = NULL
         WHERE id = ? AND status IN ('pending', 'planned')`,
      )
      .run(id);
    if (Number(r.changes || 0) > 0) {
      updated += 1;
      changedIds.push(id);
    }
  }
  if (changedIds.length) notifyFileChanges(changedIds, { reason: "batch" });
  sendOk(res, { updated, ids });
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
  const updated = Number(result.changes || 0);
  if (updated > 0) notifyFileChanges(ids, { reason: "batch" });
  sendOk(res, { updated, ids });
});

filesRouter.post("/delete", (req, res) => {
  const ids = parseFileIds(req.body);
  if (!ids.length) {
    sendFail(res, "缺少 ids", 400, API_CODES.missing_code);
    return;
  }
  let reverted = 0;
  let skipped = 0;
  for (const id of ids) {
    const outcome = deleteOrRevertFileRecord(id);
    if (outcome === "reverted") reverted += 1;
    else if (outcome === "skipped") skipped += 1;
  }
  sendOk(res, { reverted, skipped, ids });
});

filesRouter.get("/index-all/status", (_req, res) => {
  sendOk(res, { index: getIndexAllStatus() });
});

filesRouter.post("/index-all", (req, res) => {
  const kindIds = Array.isArray(req.body?.kinds)
    ? req.body.kinds.map((x: unknown) => String(x).trim()).filter(Boolean)
    : [];
  try {
    const index = startIndexAll(kindIds);
    sendOk(res, { index });
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 400, "index_all_failed");
  }
});

filesRouter.post("/:id/retry", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    sendFail(res, "无效 id", 400, API_CODES.missing_code);
    return;
  }
  try {
    const { updatedIds, jobId, merged, resumed, error } = await enqueueFailedRescrape([id]);
    const db = openDatabase();
    const row = db.prepare(`SELECT * FROM files WHERE id = ?`).get(id);
    sendOk(res, { file: row, updated: updatedIds.length, jobId, merged, resumed, error });
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 400, "job_create_invalid");
  }
});
}
