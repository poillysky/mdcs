import { Router } from "express";
import express from "express";
import path from "node:path";
import { openDatabase } from "../db/init.js";
import { getJob } from "../jobs/scheduler.js";
import { readScrapeCache, writeScrapeCache } from "../scrape/cache.js";
import { applyMetaFieldPatches } from "../scrape/metaPatch.js";
import { ensureSourceSnapshots } from "../scrape/orchestrator.js";
import type { KindId } from "../types.js";
import { KIND_IDS } from "../types.js";
import { API_CODES } from "./codes.js";
import {
  findCachedCoverAbs,
  findLibraryAssetAbs,
  galleryAssetUrl,
  listGalleryAssets,
  loadFileRow,
} from "./libraryAssets.js";
import { sendFail, sendOk } from "./respond.js";
import { FILE_LIST_JOINS, FILE_LIST_SELECT, mapFileListRow } from "./fileListMap.js";
import {
  beginPipeline,
  endPipeline,
  getPipeline,
  getPipelineHistory,
  type PipelineRunKind,
} from "../scrape/pipelineProgress.js";
import {
  applyCoverCrop,
  listCoverCropBrowse,
  resolveCoverCropPreviewAbs,
  resolveCoverCropSource,
  saveCoverCropUpload,
  type CoverCropRequest,
} from "../organize/coverCrop.js";

const coverCropUploadParser = express.json({ limit: "12mb" });

export const filesRouter = Router();

function applyJobFilesScope(
  jobId: string,
  where: string[],
  params: (string | number)[],
): { ok: true } | { ok: false; message: string } {
  const job = getJob(jobId);
  if (!job) return { ok: false, message: "任务不存在" };
  where.push("f.job_id = ?");
  params.push(jobId);
  return { ok: true };
}

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

async function sendRemoteImage(
  res: import("express").Response,
  rawUrl: string,
  ctx?: { pageUrl?: string; sourceId?: string },
): Promise<boolean> {
  try {
    const { fetchBuffer } = await import("../scrape/network/fetch.js");
    const { cookieForUrl } = await import("../scrape/network/sourceCookies.js");
    const { resolveCoverImageReferer } = await import("../scrape/network/imageReferer.js");
    const { downloadFlareProtectedCoverImage } = await import("../scrape/network/coverDownload.js");
    const referer = resolveCoverImageReferer(rawUrl, ctx);
    let buf =
      (await downloadFlareProtectedCoverImage(rawUrl, {
        pageUrl: ctx?.pageUrl,
        referer,
        sourceId: ctx?.sourceId,
      })) ?? null;
    if (!buf) {
      buf = await fetchBuffer(rawUrl, {
        referer,
        cookie: cookieForUrl(rawUrl, ctx?.sourceId),
      });
    }
    const ext = rawUrl.match(/\.(jpe?g|png|webp|gif)(\?|$)/i)?.[1]?.toLowerCase() ?? "jpeg";
    const mime =
      ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : ext === "gif"
            ? "image/gif"
            : "image/jpeg";
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.send(buf);
    return true;
  } catch {
    return false;
  }
}

filesRouter.get("/:id/asset/poster", async (req, res) => {
  const fileId = Number(req.params.id);
  const file = Number.isFinite(fileId) ? loadFileRow(fileId) : null;
  if (!file) {
    sendFail(res, "文件不存在", 404, API_CODES.not_found);
    return;
  }
  const local = findLibraryAssetAbs(file, "poster");
  if (local) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.sendFile(path.resolve(local));
    return;
  }
  if (file.code) {
    const cached = findCachedCoverAbs(file.code, file.kind);
    if (cached) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.sendFile(path.resolve(cached));
      return;
    }
    const meta = readScrapeCache(file.code, file.kind);
    const remote = meta?.coverUrl?.trim();
    if (remote && /^https?:\/\//i.test(remote)) {
      const ok = await sendRemoteImage(res, remote, {
        pageUrl: meta?.website,
        sourceId: meta?.fieldSources?.cover || meta?.source,
      });
      if (ok) return;
    }
  }
  sendFail(res, "海报不存在", 404, API_CODES.not_found);
});

filesRouter.get("/:id/asset/thumb", (req, res) => {
  const fileId = Number(req.params.id);
  const file = Number.isFinite(fileId) ? loadFileRow(fileId) : null;
  if (!file) {
    sendFail(res, "文件不存在", 404, API_CODES.not_found);
    return;
  }
  const local = findLibraryAssetAbs(file, "thumb");
  if (!local) {
    sendFail(res, "缩略图不存在", 404, API_CODES.not_found);
    return;
  }
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.sendFile(path.resolve(local));
});

filesRouter.get("/:id/asset/fanart/:index", (req, res) => {
  const fileId = Number(req.params.id);
  const file = Number.isFinite(fileId) ? loadFileRow(fileId) : null;
  if (!file) {
    sendFail(res, "文件不存在", 404, API_CODES.not_found);
    return;
  }
  const index = Math.max(1, parseInt(String(req.params.index || "1"), 10) || 1);
  const local = findLibraryAssetAbs(file, "fanart", index);
  if (!local) {
    sendFail(res, "剧照不存在", 404, API_CODES.not_found);
    return;
  }
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.sendFile(path.resolve(local));
});

filesRouter.get("/:id/gallery", (req, res) => {
  const fileId = Number(req.params.id);
  const file = Number.isFinite(fileId) ? loadFileRow(fileId) : null;
  if (!file) {
    sendFail(res, "文件不存在", 404, API_CODES.not_found);
    return;
  }
  const items = listGalleryAssets(file).map((item) => ({
    url: galleryAssetUrl(fileId, item),
  }));
  sendOk(res, { items });
});

filesRouter.get("/:id/cover-crop/browse", (req, res) => {
  const fileId = Number(req.params.id);
  const file = Number.isFinite(fileId) ? loadFileRow(fileId) : null;
  if (!file) {
    sendFail(res, "文件不存在", 404, API_CODES.not_found);
    return;
  }
  const parent = String(req.query.parent ?? "");
  try {
    sendOk(res, listCoverCropBrowse(parent));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = msg.includes("不在允许范围内")
      ? API_CODES.path_not_allowed
      : API_CODES.bad_request;
    sendFail(res, msg, 400, code);
  }
});

filesRouter.get("/:id/cover-crop/source", async (req, res) => {
  const fileId = Number(req.params.id);
  const file = Number.isFinite(fileId) ? loadFileRow(fileId) : null;
  if (!file) {
    sendFail(res, "文件不存在", 404, API_CODES.not_found);
    return;
  }
  const uploadToken = String(req.query.uploadToken || "").trim() || undefined;
  const source = String(req.query.source || "local").trim() || "local";
  try {
    const info = await resolveCoverCropSource(file, {
      source,
      uploadToken,
    });
    if (!info) {
      sendFail(res, "原图不存在", 404, "cover_source_missing");
      return;
    }
    sendOk(res, {
      sourceKey: info.sourceKey,
      path: info.path,
      width: info.width,
      height: info.height,
      previewUrl: info.previewUrl,
    });
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 500, API_CODES.internal_error);
  }
});

filesRouter.get("/:id/cover-crop/preview", async (req, res) => {
  const fileId = Number(req.params.id);
  const file = Number.isFinite(fileId) ? loadFileRow(fileId) : null;
  if (!file) {
    sendFail(res, "文件不存在", 404, API_CODES.not_found);
    return;
  }
  const uploadToken = String(req.query.uploadToken || "").trim() || undefined;
  const source = String(req.query.source || "").trim() || undefined;
  try {
    const abs = await resolveCoverCropPreviewAbs(file, { uploadToken, source });
    if (!abs) {
      sendFail(res, "原图不存在", 404, "cover_source_missing");
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.resolve(abs));
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 500, API_CODES.internal_error);
  }
});

filesRouter.post("/:id/cover-crop/upload", coverCropUploadParser, (req, res) => {
  const fileId = Number(req.params.id);
  const file = Number.isFinite(fileId) ? loadFileRow(fileId) : null;
  if (!file) {
    sendFail(res, "文件不存在", 404, API_CODES.not_found);
    return;
  }
  const raw = String(req.body?.data || "");
  const match = raw.match(/^data:image\/\w+;base64,(.+)$/);
  const b64 = match ? match[1] : raw;
  if (!b64) {
    sendFail(res, "缺少图片数据", 400, API_CODES.missing_code);
    return;
  }
  try {
    const buf = Buffer.from(b64, "base64");
    if (buf.length < 32) {
      sendFail(res, "图片数据无效", 400, API_CODES.missing_code);
      return;
    }
    const name = String(req.body?.filename || "upload.jpg");
    const ext = path.extname(name).toLowerCase();
    const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext) ? ext : ".jpg";
    const token = saveCoverCropUpload(fileId, buf, safeExt);
    sendOk(res, { uploadToken: token, previewUrl: `/api/files/${fileId}/cover-crop/preview?uploadToken=${encodeURIComponent(token)}` });
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 500, API_CODES.internal_error);
  }
});

filesRouter.post("/:id/cover-crop", async (req, res) => {
  const fileId = Number(req.params.id);
  const file = Number.isFinite(fileId) ? loadFileRow(fileId) : null;
  if (!file) {
    sendFail(res, "文件不存在", 404, API_CODES.not_found);
    return;
  }
  const body = req.body as CoverCropRequest;
  if (!body?.cropStyle) {
    sendFail(res, "缺少 cropStyle", 400, API_CODES.missing_code);
    return;
  }
  try {
    const result = await applyCoverCrop(file, body);
    const db = openDatabase();
    db.prepare(`UPDATE files SET organized_at = ? WHERE id = ?`).run(result.updatedAt, file.id);
    sendOk(res, {
      fileId: file.id,
      posterUrl: `/api/files/${file.id}/asset/poster?v=${result.updatedAt}`,
      thumbUrl: result.thumbPath
        ? `/api/files/${file.id}/asset/thumb?v=${result.updatedAt}`
        : undefined,
      posterPath: result.posterPath,
      thumbPath: result.thumbPath,
      updatedAt: result.updatedAt,
    });
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 500, API_CODES.internal_error);
  }
});

filesRouter.get("/cover/:kind/:code", (req, res) => {
  const kind = String(req.params.kind || "") as KindId;
  const code = decodeURIComponent(String(req.params.code || "")).trim();
  if (!code || !KIND_IDS.includes(kind)) {
    sendFail(res, "参数无效", 400, API_CODES.missing_code);
    return;
  }
  const local = findCachedCoverAbs(code, kind);
  if (!local) {
    sendFail(res, "封面不存在", 404, API_CODES.not_found);
    return;
  }
  res.sendFile(path.resolve(local));
});

filesRouter.get("/image-proxy", async (req, res) => {
  const rawUrl = String(req.query.url || "").trim();
  if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) {
    sendFail(res, "无效 url", 400, API_CODES.missing_code);
    return;
  }
  const pageUrl = String(req.query.pageUrl || "").trim();
  const sourceId = String(req.query.source || "").trim();
  const ok = await sendRemoteImage(res, rawUrl, {
    pageUrl: pageUrl || undefined,
    sourceId: sourceId || undefined,
  });
  if (!ok) {
    sendFail(res, "图片获取失败", 502, API_CODES.internal_error);
  }
});

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
  sendOk(res, { file: row, meta });
});

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

function parseFileIds(body: unknown): number[] {
  if (!body || typeof body !== "object") return [];
  const ids = (body as { ids?: unknown }).ids;
  if (!Array.isArray(ids)) return [];
  return ids.map((x) => Number(x)).filter((n) => Number.isFinite(n));
}

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

filesRouter.get("/:id/pipeline-log", (req, res) => {
  const fileId = Number(req.params.id);
  if (!Number.isFinite(fileId)) {
    sendFail(res, "无效 id", 400, API_CODES.missing_code);
    return;
  }
  const state = getPipeline(fileId);
  sendOk(res, {
    active: state?.active ?? false,
    mode: state?.mode,
    kind: state?.kind,
    steps: state?.steps ?? [],
    runs: getPipelineHistory(fileId),
  });
});

const PIPELINE_RUN_KINDS = new Set<PipelineRunKind>([
  "initial",
  "retry",
  "rescrape",
  "reorganize",
]);

function parsePipelineRunKind(
  fileId: number,
  raw: unknown,
  mode: "rescrape" | "reorganize",
): PipelineRunKind {
  if (mode === "reorganize") {
    if (typeof raw === "string" && PIPELINE_RUN_KINDS.has(raw as PipelineRunKind)) {
      return raw as PipelineRunKind;
    }
    return "reorganize";
  }
  // 尚无「首次」归档时，本次记为首次（避免用最新 scraped_at 假造时间）
  const history = getPipelineHistory(fileId);
  if (!history.some((r) => r.kind === "initial")) return "initial";
  if (typeof raw === "string" && PIPELINE_RUN_KINDS.has(raw as PipelineRunKind)) {
    return raw as PipelineRunKind;
  }
  return "retry";
}

filesRouter.post("/:id/rescrape", async (req, res) => {
  const db = openDatabase();
  const row = db
    .prepare(`SELECT id, kind, code FROM files WHERE id = ?`)
    .get(req.params.id) as { id: number; kind: KindId; code: string | null } | undefined;
  if (!row) {
    sendFail(res, "文件不存在", 404, "not_found");
    return;
  }

  const mode = req.body?.mode === "reorganize" ? "reorganize" : "rescrape";
  const runKind = parsePipelineRunKind(row.id, req.body?.kind, mode);
  const codeOverride = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  const pageUrl = typeof req.body?.pageUrl === "string" ? req.body.pageUrl.trim() : "";
  const force = req.body?.force !== false;

  if (codeOverride) {
    db.prepare(`UPDATE files SET code = ? WHERE id = ?`).run(codeOverride, row.id);
    row.code = codeOverride;
  }
  if (!row.code) {
    sendFail(res, "无番号，无法执行", 400, API_CODES.missing_code);
    return;
  }

  try {
    const { scrapeOneFile } = await import("../scrape/runner.js");
    const { organizeOneFile, runOrganizeForKind } = await import("../organize/runner.js");

    beginPipeline(row.id, mode, runKind);

    if (mode === "reorganize") {
      try {
        const org = await organizeOneFile(row.id);
        const meta = readScrapeCache(row.code, row.kind);
        const organized = org.organized > 0;
        sendOk(res, {
          meta,
          fileId: row.id,
          mode,
          organized,
          organize: {
            organized: org.organized,
            failed: org.failed,
            skipped: org.skipped,
          },
          message: organized
            ? "已重新整理"
            : org.failed
              ? "整理失败"
              : "整理未执行（检查库路径/冲突策略）",
        });
      } finally {
        endPipeline(row.id);
      }
      return;
    }

    try {
      const scraped = await scrapeOneFile(row.id, {
        force,
        codeOverride: codeOverride || undefined,
        pageUrl: pageUrl || undefined,
      });
      if (!scraped.ok) {
        sendOk(res, {
          meta: scraped.meta,
          fileId: row.id,
          mode,
          organized: false,
          message: scraped.meta.message ?? "刮削未成功，已跳过整理",
        });
        return;
      }

      const org = await runOrganizeForKind(row.kind, {
        fileIds: [row.id],
        jobOptions: {
          useGlobal: { organize: false, nfo: true, watermark: true, download: true },
          organize: { onConflict: "overwrite" },
        },
      });
      const meta = readScrapeCache(row.code, row.kind) ?? scraped.meta;
      const organized = org.organized > 0;
      sendOk(res, {
        meta,
        fileId: row.id,
        mode,
        organized,
        organize: {
          organized: org.organized,
          failed: org.failed,
          skipped: org.skipped,
        },
        message: organized
          ? "已完整重刮并整理"
          : org.failed
            ? "刮削成功，整理失败"
            : "刮削成功，整理未执行（检查库路径/冲突策略）",
      });
    } finally {
      endPipeline(row.id);
    }
  } catch (err) {
    endPipeline(row.id);
    sendFail(res, err instanceof Error ? err.message : String(err), 500, API_CODES.internal_error);
  }
});
