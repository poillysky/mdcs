import { Router } from "express";
import { openDatabase } from "../../db/init.js";
import { readScrapeCache, writeScrapeCache } from "../../scrape/cache.js";
import { applyMetaFieldPatches } from "../../scrape/metaPatch.js";
import { toStorageRelativePath } from "../../paths.js";
import type { KindId } from "../../types.js";
import { KIND_IDS } from "../../types.js";
import { API_CODES } from "../codes.js";
import { sendFail, sendOk } from "../respond.js";

export function registerDetailRoutes(filesRouter: Router) {
filesRouter.patch("/:id/meta", (req, res) => {
  const db = openDatabase();
  const row = db
    .prepare(`SELECT id, kind, code FROM files WHERE id = ?`)
    .get(req.params.id) as { id: number; kind: KindId; code: string | null } | undefined;
  if (!row) {
    sendFail(res, "文件不存在", 404, API_CODES.not_found);
    return;
  }
  if (!row.code) {
    sendFail(res, "无番号，无法更新元数据", 400, API_CODES.missing_code);
    return;
  }
  const fields = req.body?.fields;
  if (!fields || typeof fields !== "object") {
    sendFail(res, "缺少 fields", 400, API_CODES.missing_code);
    return;
  }
  const cached = readScrapeCache(row.code, row.kind);
  if (!cached) {
    sendFail(res, "尚无刮削缓存，请先刮削", 404, "no_meta_cache");
    return;
  }
  const next = applyMetaFieldPatches(
    cached,
    fields as Record<string, { value: string; source: string }>,
  );
  writeScrapeCache(next);
  sendOk(res, { meta: readScrapeCache(row.code, row.kind), fileId: row.id });
});

filesRouter.get("/:id", (req, res) => {
  const db = openDatabase();
  const row = db
    .prepare(
      `SELECT id, kind, source_path, file_name, file_size, file_mtime, code, cd_index, mosaic,
              status, target_path, error, scraped_at, organized_at
       FROM files WHERE id = ?`,
    )
    .get(req.params.id) as
    | {
        id: number;
        kind: KindId;
        code: string | null;
        [k: string]: unknown;
      }
    | undefined;

  if (!row) {
    sendFail(res, "文件不存在", 404, API_CODES.not_found);
    return;
  }

  const meta =
    row.code && KIND_IDS.includes(row.kind) ? readScrapeCache(row.code, row.kind) : null;
  const file = {
    ...row,
    source_path: row.source_path ? toStorageRelativePath(String(row.source_path)) : row.source_path,
    target_path:
      row.target_path != null && row.target_path !== ""
        ? String(row.target_path).trim().replace(/\\/g, "/").replace(/^\/+/, "")
        : row.target_path,
  };
  sendOk(res, { file, meta });
});
}
