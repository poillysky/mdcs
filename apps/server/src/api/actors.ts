import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { getActorDetail, listActors, listMissingActorNames } from "../ops/actors.js";
import { getActorProfile, resolveAvatarAbs } from "../ops/actorProfiles.js";
import { scrapeActorProfiles } from "../ops/actorScrape.js";
import { sendFail, sendOk } from "./respond.js";

export const actorsRouter = Router();

actorsRouter.get("/", (req, res) => {
  try {
    const result = listActors({
      q: req.query.q ? String(req.query.q) : undefined,
      page: parseInt(String(req.query.page ?? "1"), 10) || 1,
      pageSize: parseInt(String(req.query.pageSize ?? "50"), 10) || 50,
      status: req.query.status ? String(req.query.status) : undefined,
    });
    sendOk(res, result);
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 500);
  }
});

actorsRouter.get("/detail", (req, res) => {
  try {
    const name = String(req.query.name || "").trim();
    if (!name) {
      sendFail(res, "缺少 name", 400);
      return;
    }
    const actor = getActorDetail(name);
    if (!actor) {
      sendFail(res, "未找到演员", 404);
      return;
    }
    sendOk(res, { actor });
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 500);
  }
});

actorsRouter.get("/avatar", (req, res) => {
  try {
    const name = String(req.query.name || "").trim();
    if (!name) {
      sendFail(res, "缺少 name", 400);
      return;
    }
    const profile = getActorProfile(name);
    const abs = profile ? resolveAvatarAbs(profile.avatarPath) : null;
    if (!abs) {
      sendFail(res, "头像不存在", 404);
      return;
    }
    const ext = path.extname(abs).toLowerCase();
    const ct =
      ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : "image/jpeg";
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "private, no-cache");
    const st = fs.statSync(abs);
    res.setHeader("Last-Modified", st.mtime.toUTCString());
    fs.createReadStream(abs).pipe(res);
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 500);
  }
});

actorsRouter.post("/scrape", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const missingOnly = Boolean(body.missingOnly);
    const forceImage = Boolean(body.forceImage);
    let names: string[] = [];
    if (Array.isArray(body.names)) {
      names = body.names.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
    }
    if (!names.length && missingOnly) {
      const limit =
        typeof body.limit === "number" && Number.isFinite(body.limit)
          ? Math.min(500, Math.max(1, Math.floor(body.limit)))
          : 200;
      names = listMissingActorNames(limit);
    }
    if (!names.length) {
      sendFail(res, "请提供 names，或设置 missingOnly 刮削缺失档案", 400);
      return;
    }
    const logs: string[] = [];
    const result = await scrapeActorProfiles(names, {
      missingOnly,
      forceImage,
      onProgress: (t) => logs.push(t),
    });
    sendOk(res, { ...result, logs });
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 400);
  }
});
