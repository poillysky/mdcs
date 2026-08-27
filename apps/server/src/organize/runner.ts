import path from "node:path";
import fs from "node:fs";
import { loadLibrariesConfig, resolveKind, resolveOrganizeForKind } from "../config/loadConfig.js";
import { loadScrapeConfig, resolveKindScrapePrefs } from "../config/loadScrape.js";
import { openDatabase } from "../db/init.js";
import { PROJECT_ROOT, resolveFromRoot, toPosixRelative } from "../paths.js";
import { readScrapeCache, writeScrapeCache } from "../scrape/cache.js";
import type { JobOptions } from "../jobs/options.js";
import type { KindId } from "../types.js";
import { applyFileTransfer, copySidecar } from "./fsops.js";
import { downloadExtrafanartToDir } from "./extrafanart.js";
import { writeMovieNfo } from "./nfo.js";
import { buildNfoWriteContext } from "./nfoCtx.js";
import { processPosterImage, processThumbImage } from "./poster.js";
import { buildPlanForFile, type FileOrganizeRow, type OrganizePlanItem } from "./plan.js";
import { copySubtitlesBesideVideo, findSubtitlesForCode } from "./subtitles.js";
import { cleanupSourceDirectory } from "./cleanup.js";
import { getPipeline } from "../scrape/pipelineProgress.js";
import {
  appendOrganizeDir,
  appendOrganizeNfo,
  appendOrganizePoster,
  appendOrganizeTransfer,
  appendPipelineFailure,
  appendSubtitleSearch,
  PIPELINE_STEPS,
  startOrganizeSteps,
} from "../scrape/pipelineLogHelpers.js";

export type OrganizeRunResult = {
  kind: KindId;
  total: number;
  organized: number;
  failed: number;
  skipped: number;
  plans: OrganizePlanItem[];
};

type Progress = (text: string) => void;

export function listOrganizableFiles(kind: KindId): FileOrganizeRow[] {
  const db = openDatabase();
  return db
    .prepare(
      `SELECT id, kind, source_path, file_name, code, mosaic, status FROM files
       WHERE kind = ? AND code IS NOT NULL
         AND status IN ('scraped', 'planned', 'failed', 'done')
       ORDER BY id ASC`,
    )
    .all(kind) as FileOrganizeRow[];
}

export function planOrganizeForKind(
  kindId: KindId,
  opts: { jobOptions?: JobOptions } = {},
): OrganizePlanItem[] {
  const config = loadLibrariesConfig();
  const kind = resolveKind(kindId, config);
  if (!kind) return [];
  if (kind.organizeMode !== "inplace" && !kind.libraryAbs) return [];
  const organize = resolveOrganizeForKind(kindId, config);
  const rows = listOrganizableFiles(kindId);
  const plans: OrganizePlanItem[] = [];
  for (const row of rows) {
    const plan = buildPlanForFile(row, kind, {
      projectRoot: PROJECT_ROOT,
      onConflict: organize.onConflict,
      organize,
      jobOptions: opts.jobOptions,
    });
    if (plan) plans.push(plan);
  }
  return plans;
}

export async function runOrganizeForKind(
  kindId: KindId,
  opts: {
    signal?: AbortSignal;
    onProgress?: Progress;
    dryRun?: boolean;
    jobId?: string;
    jobOptions?: JobOptions;
    /** 仅整理指定文件（详情页完整重刮） */
    fileIds?: number[];
  } = {},
): Promise<OrganizeRunResult> {
  const db = openDatabase();
  const config = loadLibrariesConfig();
  const scrapeCfg = loadScrapeConfig();
  const kind = resolveKind(kindId, config);
  const empty: OrganizeRunResult = {
    kind: kindId,
    total: 0,
    organized: 0,
    failed: 0,
    skipped: 0,
    plans: [],
  };
  if (!kind) return empty;
  if (kind.organizeMode !== "inplace" && !kind.libraryAbs) return empty;

  const idFilter = opts.fileIds?.length ? new Set(opts.fileIds) : null;
  const plans = planOrganizeForKind(kindId, { jobOptions: opts.jobOptions }).filter(
    (p) => !idFilter || idFilter.has(p.fileId),
  );
  let organized = 0;
  let failed = 0;
  let skipped = 0;
  const organize = resolveOrganizeForKind(kindId, config);
  const kindPrefs = resolveKindScrapePrefs(kindId, scrapeCfg);
  const jobId = opts.jobId?.trim() || null;

  const update = db.prepare(`
    UPDATE files SET status = @status, target_path = @target_path, error = @error,
      organized_at = @organized_at, job_id = COALESCE(@job_id, job_id)
    WHERE id = @id
  `);

  const useGlobalNfo = opts.jobOptions?.useGlobal?.nfo !== false;
  const jobNfo = opts.jobOptions?.nfo;
  const nfoMerge =
    (!useGlobalNfo &&
      (jobNfo?.mergeStrategy === "prefer_nfo" || jobNfo?.mergeStrategy === "prefer_scraped") &&
      jobNfo.mergeStrategy) ||
    kindPrefs.nfo.mergeStrategy;
  const nfoOpts = {
    writeActors: useGlobalNfo
      ? true
      : jobNfo?.writeActors !== false && jobNfo?.include?.actor !== false,
    writeGenres: useGlobalNfo
      ? true
      : jobNfo?.writeGenres !== false && jobNfo?.include?.genre !== false,
    mergeStrategy: nfoMerge,
    nfo:
      !useGlobalNfo && jobNfo
        ? {
            ...kindPrefs.nfo,
            enabled: typeof jobNfo.enabled === "boolean" ? jobNfo.enabled : kindPrefs.nfo.enabled,
            include: { ...kindPrefs.nfo.include, ...jobNfo.include },
            tagExtras: { ...kindPrefs.nfo.tagExtras, ...(jobNfo.tagExtras as typeof kindPrefs.nfo.tagExtras) },
            tagFormats: { ...kindPrefs.nfo.tagFormats, ...(jobNfo.tagFormats as typeof kindPrefs.nfo.tagFormats) },
            tagline: typeof jobNfo.tagline === "string" ? jobNfo.tagline : kindPrefs.nfo.tagline,
            mergeStrategy: nfoMerge,
          }
        : kindPrefs.nfo,
  };

  const useGlobalWm = opts.jobOptions?.useGlobal?.watermark !== false;
  const jobWm = opts.jobOptions?.watermark;
  const watermark = (
    useGlobalWm || !jobWm
      ? kindPrefs.watermark
      : {
          ...kindPrefs.watermark,
          ...(jobWm as object),
          enabled: jobWm.enabled ?? kindPrefs.watermark.enabled,
          position:
            (jobWm.position as typeof kindPrefs.watermark.position) ||
            kindPrefs.watermark.position,
          scalePercent: jobWm.scalePercent ?? kindPrefs.watermark.scalePercent,
        }
  ) as typeof kindPrefs.watermark;

  const subPath = kindPrefs.download.subtitleLibraryPath.trim();
  const subtitleAbs = subPath
    ? path.isAbsolute(subPath)
      ? subPath
      : resolveFromRoot(subPath, PROJECT_ROOT)
    : "";

  for (const plan of plans) {
    if (opts.signal?.aborted) break;
    opts.onProgress?.(`整理 ${plan.code} → ${plan.targetRel}`);

    const pipelineActive = Boolean(getPipeline(plan.fileId)?.active);

    if (pipelineActive && getPipeline(plan.fileId)?.steps.length === 0) {
      startOrganizeSteps(plan.fileId);
    }

    update.run({
      id: plan.fileId,
      status: "organizing",
      target_path: plan.targetRel,
      error: null,
      organized_at: null,
      job_id: jobId,
    });

    const transfer = applyFileTransfer({
      sourceAbs: plan.sourceAbs,
      targetAbs: plan.targetAbs,
      mode: plan.mode,
      fallback: plan.fallback,
      onConflict: plan.onConflict,
      dryRun: opts.dryRun,
    });

    if (!transfer.ok) {
      failed += 1;
      if (pipelineActive) {
        appendPipelineFailure(plan.fileId, PIPELINE_STEPS.transfer, {
          tone: "fail",
          text: transfer.message ?? "整理失败",
        });
      }
      update.run({
        id: plan.fileId,
        status: "failed",
        target_path: plan.targetRel,
        error: transfer.message ?? "整理失败",
        organized_at: null,
        job_id: jobId,
      });
      continue;
    }

    if (transfer.action === "skip" && transfer.message?.includes("已跳过")) {
      skipped += 1;
    }

    if (pipelineActive && plan.targetRel) {
      if (subtitleAbs) {
        const foundSubs = findSubtitlesForCode(subtitleAbs, plan.code);
        appendSubtitleSearch(plan.fileId, plan.code, foundSubs.length, true);
      } else {
        appendSubtitleSearch(plan.fileId, plan.code, 0, false);
      }
      appendOrganizeDir(plan.fileId, plan.targetRel);
    }

    let hasSubtitle = plan.hasSubtitle;
    if (subtitleAbs) {
      const addChs =
        Boolean(kindPrefs.download.subtitleAddChsSuffix) ||
        Boolean(kindPrefs.naming?.subtitleAddChsSuffix);
      const copied = copySubtitlesBesideVideo({
        libraryAbs: subtitleAbs,
        code: plan.code,
        videoAbs: transfer.targetAbs,
        addChsSuffix: addChs,
        onConflict: organize.onConflict,
        dryRun: opts.dryRun,
      });
      // 复制成功或 plan 阶段已探测到，都视为有字幕（水印/海报用）
      hasSubtitle = copied.length > 0 || plan.hasSubtitle;
    }

    let meta = readScrapeCache(plan.code, plan.kind);

    if (pipelineActive && plan.targetRel) {
      appendOrganizeTransfer(plan.fileId, plan.targetRel, plan.mode);
    }

    if (plan.coverSource && plan.posterAbs) {
      try {
        await processPosterImage(plan.coverSource, plan.posterAbs, {
          cropMode: plan.posterCrop || "none",
          cropRatio: kindPrefs.download.cropRatio,
          cropIndependentPoster: kindPrefs.download.cropIndependentPoster,
          preferCropResult: kindPrefs.download.preferCropResult,
          watermark,
          mosaic: plan.mosaic || meta?.mosaic,
          hasSubtitle,
          resolution: plan.resolution,
          imageKind: "poster",
          overwriteImages: organize.overwriteImages,
          dryRun: opts.dryRun,
        });
      } catch {
        if (organize.overwriteImages !== false || !fs.existsSync(plan.posterAbs)) {
          copySidecar(plan.coverSource, plan.posterAbs, opts.dryRun);
        }
      }

      const thumbAbs = path.join(path.dirname(plan.posterAbs), "thumb.jpg");
      try {
        await processThumbImage(plan.coverSource, thumbAbs, {
          cropRatio: kindPrefs.download.cropRatio,
          watermark,
          mosaic: plan.mosaic || meta?.mosaic,
          hasSubtitle,
          resolution: plan.resolution,
          overwriteImages: organize.overwriteImages,
          dryRun: opts.dryRun,
        });
      } catch {
        if (organize.overwriteImages !== false || !fs.existsSync(thumbAbs)) {
          copySidecar(plan.coverSource, thumbAbs, opts.dryRun);
        }
      }
      if (pipelineActive) {
        appendOrganizePoster(
          plan.fileId,
          toPosixRelative(plan.posterAbs),
          toPosixRelative(thumbAbs),
        );
      }
    }

    if (meta) {
      try {
        const thumbAbs = plan.posterAbs ? path.join(path.dirname(plan.posterAbs), "thumb.jpg") : null;
        if (
          kindPrefs.download.downloadFanart &&
          meta.extrafanartUrls?.length &&
          plan.posterAbs
        ) {
          const saved = await downloadExtrafanartToDir(path.dirname(plan.posterAbs), meta.extrafanartUrls, {
            referer: meta.website,
            sourceId: meta.fieldSources?.extrafanart || meta.source,
            force: organize.overwriteImages !== false,
            dryRun: opts.dryRun,
          });
          if (saved.length) {
            meta = { ...meta, extrafanartLocal: saved };
            writeScrapeCache(meta);
          }
        }
        writeMovieNfo(
          plan.nfoAbs,
          meta,
          {
            ...nfoOpts,
            mediaTitle: plan.mediaTitle,
            ctx: buildNfoWriteContext({
              meta,
              mediaTitle: plan.mediaTitle,
              hasSubtitle,
              resolution: plan.resolution || undefined,
              mosaic: plan.mosaic || meta.mosaic || undefined,
              posterAbs: plan.posterAbs,
              thumbAbs,
              cdPart: plan.part ? `CD${plan.part}` : undefined,
            }),
          },
          opts.dryRun,
        );
        if (pipelineActive) {
          appendOrganizeNfo(plan.fileId, plan.targetRel, meta.fieldSources ?? {});
        }
      } catch (err) {
        failed += 1;
        if (pipelineActive) {
          appendPipelineFailure(plan.fileId, PIPELINE_STEPS.nfo, {
            tone: "fail",
            text: err instanceof Error ? err.message : String(err),
          });
        }
        update.run({
          id: plan.fileId,
          status: "failed",
          target_path: plan.targetRel,
          error: err instanceof Error ? err.message : String(err),
          organized_at: null,
          job_id: jobId,
        });
        continue;
      }
    }

    if (organize.cleanup.enabled && !opts.dryRun) {
      cleanupSourceDirectory(path.dirname(plan.sourceAbs), organize);
    }

    organized += 1;
    update.run({
      id: plan.fileId,
      status: opts.dryRun ? "scraped" : "done",
      target_path: transfer.targetAbs === plan.targetAbs ? plan.targetRel : transfer.targetAbs,
      error: null,
      organized_at: opts.dryRun ? null : Date.now(),
      job_id: jobId,
    });
  }

  return {
    kind: kindId,
    total: plans.length,
    organized,
    failed,
    skipped,
    plans,
  };
}

export async function runOrganizeForKinds(
  kinds: KindId[],
  opts: {
    signal?: AbortSignal;
    onProgress?: Progress;
    dryRun?: boolean;
    jobId?: string;
    jobOptions?: JobOptions;
  } = {},
): Promise<OrganizeRunResult[]> {
  const results: OrganizeRunResult[] = [];
  for (const kind of kinds) {
    if (opts.signal?.aborted) break;
    opts.onProgress?.(`开始整理分区 ${kind}`);
    results.push(await runOrganizeForKind(kind, opts));
  }
  return results;
}

/** 单文件立即整理（详情页「重新整理」） */
export async function organizeOneFile(
  fileId: number,
  opts: { signal?: AbortSignal; onProgress?: Progress } = {},
): Promise<OrganizeRunResult> {
  const db = openDatabase();
  const row = db
    .prepare(`SELECT id, kind, code FROM files WHERE id = ?`)
    .get(fileId) as { id: number; kind: KindId; code: string | null } | undefined;
  if (!row) throw new Error("文件不存在");
  if (!row.code) throw new Error("无番号，无法整理");

  if (getPipeline(fileId)?.active) {
    startOrganizeSteps(fileId);
  }

  db.prepare(
    `UPDATE files SET status = 'planned', target_path = NULL, organized_at = NULL, error = NULL WHERE id = ?`,
  ).run(fileId);

  return runOrganizeForKind(row.kind, {
    fileIds: [fileId],
    signal: opts.signal,
    onProgress: opts.onProgress,
    jobOptions: {
      useGlobal: { organize: false, nfo: true, watermark: true, download: true },
      organize: { onConflict: "overwrite" },
    },
  });
}
