import { Router } from "express";
import { KIND_IDS, type KindId } from "../types.js";
import { planOrganizeForKind, runOrganizeForKind } from "../organize/runner.js";
import { defaultNamingConfig } from "../organize/namingConfig.js";
import {
  applyTemplate,
  buildTemplateContext,
  buildVideoNameSuffix,
  joinLibraryTarget,
} from "../organize/template.js";
import type { GlobalNamingConfig, ScrapeMeta } from "../scrape/types.js";
import { API_CODES } from "./codes.js";
import { sendFail, sendOk } from "./respond.js";

export const organizeRouter = Router();

function isObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

organizeRouter.get("/plan/:kind", (req, res) => {
  const kind = req.params.kind as KindId;
  if (!KIND_IDS.includes(kind)) {
    sendFail(res, `无效 kind: ${kind}`, 400, API_CODES.invalid_kind);
    return;
  }
  const plans = planOrganizeForKind(kind);
  sendOk(res, {
    kind,
    total: plans.length,
    plans: plans.map((p) => ({
      fileId: p.fileId,
      code: p.code,
      title: p.title,
      mediaTitle: p.mediaTitle,
      sourceRel: p.sourceRel,
      targetRel: p.targetRel,
      mode: p.mode,
      onConflict: p.onConflict,
      mosaic: p.mosaic,
      posterCrop: p.posterCrop,
      hasSubtitle: p.hasSubtitle,
    })),
  });
});

organizeRouter.post("/preview", (req, res) => {
  const kind = String(req.body?.kind || "japan_censored") as KindId;
  if (!KIND_IDS.includes(kind)) {
    sendFail(res, `无效 kind: ${kind}`, 400, API_CODES.invalid_kind);
    return;
  }
  const code = String(req.body?.code || "ABC-123").trim() || "ABC-123";
  const directoryTemplate = String(
    req.body?.directoryTemplate || "{category}/{studio}/{series_name}/{number}",
  );
  const fileNameTemplate = String(req.body?.fileNameTemplate || "{number}");
  const nameSuffixTemplate = String(req.body?.nameSuffixTemplate || "");
  const videoSuffixTemplate =
    req.body?.videoSuffixTemplate != null ? String(req.body.videoSuffixTemplate) : undefined;
  const mosaic = String(req.body?.mosaic || "");
  const title = String(req.body?.title || code);
  const studio = String(req.body?.studio || "Studio");
  const series = String(req.body?.series || "");
  const hasSubtitle = Boolean(req.body?.hasSubtitle);
  const resolution = req.body?.resolution != null ? String(req.body.resolution) : undefined;
  const part = req.body?.part != null ? req.body.part : undefined;
  const actors = Array.isArray(req.body?.actors) ? req.body.actors.map(String) : ["Actor"];
  const namingPatch = isObject(req.body?.naming) ? req.body.naming : {};

  const meta: ScrapeMeta = {
    code,
    kind,
    title,
    actors,
    genres: [],
    studio,
    series,
    source: "preview",
    sourcesTried: [],
    fieldSources: {},
    scrapedAt: new Date().toISOString(),
    ok: true,
  };

  const naming: GlobalNamingConfig = {
    ...defaultNamingConfig(),
    ...(namingPatch as Partial<GlobalNamingConfig>),
    directoryTemplate,
    fileNameTemplate,
    nameSuffixTemplate: nameSuffixTemplate || defaultNamingConfig().nameSuffixTemplate,
    ...(videoSuffixTemplate != null ? { videoSuffixTemplate } : {}),
  };

  const ctx = buildTemplateContext({
    kind,
    code,
    fileName: `${code}.mp4`,
    sourcePath: `inbox/${code}.mp4`,
    mosaic,
    meta,
    naming,
    hasSubtitle,
    resolution,
    part,
  });

  let suffixRaw = "";
  if (nameSuffixTemplate && !videoSuffixTemplate && !namingPatch.videoSuffixTemplate) {
    suffixRaw = applyTemplate(nameSuffixTemplate, ctx, {
      forPath: false,
      emptyAsBlank: true,
    }).replace(/^-+|-+$/g, "");
  } else {
    suffixRaw = buildVideoNameSuffix(ctx, naming).replace(/^-+|-+$/g, "");
  }
  const suffixPart = suffixRaw
    ? suffixRaw.startsWith("-")
      ? suffixRaw
      : `-${suffixRaw.replace(/^-/, "")}`
    : "";
  const fileTpl = suffixPart ? `${fileNameTemplate}${suffixPart}` : fileNameTemplate;
  const mediaTitle = applyTemplate(String(naming.mediaTitleTemplate || "{title}"), ctx, {
    forPath: false,
  });
  const joined = joinLibraryTarget("/library", directoryTemplate, fileTpl, ".mp4", ctx, {
    maxDirectoryLength: Number(naming.maxDirectoryLength) || 0,
  });
  sendOk(res, {
    kind,
    code,
    relativeDir: joined.relativeDir,
    fileName: joined.fileName,
    mediaTitle,
    targetRel: joined.relativeDir ? `${joined.relativeDir}/${joined.fileName}` : joined.fileName,
    ctx,
  });
});

organizeRouter.post("/run/:kind", async (req, res) => {
  const kind = req.params.kind as KindId;
  if (!KIND_IDS.includes(kind)) {
    sendFail(res, `无效 kind: ${kind}`, 400, API_CODES.invalid_kind);
    return;
  }
  try {
    const result = await runOrganizeForKind(kind, {
      dryRun: Boolean(req.body?.dryRun),
    });
    sendOk(res, {
      kind: result.kind,
      total: result.total,
      organized: result.organized,
      failed: result.failed,
      skipped: result.skipped,
      dryRun: Boolean(req.body?.dryRun),
      plans: result.plans.map((p) => ({
        fileId: p.fileId,
        code: p.code,
        targetRel: p.targetRel,
        mode: p.mode,
      })),
    });
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 500, API_CODES.internal_error);
  }
});
