import path from "node:path";
import fs from "node:fs";
import { loadLibrariesConfig, resolveKind, resolveOrganizeForKind } from "../config/loadConfig.js";
import {
  loadScrapeConfig,
  resolveEffectiveDownload,
  resolveKindScrapePrefs,
} from "../config/loadScrape.js";
import { openDatabase } from "../db/init.js";
import { notifyFileChanges } from "../files/events.js";
import { PROJECT_ROOT, resolveFromRoot, toLibraryRelativePath, toPosixRelative } from "../paths.js";
import { withPersistLock } from "../db/persistLock.js";
import { downloadCover, readScrapeCache, writeScrapeCache } from "../scrape/cache.js";
import { resolveThumbDownloadUrl } from "../scrape/coverUrls.js";
import { isLandscapeImageFile } from "../api/imageProbe.js";
import type { JobOptions } from "../jobs/options.js";
import { releaseInflightFileState, releaseStuckInflightFileState } from "../jobs/jobFiles.js";
import { FILE_ORGANIZE_QUEUE_ORDER_SQL } from "../files/pipelineState.js";
import type { KindId } from "../types.js";
import { applyFileTransfer, copySidecar } from "./fsops.js";
import { downloadExtrafanartToDir } from "./extrafanart.js";
import { writeMovieNfo } from "./nfo.js";
import { buildNfoWriteContext } from "./nfoCtx.js";
import { processPosterImage, processThumbImage } from "./poster.js";
import { buildPlanForFile, type FileOrganizeRow, type OrganizePlanItem } from "./plan.js";
import {
  resolveNfoAbsBesideVideo,
  resolveStoredTargetAbs,
  expandLibraryTargetRel,
} from "./libraryPaths.js";
import { normalizeLibraryRelativePath } from "../security/pathPolicy.js";
import { copySubtitlesBesideVideo, findSubtitlesForCode } from "./subtitles.js";
import { cleanupSourceDirectory } from "./cleanup.js";
import {
  isLibraryOrganizedImage,
  isUsableCoverImage,
  purgeCoverCacheAfterOrganize,
  resolveOrganizeCoverSource,
  sanitizeCoverSourceForPoster,
  shouldPurgeCoverCacheAfterOrganize,
} from "./coverCache.js";
import type { OrganizeConfig, ResolvedKind } from "../types.js";
import type { ScrapeMeta } from "../scrape/types.js";
import { getPipeline } from "../scrape/pipelineProgress.js";
import {
  appendOrganizeDir,
  appendOrganizeNfo,
  appendOrganizePoster,
  appendOrganizeTransfer,
  appendPipelineFailure,
  appendSubtitleSearch,
  PIPELINE_STEPS,
  skipOrganizeTransferSteps,
  ensureOrganizePipelineSteps,
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

function pipelineTargetDisplay(targetRel: string, libraryRoot?: string): string {
  return expandLibraryTargetRel(targetRel, libraryRoot);
}

function buildNfoOpts(
  kindId: KindId,
  scrapeCfg: ReturnType<typeof loadScrapeConfig>,
  jobOptions?: JobOptions,
) {
  const kindPrefs = resolveKindScrapePrefs(kindId, scrapeCfg);
  const useGlobalNfo = jobOptions?.useGlobal?.nfo !== false;
  const jobNfo = jobOptions?.nfo;
  const nfoMerge =
    (!useGlobalNfo &&
      (jobNfo?.mergeStrategy === "prefer_nfo" || jobNfo?.mergeStrategy === "prefer_scraped") &&
      jobNfo.mergeStrategy) ||
    kindPrefs.nfo.mergeStrategy;
  return {
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
            tagExtras: {
              ...kindPrefs.nfo.tagExtras,
              ...(jobNfo.tagExtras as typeof kindPrefs.nfo.tagExtras),
            },
            tagFormats: {
              ...kindPrefs.nfo.tagFormats,
              ...(jobNfo.tagFormats as typeof kindPrefs.nfo.tagFormats),
            },
            tagline: typeof jobNfo.tagline === "string" ? jobNfo.tagline : kindPrefs.nfo.tagline,
            mergeStrategy: nfoMerge,
          }
        : kindPrefs.nfo,
  };
}

function applyTargetPathToPlan(
  plan: OrganizePlanItem,
  targetPath: string,
  meta: ScrapeMeta,
  kind: ResolvedKind,
  organize: OrganizeConfig,
  scrapeCfg: ReturnType<typeof loadScrapeConfig>,
): OrganizePlanItem {
  const videoAbs = resolveStoredTargetAbs(kind, targetPath);
  const nfoAbs = resolveNfoAbsBesideVideo(videoAbs, organize.metadataDir, PROJECT_ROOT);
  const { posterAbs, coverSource } = resolvePosterBesideVideo(videoAbs, meta, kind, scrapeCfg);
  return {
    ...plan,
    targetAbs: videoAbs,
    targetRel: normalizeLibraryRelativePath(targetPath, kind.libraryAbs, PROJECT_ROOT),
    nfoAbs,
    posterAbs: posterAbs ?? plan.posterAbs,
    coverSource: sanitizeCoverSourceForPoster(coverSource ?? plan.coverSource),
  };
}

function resolvePosterBesideVideo(
  videoAbs: string,
  meta: ScrapeMeta,
  kind: ResolvedKind,
  scrapeCfg: ReturnType<typeof loadScrapeConfig>,
): { posterAbs: string | null; coverSource: string | null } {
  const metaDir = path.dirname(videoAbs);
  const fileName = path.basename(videoAbs);
  const imageNameMode = scrapeCfg.naming.imageNameMode || "none";
  const videoStem = path.parse(fileName).name;
  const posterFileName =
    imageNameMode === "none" ? "poster.jpg" : `${videoStem}-poster.jpg`;
  const posterAbsCandidate = path.join(metaDir, posterFileName);
  const coverSource = resolveOrganizeCoverSource({
    meta,
    projectRoot: PROJECT_ROOT,
    posterAbsCandidate,
  });
  const wantsPoster = Boolean(coverSource || meta.coverUrl);
  return {
    posterAbs: wantsPoster ? posterAbsCandidate : null,
    coverSource,
  };
}

function resolveWatermark(
  kindId: KindId,
  scrapeCfg: ReturnType<typeof loadScrapeConfig>,
  jobOptions?: JobOptions,
) {
  const kindPrefs = resolveKindScrapePrefs(kindId, scrapeCfg);
  const useGlobalWm = jobOptions?.useGlobal?.watermark !== false;
  const jobWm = jobOptions?.watermark;
  return (
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
}

async function writeLibraryImagesForPlan(opts: {
  plan: OrganizePlanItem;
  meta: ScrapeMeta;
  kindId: KindId;
  organize: OrganizeConfig;
  download: ReturnType<typeof resolveEffectiveDownload>;
  scrapeCfg: ReturnType<typeof loadScrapeConfig>;
  jobOptions?: JobOptions;
  fileId?: number;
  hasSubtitle?: boolean;
  dryRun?: boolean;
  signal?: AbortSignal;
}): Promise<ScrapeMeta> {
  const { plan, download, organize, scrapeCfg, kindId } = opts;
  let meta = opts.meta;
  if (!plan.posterAbs) return meta;
  if (!download.downloadPoster && !download.downloadThumb) return meta;
  const thumbDownloadUrl = resolveThumbDownloadUrl(meta);
  if (download.downloadPoster && !(plan.coverSource || meta.coverUrl)) return meta;
  if (download.downloadThumb && !thumbDownloadUrl && !(plan.coverSource || meta.coverUrl)) {
    return meta;
  }

  const watermark = resolveWatermark(kindId, scrapeCfg, opts.jobOptions);
  let coverSource = sanitizeCoverSourceForPoster(plan.coverSource);
  if (
    coverSource &&
    plan.posterAbs &&
    isLibraryOrganizedImage(coverSource, plan.posterAbs)
  ) {
    coverSource = null;
  }
  if (
    !coverSource &&
    meta.coverUrl &&
    download.downloadPoster
  ) {
    const local = await downloadCover(plan.code, plan.kind, meta.coverUrl, {
      signal: opts.signal,
      sourceId: meta.source,
      pageUrl: meta.website || undefined,
    });
    if (local) coverSource = resolveFromRoot(local);
  }
  if (download.downloadPoster && !coverSource) return meta;

  const hasSubtitle = opts.hasSubtitle ?? plan.hasSubtitle;
  const pipelineActive = opts.fileId != null && Boolean(getPipeline(opts.fileId)?.active);
  let posterRel: string | null = null;
  let thumbRel: string | null = null;
  const thumbAbs = path.join(path.dirname(plan.posterAbs), "thumb.jpg");
  const posterOpts = {
    cropMode: plan.posterCrop || "none",
    cropRatio: download.cropRatio,
    cropIndependentPoster: download.cropIndependentPoster,
    preferCropResult: download.preferCropResult,
    watermark,
    mosaic: plan.mosaic || meta.mosaic,
    hasSubtitle,
    resolution: plan.resolution,
    overwriteImages: organize.overwriteImages,
    dryRun: opts.dryRun,
  } as const;

  const downloadFreshCover = async (): Promise<string | null> => {
    if (!meta.coverUrl) return null;
    const local = await downloadCover(plan.code, plan.kind, meta.coverUrl, {
      signal: opts.signal,
      sourceId: meta.source,
      pageUrl: meta.website || undefined,
      force: true,
    });
    return local ? resolveFromRoot(local) : null;
  };

  const downloadThumbCoverSource = async (force?: boolean): Promise<string | null> => {
    const url = thumbDownloadUrl || resolveThumbDownloadUrl(meta);
    if (!url) return null;
    const local = await downloadCover(plan.code, plan.kind, url, {
      signal: opts.signal,
      sourceId: meta.source,
      pageUrl: meta.website || undefined,
      force,
      cacheSlot: "thumb",
    });
    return local ? resolveFromRoot(local) : null;
  };

  const thumbOpts = {
    watermark,
    mosaic: plan.mosaic || meta.mosaic,
    hasSubtitle,
    resolution: plan.resolution,
    overwriteImages: organize.overwriteImages,
    dryRun: opts.dryRun,
  } as const;

  const writePoster = async (source: string): Promise<boolean> => {
    try {
      return await processPosterImage(source, plan.posterAbs!, {
        ...posterOpts,
        imageKind: "poster",
      });
    } catch {
      if (organize.overwriteImages !== false || !fs.existsSync(plan.posterAbs!)) {
        return copySidecar(source, plan.posterAbs, opts.dryRun);
      }
      return false;
    }
  };

  if (download.downloadPoster && coverSource) {
    let wrote = await writePoster(coverSource);
    const posterOk = (p: string) => isUsableCoverImage(p);
    if (!wrote || !posterOk(plan.posterAbs)) {
      const fresh = await downloadFreshCover();
      if (fresh) {
        coverSource = fresh;
        wrote = await writePoster(fresh);
      }
    }
    if (wrote && posterOk(plan.posterAbs)) {
      posterRel = toPosixRelative(plan.posterAbs);
    }
  }

  if (download.downloadThumb) {
    try {
      let thumbSource = await downloadThumbCoverSource();
      if (!thumbSource) thumbSource = await downloadThumbCoverSource(true);
      if (thumbSource) {
        let wrote = await processThumbImage(thumbSource, thumbAbs, thumbOpts);
        if (!wrote || !(await isLandscapeImageFile(thumbAbs))) {
          const fresh = await downloadThumbCoverSource(true);
          if (fresh) {
            wrote = await processThumbImage(fresh, thumbAbs, thumbOpts);
          }
        }
        if (
          !wrote &&
          (organize.overwriteImages !== false || !fs.existsSync(thumbAbs)) &&
          (await isLandscapeImageFile(thumbSource))
        ) {
          copySidecar(thumbSource, thumbAbs, opts.dryRun);
        }
      }
    } catch {
      const thumbSource = await downloadThumbCoverSource(true);
      if (
        thumbSource &&
        (organize.overwriteImages !== false || !fs.existsSync(thumbAbs)) &&
        (await isLandscapeImageFile(thumbSource))
      ) {
        copySidecar(thumbSource, thumbAbs, opts.dryRun);
      }
    }
    if (isUsableCoverImage(thumbAbs) && (await isLandscapeImageFile(thumbAbs))) {
      thumbRel = toPosixRelative(thumbAbs);
    }
  }

  if (pipelineActive && opts.fileId != null && (posterRel || thumbRel)) {
    appendOrganizePoster(opts.fileId, posterRel, thumbRel);
  }

  return meta;
}

export function listOrganizableFiles(kind: KindId): FileOrganizeRow[] {
  const db = openDatabase();
  return db
    .prepare(
      `SELECT id, kind, source_path, file_name, code, mosaic, status FROM files
       WHERE kind = ? AND code IS NOT NULL
         AND status IN ('scraped', 'planned', 'failed')
       ORDER BY ${FILE_ORGANIZE_QUEUE_ORDER_SQL}`,
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
  if (kind.organizeMode !== "inplace" && !kind.libraryAbs) {
    return failOrganizeCandidates(kindId, opts, "未配置片库路径，无法整理");
  }

  const idFilter = opts.fileIds?.length ? new Set(opts.fileIds) : null;
  const plans = planOrganizeForKind(kindId, { jobOptions: opts.jobOptions }).filter(
    (p) => !idFilter || idFilter.has(p.fileId),
  );
  let organized = 0;
  let failed = 0;
  let skipped = 0;
  const organize = resolveOrganizeForKind(kindId, config);
  const kindPrefs = resolveKindScrapePrefs(kindId, scrapeCfg);
  const download = resolveEffectiveDownload(kindId, scrapeCfg, opts.jobOptions);
  const jobId = opts.jobId?.trim() || null;

  const touchFile = (id: number) => {
    notifyFileChanges(id, { kind: kindId, jobId: jobId ?? undefined, reason: "organize" });
  };

  const update = db.prepare(`
    UPDATE files SET status = @status, target_path = @target_path, error = @error,
      organized_at = @organized_at, job_id = COALESCE(@job_id, job_id)
    WHERE id = @id
  `);

  const candidateRows = listOrganizableFiles(kindId).filter(
    (row) => !idFilter || idFilter.has(row.id),
  );
  const plannedIds = new Set(plans.map((p) => p.fileId));
  for (const row of candidateRows) {
    if (plannedIds.has(row.id)) continue;
    failed += 1;
    update.run({
      id: row.id,
      status: "failed",
      target_path: null,
      error: "无法生成整理计划（检查片库路径/命名模板）",
      organized_at: null,
      job_id: jobId,
    });
    touchFile(row.id);
  }

  const nfoOpts = buildNfoOpts(kindId, scrapeCfg, opts.jobOptions);

  const subPath = download.subtitleLibraryPath.trim();
  const subtitleAbs = subPath
    ? path.isAbsolute(subPath)
      ? subPath
      : resolveFromRoot(subPath, PROJECT_ROOT)
    : "";

  for (const plan of plans) {
    if (opts.signal?.aborted) break;
    opts.onProgress?.(`整理 ${plan.code} → ${plan.targetRel}`);

    const pipelineActive = Boolean(getPipeline(plan.fileId)?.active);

    if (pipelineActive) {
      ensureOrganizePipelineSteps(plan.fileId);
    }

    update.run({
      id: plan.fileId,
      status: "organizing",
      target_path: plan.targetRel,
      error: null,
      organized_at: null,
      job_id: jobId,
    });
    touchFile(plan.fileId);

    if (pipelineActive && plan.targetRel) {
      if (subtitleAbs) {
        const foundSubs = findSubtitlesForCode(subtitleAbs, plan.code);
        appendSubtitleSearch(plan.fileId, plan.code, foundSubs.length, true);
      } else {
        appendSubtitleSearch(plan.fileId, plan.code, 0, false);
      }
      appendOrganizeDir(plan.fileId, pipelineTargetDisplay(plan.targetRel, kind.libraryRoot));
    }

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
      touchFile(plan.fileId);
      continue;
    }

    if (transfer.action === "skip" && transfer.message?.includes("已跳过")) {
      skipped += 1;
    }

    let hasSubtitle = plan.hasSubtitle;
    if (subtitleAbs) {
      const addChs =
        Boolean(download.subtitleAddChsSuffix) ||
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

    if (meta) {
      meta = await writeLibraryImagesForPlan({
        plan,
        meta,
        kindId,
        organize,
        download,
        scrapeCfg,
        jobOptions: opts.jobOptions,
        fileId: plan.fileId,
        hasSubtitle,
        dryRun: opts.dryRun,
        signal: opts.signal,
      });
    }

    if (pipelineActive && plan.targetRel) {
      appendOrganizeTransfer(
        plan.fileId,
        pipelineTargetDisplay(plan.targetRel, kind.libraryRoot),
        plan.mode,
      );
    }

    if (meta) {
      try {
        const thumbAbsForNfo =
          download.downloadThumb && plan.posterAbs
            ? path.join(path.dirname(plan.posterAbs), "thumb.jpg")
            : null;
        const posterAbsForNfo = download.downloadPoster ? plan.posterAbs : null;
        if (
          download.downloadFanart &&
          meta.extrafanartUrls?.length &&
          plan.posterAbs
        ) {
          const saved = await downloadExtrafanartToDir(path.dirname(plan.posterAbs), meta.extrafanartUrls, {
            referer: meta.website,
            sourceId: meta.fieldSources?.extrafanart || meta.source,
            force: organize.overwriteImages !== false,
            dryRun: opts.dryRun,
          });
          if (saved.length && meta) {
            meta = { ...meta, extrafanartLocal: saved };
            await withPersistLock(() => writeScrapeCache(meta!));
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
              posterAbs: posterAbsForNfo,
              thumbAbs: thumbAbsForNfo,
              cdPart: plan.part ? `CD${plan.part}` : undefined,
            }),
          },
          opts.dryRun,
        );
        if (pipelineActive) {
          appendOrganizeNfo(
            plan.fileId,
            pipelineTargetDisplay(plan.targetRel, kind.libraryRoot),
            meta.fieldSources ?? {},
            plan.nfoAbs,
          );
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
        touchFile(plan.fileId);
        continue;
      }
    }

    if (organize.cleanup.enabled && !opts.dryRun) {
      cleanupSourceDirectory(path.dirname(plan.sourceAbs), organize);
    }

    if (
      !opts.dryRun &&
      organize.purgeCoverCacheAfterDone !== false &&
      meta &&
      shouldPurgeCoverCacheAfterOrganize(plan.posterAbs, meta)
    ) {
      meta = purgeCoverCacheAfterOrganize(plan.code, plan.kind, meta);
    }

    organized += 1;
    const finalTargetRel =
      transfer.targetAbs === plan.targetAbs
        ? plan.targetRel
        : toLibraryRelativePath(transfer.targetAbs, kind.libraryAbs) || plan.targetRel;
    update.run({
      id: plan.fileId,
      status: opts.dryRun ? "scraped" : "done",
      target_path: finalTargetRel || null,
      error: null,
      organized_at: opts.dryRun ? null : Date.now(),
      job_id: jobId,
    });
    touchFile(plan.fileId);
  }

  for (const plan of plans) releaseStuckInflightFileState(plan.fileId);

  return {
    kind: kindId,
    total: candidateRows.length,
    organized,
    failed,
    skipped,
    plans,
  };
}

function failOrganizeCandidates(
  kindId: KindId,
  opts: { fileIds?: number[]; jobId?: string; jobOptions?: JobOptions },
  message: string,
): OrganizeRunResult {
  const db = openDatabase();
  const idFilter = opts.fileIds?.length ? new Set(opts.fileIds) : null;
  const rows = listOrganizableFiles(kindId).filter((row) => !idFilter || idFilter.has(row.id));
  const jobId = opts.jobId?.trim() || null;
  const update = db.prepare(`
    UPDATE files SET status = 'failed', target_path = NULL, error = ?, organized_at = NULL,
      job_id = COALESCE(?, job_id)
    WHERE id = ?
  `);
  for (const row of rows) {
    update.run(message, jobId, row.id);
    notifyFileChanges(row.id, { kind: kindId, jobId: jobId ?? undefined, reason: "organize" });
  }
  return {
    kind: kindId,
    total: rows.length,
    organized: 0,
    failed: rows.length,
    skipped: 0,
    plans: [],
  };
}

/** 刮削成功后仅写 NFO 并标 done（详情页「重试刮削」；不转移/建目录） */
export async function completeScrapeWithNfo(
  fileId: number,
  opts: {
    jobId?: string;
    jobOptions?: JobOptions;
    dryRun?: boolean;
    signal?: AbortSignal;
  } = {},
): Promise<{ ok: boolean; failed: boolean; message?: string }> {
  const db = openDatabase();
  const row = db
    .prepare(
      `SELECT id, kind, source_path, file_name, code, mosaic, status, target_path
       FROM files WHERE id = ?`,
    )
    .get(fileId) as
    | {
        id: number;
        kind: KindId;
        source_path: string;
        file_name: string;
        code: string | null;
        mosaic: string | null;
        status: string;
        target_path: string | null;
      }
    | undefined;
  if (!row) return { ok: false, failed: true, message: "文件不存在" };
  if (!row.code) {
    const message = "无番号，无法生成 NFO";
    db.prepare(`UPDATE files SET status = 'failed', error = ? WHERE id = ?`).run(message, fileId);
    notifyFileChanges(fileId, { kind: row.kind, reason: "organize" });
    return { ok: false, failed: true, message };
  }

  const meta = readScrapeCache(row.code, row.kind);
  if (!meta?.ok) {
    const message = "刮削未成功，无法生成 NFO";
    db.prepare(`UPDATE files SET status = 'failed', error = ? WHERE id = ?`).run(message, fileId);
    notifyFileChanges(fileId, { kind: row.kind, reason: "organize" });
    return { ok: false, failed: true, message };
  }

  const config = loadLibrariesConfig();
  const kind = resolveKind(row.kind, config);
  if (!kind) {
    const message = "分区配置无效";
    db.prepare(`UPDATE files SET status = 'failed', error = ? WHERE id = ?`).run(message, fileId);
    notifyFileChanges(fileId, { kind: row.kind, reason: "organize" });
    return { ok: false, failed: true, message };
  }

  const organize = resolveOrganizeForKind(row.kind, config);
  const scrapeCfg = loadScrapeConfig();
  const download = resolveEffectiveDownload(row.kind, scrapeCfg, opts.jobOptions);
  const jobId = opts.jobId?.trim() || null;
  const fileRow: FileOrganizeRow = {
    id: row.id,
    kind: row.kind,
    source_path: row.source_path,
    file_name: row.file_name,
    code: row.code,
    mosaic: row.mosaic,
    status: row.status,
  };

  let plan = buildPlanForFile(fileRow, kind, {
    projectRoot: PROJECT_ROOT,
    onConflict: organize.onConflict,
    organize,
    jobOptions: opts.jobOptions,
  });

  const targetPath = row.target_path?.trim();
  if (targetPath) {
    const videoAbs = resolveStoredTargetAbs(kind, targetPath);
    if (plan) {
      plan = applyTargetPathToPlan(plan, targetPath, meta, kind, organize, scrapeCfg);
    } else {
      const { posterAbs, coverSource } = resolvePosterBesideVideo(videoAbs, meta, kind, scrapeCfg);
      plan = {
        fileId: row.id,
        kind: row.kind,
        code: row.code,
        sourceAbs: resolveFromRoot(row.source_path, PROJECT_ROOT),
        sourceRel: row.source_path,
        targetAbs: videoAbs,
        targetRel: normalizeLibraryRelativePath(targetPath, kind.libraryAbs, PROJECT_ROOT),
        nfoAbs: resolveNfoAbsBesideVideo(videoAbs, organize.metadataDir, PROJECT_ROOT),
        posterAbs,
        coverSource,
        mode: kind.organizeMode,
        fallback: kind.organizeFallback,
        onConflict: organize.onConflict,
        mosaic: row.mosaic || meta.mosaic || "",
        title: meta.title || row.code,
        mediaTitle: meta.title || row.code,
        posterCrop: "right",
        hasSubtitle: false,
        resolution: "",
      };
    }
  } else if (plan && !plan.posterAbs && meta.coverUrl) {
    const { posterAbs, coverSource } = resolvePosterBesideVideo(plan.targetAbs, meta, kind, scrapeCfg);
    plan = { ...plan, posterAbs, coverSource };
  }

  if (!plan) {
    const message = "无目标路径，请先执行「重新整理」";
    db.prepare(`UPDATE files SET status = 'failed', error = ? WHERE id = ?`).run(message, fileId);
    return { ok: false, failed: true, message };
  }

  const pipelineActive = Boolean(getPipeline(fileId)?.active);
  if (pipelineActive) {
    skipOrganizeTransferSteps(fileId);
  }

  const nfoOpts = buildNfoOpts(row.kind, scrapeCfg, opts.jobOptions);
  if (!nfoOpts.nfo.enabled) {
    const message = "NFO 写入已禁用";
    db.prepare(`UPDATE files SET status = 'failed', error = ? WHERE id = ?`).run(message, fileId);
    return { ok: false, failed: true, message };
  }

  try {
    let workingMeta = meta;
    workingMeta = await writeLibraryImagesForPlan({
      plan,
      meta: workingMeta,
      kindId: row.kind,
      organize,
      download,
      scrapeCfg,
      jobOptions: opts.jobOptions,
      fileId,
      dryRun: opts.dryRun,
      signal: opts.signal,
    });

    if (
      download.downloadFanart &&
      workingMeta.extrafanartUrls?.length &&
      plan.posterAbs
    ) {
      const saved = await downloadExtrafanartToDir(path.dirname(plan.posterAbs), workingMeta.extrafanartUrls, {
        referer: workingMeta.website,
        sourceId: workingMeta.fieldSources?.extrafanart || workingMeta.source,
        force: organize.overwriteImages !== false,
        dryRun: opts.dryRun,
      });
      if (saved.length) {
        workingMeta = { ...workingMeta, extrafanartLocal: saved };
        await withPersistLock(() => writeScrapeCache(workingMeta));
      }
    }

    const thumbAbsForNfo =
      download.downloadThumb && plan.posterAbs
        ? path.join(path.dirname(plan.posterAbs), "thumb.jpg")
        : null;
    const posterAbsForNfo =
      download.downloadPoster && plan.posterAbs && fs.existsSync(plan.posterAbs)
        ? plan.posterAbs
        : null;
    writeMovieNfo(
      plan.nfoAbs,
      workingMeta,
      {
        ...nfoOpts,
        mediaTitle: plan.mediaTitle,
        ctx: buildNfoWriteContext({
          meta: workingMeta,
          mediaTitle: plan.mediaTitle,
          hasSubtitle: plan.hasSubtitle,
          resolution: plan.resolution || undefined,
          mosaic: plan.mosaic || workingMeta.mosaic || undefined,
          posterAbs: posterAbsForNfo,
          thumbAbs: thumbAbsForNfo && fs.existsSync(thumbAbsForNfo) ? thumbAbsForNfo : null,
          cdPart: plan.part ? `CD${plan.part}` : undefined,
        }),
      },
      opts.dryRun,
    );
    if (!opts.dryRun && !fs.existsSync(plan.nfoAbs)) {
      throw new Error(`NFO 未写入磁盘：${plan.nfoAbs}`);
    }
    if (pipelineActive) {
      appendOrganizeNfo(
        fileId,
        pipelineTargetDisplay(plan.targetRel, kind.libraryRoot),
        workingMeta.fieldSources ?? {},
        plan.nfoAbs,
      );
    }
    if (!opts.dryRun) {
      db.prepare(
        `UPDATE files SET status = 'done', error = NULL, scraped_at = COALESCE(scraped_at, ?),
           organized_at = ?, target_path = COALESCE(target_path, ?),
           job_id = COALESCE(?, job_id)
         WHERE id = ?`,
      ).run(Date.now(), Date.now(), plan.targetRel, jobId, fileId);
      notifyFileChanges(fileId, { kind: row.kind, jobId: jobId ?? undefined, reason: "organize" });
    }
    return { ok: true, failed: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (pipelineActive) {
      appendPipelineFailure(fileId, PIPELINE_STEPS.nfo, { tone: "fail", text: message });
    }
    db.prepare(`UPDATE files SET status = 'failed', error = ? WHERE id = ?`).run(message, fileId);
    notifyFileChanges(fileId, { kind: row.kind, jobId: jobId ?? undefined, reason: "organize" });
    return { ok: false, failed: true, message };
  } finally {
    releaseInflightFileState(fileId);
  }
}

/** 刮削成功后立即整理；未整理则标 failed（全流程须 done 或 failed） */
export async function organizeScrapedFileOrFail(
  fileId: number,
  opts: {
    jobId?: string;
    jobOptions?: JobOptions;
    dryRun?: boolean;
    signal?: AbortSignal;
  } = {},
): Promise<{ organized: boolean; failed: boolean }> {
  const db = openDatabase();
  const row = db
    .prepare(`SELECT id, kind, status FROM files WHERE id = ?`)
    .get(fileId) as { id: number; kind: KindId; status: string } | undefined;
  if (!row) return { organized: false, failed: true };
  if (row.status === "done") return { organized: true, failed: false };
  if (row.status !== "scraped") return { organized: false, failed: false };

  const org = await runOrganizeForKind(row.kind, {
    fileIds: [fileId],
    jobId: opts.jobId,
    jobOptions: opts.jobOptions,
    dryRun: opts.dryRun,
    signal: opts.signal,
  });
  if (org.organized > 0) return { organized: true, failed: false };
  if (org.failed > 0) return { organized: false, failed: true };

  const message = "整理未执行（检查片库路径/命名模板/整理模式）";
  db.prepare(
    `UPDATE files SET status = 'failed', error = ?, organized_at = NULL WHERE id = ?`,
  ).run(message, fileId);
  notifyFileChanges(fileId, { kind: row.kind, jobId: opts.jobId, reason: "organize" });
  return { organized: false, failed: true };
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
    ensureOrganizePipelineSteps(fileId);
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
