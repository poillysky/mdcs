import { Router } from "express";
import path from "node:path";
import { openDatabase } from "../../db/init.js";
import {
  applyCoverCrop,
  listCoverCropBrowse,
  resolveCoverCropPreviewAbs,
  resolveCoverCropSource,
  saveCoverCropUpload,
  type CoverCropRequest,
} from "../../organize/coverCrop.js";
import { readScrapeCache } from "../../scrape/cache.js";
import { preferThumbCoverUrl } from "../../scrape/downloadPrefs.js";
import type { KindId } from "../../types.js";
import { KIND_IDS } from "../../types.js";
import { API_CODES } from "../codes.js";
import {
  pickRemotePosterUrl,
  pickRemoteThumbUrl,
  resolveCachedCoverAbs,
  resolveCachedThumbCoverAbs,
  resolvePosterLocalAbs,
  resolveThumbLocalAbs,
} from "../coverAssetResolve.js";
import {
  findCachedCoverAbs,
  findLibraryAssetAbs,
  galleryAssetUrl,
  listGalleryAssets,
  loadFileRow,
} from "../libraryAssets.js";
import { sendFail, sendOk } from "../respond.js";
import { coverCropUploadParser } from "./parsers.js";
import { sendRemoteImage } from "./remoteImage.js";

export function registerAssetRoutes(filesRouter: Router) {
filesRouter.get("/:id/asset/poster", async (req, res) => {
  const fileId = Number(req.params.id);
  const file = Number.isFinite(fileId) ? loadFileRow(fileId) : null;
  if (!file) {
    sendFail(res, "文件不存在", 404, API_CODES.not_found);
    return;
  }
  const local = resolvePosterLocalAbs(file);
  if (local) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.sendFile(path.resolve(local));
    return;
  }
  if (file.code) {
    const meta = readScrapeCache(file.code, file.kind);
    if (meta) {
      const remotePoster = pickRemotePosterUrl(meta);
      if (remotePoster) {
        const ok = await sendRemoteImage(res, remotePoster, {
          pageUrl: meta.website,
          sourceId: meta.fieldSources?.cover || meta.source,
        });
        if (ok) return;
      }
    }
    const cached = resolveCachedCoverAbs(file);
    if (cached) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.sendFile(path.resolve(cached));
      return;
    }
    if (meta) {
      const remote = meta.coverUrl?.trim();
      if (remote && /^https?:\/\//i.test(remote)) {
        const ok = await sendRemoteImage(res, remote, {
          pageUrl: meta.website,
          sourceId: meta.fieldSources?.cover || meta.source,
        });
        if (ok) return;
      }
    }
  }
  sendFail(res, "海报不存在", 404, API_CODES.not_found);
});

filesRouter.get("/:id/asset/thumb", async (req, res) => {
  const fileId = Number(req.params.id);
  const file = Number.isFinite(fileId) ? loadFileRow(fileId) : null;
  if (!file) {
    sendFail(res, "文件不存在", 404, API_CODES.not_found);
    return;
  }
  const local = await resolveThumbLocalAbs(file);
  if (local) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.sendFile(path.resolve(local));
    return;
  }
  if (file.code) {
    const meta = readScrapeCache(file.code, file.kind);
    if (meta) {
      const remoteThumb = pickRemoteThumbUrl(meta);
      if (remoteThumb) {
        const ok = await sendRemoteImage(res, remoteThumb, {
          pageUrl: meta.website,
          sourceId: meta.fieldSources?.cover || meta.source,
        });
        if (ok) return;
      }
    }
    const cachedThumb = await resolveCachedThumbCoverAbs(file);
    if (cachedThumb) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.sendFile(path.resolve(cachedThumb));
      return;
    }
    if (meta) {
      const remote = preferThumbCoverUrl(meta.coverUrl?.trim() || "");
      if (remote && /^https?:\/\//i.test(remote)) {
        const ok = await sendRemoteImage(res, remote, {
          pageUrl: meta.website,
          sourceId: meta.fieldSources?.cover || meta.source,
        });
        if (ok) return;
      }
    }
  }
  sendFail(res, "缩略图不存在", 404, API_CODES.not_found);
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
}
