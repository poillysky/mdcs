import {
  getKindScrapeProfile,
  loadScrapeConfig,
  resolveEffectiveDownload,
  resolveKindScrapePrefs,
} from "../config/loadScrape.js";
import { resolveOrganizeForKind } from "../config/loadConfig.js";
import { openDatabase } from "../db/init.js";
import { withPersistLock } from "../db/persistLock.js";
import { notifyFileChanges } from "../files/events.js";
import type { JobOptions } from "../jobs/options.js";
import { normalizeRelativePath } from "../security/pathPolicy.js";
import { releaseInflightFileState, releaseJobInflightFiles, releaseStuckInflightFileState } from "../jobs/jobFiles.js";
import { buildScrapeQueueOrderClause } from "../files/pipelineState.js";
import { loadJobOptions } from "../jobs/jobOptionsStore.js";
import { deleteMetadataOnScrapeFail, resolveOrganizeForScrapeFail } from "../organize/deleteMetaOnFail.js";
import { downloadCover, pickLargestCoverUrl, writeScrapeCache } from "./cache.js";
import { attachSourceSnapshots } from "./sourceSnapshots.js";
import { pickCoverUrlForDownload, orderCoverDownloadCandidates, type DownloadPrefs } from "./downloadPrefs.js";
import { enhanceCoverWithHdPosters } from "./hdPoster.js";
import { applyMetadataPrefs } from "./metadataPrefs.js";
import { collectScrapeSourceIds } from "./merge.js";
import {
  appendCoverDownload,
  appendPipelineFailure,
  appendSourceRunItem,
  appendScrapeCacheHitLog,
  finishScrapeStep,
  PIPELINE_STEPS,
  ensureOrganizePipelineSteps,
  startParseStep,
  startScrapeStep,
} from "./pipelineLogHelpers.js";
import {
  beginPipeline,
  endPipeline,
  getPipeline,
  getPipelineHistory,
  markPipelineStepDone,
} from "./pipelineProgress.js";
import { scrapeCodeDetailed } from "./orchestrator.js";
import { runPool } from "./pool.js";
import { getProbeCooldownIds } from "./probe.js";
import type { ProviderResult, ScrapeMeta, SourceId } from "./types.js";
import type { KindId } from "../types.js";

export type ScrapeRunResult = {
  kind: KindId;
  total: number;
  scraped: number;
  failed: number;
  skipped: number;
};

type ScrapeProgress = (text: string) => void;

type FileRow = { id: number; code: string; kind: KindId; mosaic?: string; source_path?: string };

function scanPathClause(jobOptions?: JobOptions): { sql: string; params: string[] } {
  const raw = jobOptions?.scanPath?.trim();
  if (!raw) return { sql: "", params: [] };
  const rel = normalizeRelativePath(raw);
  return {
    sql: ` AND (source_path = ? OR source_path LIKE ?)`,
    params: [rel, `${rel}/%`],
  };
}

function mergeScrapeResult(into: Map<KindId, ScrapeRunResult>, r: ScrapeRunResult): void {
  const prev = into.get(r.kind);
  if (!prev) {
    into.set(r.kind, { ...r });
    return;
  }
  into.set(r.kind, {
    kind: r.kind,
    total: prev.total + r.total,
    scraped: prev.scraped + r.scraped,
    failed: prev.failed + r.failed,
    skipped: prev.skipped + r.skipped,
  });
}

function batchPipelineKind(fileId: number): "initial" | "rescrape" {
  const history = getPipelineHistory(fileId);
  return history.some((r) => r.kind === "initial") ? "rescrape" : "initial";
}

function beginBatchFilePipeline(
  row: FileRow,
  cfg: ReturnType<typeof loadScrapeConfig>,
  metaSourcesOverride?: SourceId[],
): void {
  if (getPipeline(row.id)?.active) return;
  beginPipeline(row.id, "rescrape", batchPipelineKind(row.id));
  startParseStep(row.id, row.source_path || "", row.code, row.kind);
  const profile = getKindScrapeProfile(row.kind);
  const disabled = new Set(cfg.disabledProviders ?? []);
  for (const id of getProbeCooldownIds()) disabled.add(id);
  const override = metaSourcesOverride?.length ? metaSourcesOverride : undefined;
  const kindFieldPriority =
    profile.useGlobal?.sources === false ? profile.fieldPriority : undefined;
  const plannedSources = collectScrapeSourceIds(
    cfg.fieldPriority,
    kindFieldPriority,
    override ?? profile.metaSources,
    override ?? profile.coverSources,
  ).filter((id) => !disabled.has(id));
  startScrapeStep(row.id, plannedSources);
}

function endBatchFilePipeline(fileId: number, meta?: ScrapeMeta): void {
  if (!getPipeline(fileId)?.active) return;
  if (meta) finishScrapeStep(fileId, meta);
  endPipeline(fileId);
}

function resolveDownloadPrefs(
  cfg: ReturnType<typeof loadScrapeConfig>,
  kind: KindId,
  jobOptions?: JobOptions,
): DownloadPrefs {
  const dl = resolveEffectiveDownload(kind, cfg, jobOptions);
  return {
    downloadPoster: dl.downloadPoster,
    downloadThumb: dl.downloadThumb,
    preferHighResPoster: dl.preferHighResPoster,
    skipAmazon: dl.skipAmazon,
    amazonHdPoster: dl.amazonHdPoster,
    tenhowHdPoster: dl.tenhowHdPoster,
    amazonStrictMode: dl.amazonStrictMode,
  };
}

export async function runScrapeForKind(
  kind: KindId,
  opts: {
    signal?: AbortSignal;
    onProgress?: ScrapeProgress;
    force?: boolean;
    jobId?: string;
    jobOptions?: JobOptions;
    /** 每轮最多处理条数；用于与扫描并行时的增量刮削 */
    batchLimit?: number;
    /** full 模式：刮削成功后立即整理，终态仅 done / failed */
    chainOrganize?: boolean;
    dryRun?: boolean;
  } = {},
): Promise<ScrapeRunResult> {
  const db = openDatabase();
  const cfg = loadScrapeConfig();
  const kindPrefs = resolveKindScrapePrefs(kind, cfg);
  const downloadPrefs = resolveDownloadPrefs(cfg, kind, opts.jobOptions);
  const useGlobalSources = opts.jobOptions?.useGlobal?.sources !== false;
  const metaSourcesOverride =
    !useGlobalSources && opts.jobOptions?.sources?.metaSources?.length
      ? (opts.jobOptions.sources.metaSources as SourceId[])
      : undefined;
  const useGlobalMeta = opts.jobOptions?.useGlobal?.metadata !== false;
  const metadataPrefs = {
    ...kindPrefs.metadata,
    ...(useGlobalMeta
      ? {}
      : {
          strictMode: opts.jobOptions?.metadata?.strictMode ?? kindPrefs.metadata.strictMode,
          autoTranslateTitle:
            opts.jobOptions?.metadata?.autoTranslate ?? kindPrefs.metadata.autoTranslateTitle,
        }),
  };
  const concurrency = Math.max(1, cfg.exportFastConcurrency || 4);
  const jobId = opts.jobId?.trim() || null;

  const scopedIds = Array.isArray(opts.jobOptions?.fileIds)
    ? [...opts.jobOptions.fileIds]
        .filter((id): id is number => Number.isFinite(id))
        .sort((a, b) => a - b)
    : [];
  const pathFilter = scanPathClause(opts.jobOptions);
  const batchLimit = Math.max(0, opts.batchLimit ?? 0);
  const priorityIds = opts.jobOptions?.priorityFileIds ?? [];
  const queueOrder = buildScrapeQueueOrderClause(priorityIds);
  const forceScrapeIds = new Set(opts.jobOptions?.forceScrapeFileIds ?? []);
  const forceScrape = Boolean(opts.force) || forceScrapeIds.size > 0;

  const rows = scopedIds.length
    ? (db
        .prepare(
          `SELECT id, code, kind, mosaic, source_path FROM files
           WHERE kind = ? AND code IS NOT NULL
             AND status IN ('pending', 'indexed', 'failed', 'scraping')
             AND id IN (${scopedIds.map(() => "?").join(",")})
           ORDER BY ${queueOrder.sql}${batchLimit > 0 ? ` LIMIT ${batchLimit}` : ""}`,
        )
        .all(kind, ...scopedIds, ...queueOrder.params) as FileRow[])
    : (db
        .prepare(
          `SELECT id, code, kind, mosaic, source_path FROM files
           WHERE kind = ? AND code IS NOT NULL
             AND status IN ('pending', 'indexed', 'failed', 'scraping')${pathFilter.sql}
           ORDER BY ${queueOrder.sql}${batchLimit > 0 ? ` LIMIT ${batchLimit}` : ""}`,
        )
        .all(kind, ...pathFilter.params, ...queueOrder.params) as FileRow[]);

  const codeCache = new Map<string, ScrapeMeta>();
  let scraped = 0;
  let failed = 0;
  let skipped = 0;

  const updateStatus = db.prepare(`
    UPDATE files SET status = @status, error = @error, scraped_at = @scraped_at,
      job_id = COALESCE(@job_id, job_id)
    WHERE id = @id
  `);

  function touchFile(id: number) {
    notifyFileChanges(id, { kind, jobId: jobId ?? undefined, reason: "scrape" });
  }

  async function maybeDownloadCover(
    row: FileRow,
    meta: ScrapeMeta,
    bySource?: Map<SourceId, ProviderResult>,
  ): Promise<ScrapeMeta> {
    const covers = bySource
      ? [
          ...new Set(
            [...bySource.values()].flatMap((r: ProviderResult) => [
              r.coverUrl,
              ...(r.alternateCoverUrls || []),
            ]).filter((u): u is string => Boolean(u)),
          ),
        ]
      : meta.coverUrl
        ? [meta.coverUrl]
        : [];
    if (
      !covers.length &&
      !downloadPrefs.amazonHdPoster &&
      !downloadPrefs.tenhowHdPoster
    ) {
      return meta;
    }

    let ordered = orderCoverDownloadCandidates(meta.coverUrl, covers);
    if (cfg.coverDownloadStrategy === "size" && ordered.length > 1) {
      const best = await pickLargestCoverUrl(ordered, opts.signal);
      if (best) {
        ordered = [best, ...ordered.filter((u) => u !== best)];
      }
    }

    const url = pickCoverUrlForDownload(ordered, downloadPrefs);
    if (!url && !downloadPrefs.amazonHdPoster && !downloadPrefs.tenhowHdPoster) return meta;

    const hd = await enhanceCoverWithHdPosters(meta, url, downloadPrefs, {
      signal: opts.signal,
    });
    if (hd.amazonHardFail) {
      return {
        ...meta,
        ok: false,
        message: "Amazon 高清海报获取失败（严格模式已中止）",
      };
    }
    const finalUrl = hd.url;
    if (!finalUrl) return meta;

    const coverSourceId = meta.fieldSources?.cover;
    const tryUrls = [
      ...new Set(
        [finalUrl, url, ...ordered.filter((u) => u !== finalUrl && u !== url)].filter(
          (u): u is string => Boolean(u),
        ),
      ),
    ];
    let local: string | null = null;
    let usedUrl = finalUrl;
    for (const candidate of tryUrls) {
      local = await downloadCover(row.code, row.kind, candidate, {
        signal: opts.signal,
        force: opts.force,
        sourceId: coverSourceId,
        pageUrl: meta.website || undefined,
      });
      if (local) {
        usedUrl = candidate;
        break;
      }
    }
    if (!local && !meta.coverLocal) return { ...meta, coverUrl: finalUrl };
    const next = { ...meta, coverUrl: usedUrl, coverLocal: local ?? meta.coverLocal };
    if (next.ok) {
      await withPersistLock(() => writeScrapeCache(next));
    }
    return next;
  }

  async function applyMeta(
    row: FileRow,
    meta: ScrapeMeta,
    bySource?: Map<SourceId, ProviderResult>,
  ) {
    let finalMeta = bySource?.size ? attachSourceSnapshots(meta, bySource) : meta;
    if (row.mosaic && !finalMeta.mosaic) {
      finalMeta = { ...finalMeta, mosaic: row.mosaic };
    }
    finalMeta = await applyMetadataPrefs(finalMeta, metadataPrefs, cfg, {
      signal: opts.signal,
    });
    if (finalMeta.ok) {
      finalMeta = await maybeDownloadCover(row, finalMeta, bySource);
      finalMeta = await applyMetadataPrefs(finalMeta, metadataPrefs, cfg, {
        signal: opts.signal,
      });
    }
    await withPersistLock(async () => {
      if (finalMeta.ok) {
        writeScrapeCache(finalMeta);
        scraped += 1;
        updateStatus.run({
          id: row.id,
          status: "scraped",
          error: null,
          scraped_at: Date.now(),
          job_id: jobId,
        });
        touchFile(row.id);
        if (opts.chainOrganize) {
          const { organizeScrapedFileOrFail } = await import("../organize/runner.js");
          const out = await organizeScrapedFileOrFail(row.id, {
            jobId: jobId ?? undefined,
            jobOptions: opts.jobOptions,
            dryRun: opts.dryRun,
            signal: opts.signal,
          });
          if (out.failed) {
            failed += 1;
            scraped -= 1;
          }
        }
      } else {
        failed += 1;
        updateStatus.run({
          id: row.id,
          status: "failed",
          error: finalMeta.message ?? "刮削失败",
          scraped_at: null,
          job_id: jobId,
        });
        touchFile(row.id);
        try {
          deleteMetadataOnScrapeFail(row.code, kind, resolveOrganizeForScrapeFail(kind, opts.jobOptions));
        } catch {
          /* ignore cleanup errors */
        }
      }
      endBatchFilePipeline(row.id, finalMeta);
      codeCache.set(row.code, finalMeta);
    });
  }

  async function markWorkerFailed(row: FileRow, err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await withPersistLock(async () => {
      failed += 1;
      updateStatus.run({
        id: row.id,
        status: "failed",
        error: message,
        scraped_at: null,
        job_id: jobId,
      });
      touchFile(row.id);
      try {
        deleteMetadataOnScrapeFail(
          row.code,
          kind,
          resolveOrganizeForScrapeFail(kind, opts.jobOptions),
        );
      } catch {
        /* ignore cleanup errors */
      }
      if (getPipeline(row.id)?.active) {
        appendPipelineFailure(row.id, PIPELINE_STEPS.scrape, { tone: "fail", text: message });
        endPipeline(row.id);
      }
    });
  }

  function markScraping(row: FileRow) {
    updateStatus.run({
      id: row.id,
      status: "scraping",
      error: null,
      scraped_at: null,
      job_id: jobId,
    });
    touchFile(row.id);
  }

  await runPool(
    rows,
    concurrency,
    async (row) => {
      if (opts.signal?.aborted) return;
      try {
        markScraping(row);
        beginBatchFilePipeline(row, cfg, metaSourcesOverride);
        opts.onProgress?.(`刮削 ${row.code}`);

        const cached = codeCache.get(row.code);
        if (cached) {
          appendScrapeCacheHitLog(row.id, cached);
          if (opts.signal?.aborted) return;
          await applyMeta(row, cached);
          return;
        }

        const detail = await scrapeCodeDetailed(row.code, row.kind, {
          force: forceScrape || forceScrapeIds.has(row.id),
          signal: opts.signal,
          metaSourcesOverride,
          onSourceComplete: (run) => appendSourceRunItem(row.id, run),
        });
        if (opts.signal?.aborted) return;
        await applyMeta(row, detail.meta, detail.bySource);
      } catch (err) {
        await markWorkerFailed(row, err);
      }
    },
    opts.signal,
  );

  if (opts.signal?.aborted) skipped = rows.length - scraped - failed;

  for (const row of rows) {
    if (opts.signal?.aborted) releaseInflightFileState(row.id);
    else releaseStuckInflightFileState(row.id);
    if (getPipeline(row.id)?.active) endPipeline(row.id);
  }
  if (opts.signal?.aborted && jobId) {
    releaseJobInflightFiles(jobId);
  }

  return {
    kind,
    total: rows.length,
    scraped,
    failed,
    skipped: Math.max(0, skipped),
  };
}

export async function runScrapeForKinds(
  kinds: KindId[],
  opts: {
    signal?: AbortSignal;
    onProgress?: ScrapeProgress;
    force?: boolean;
    jobId?: string;
    jobOptions?: JobOptions;
    chainOrganize?: boolean;
    dryRun?: boolean;
  } = {},
): Promise<ScrapeRunResult[]> {
  const results: ScrapeRunResult[] = [];
  for (const kind of kinds) {
    if (opts.signal?.aborted) break;
    opts.onProgress?.(`开始分区 ${kind}`);
    results.push(await runScrapeForKind(kind, opts));
  }
  return results;
}

/** 扫描进行中周期性拉取已索引文件刮削，扫描结束后排空剩余队列 */
export async function runScrapeDrainForKinds(
  kinds: KindId[],
  opts: {
    signal?: AbortSignal;
    onProgress?: ScrapeProgress;
    force?: boolean;
    jobId?: string;
    jobOptions?: JobOptions;
    chainOrganize?: boolean;
    dryRun?: boolean;
    isScanComplete: () => boolean;
    batchSize?: number;
    idleMs?: number;
    onBatch?: () => void;
    /** 失败重刮专用：范围 fileIds 全部终态后停止 drain */
    shouldStopDrain?: () => boolean;
  },
): Promise<ScrapeRunResult[]> {
  const batchSize = Math.max(1, opts.batchSize ?? 100);
  const idleMs = Math.max(100, opts.idleMs ?? 400);
  const merged = new Map<KindId, ScrapeRunResult>();

  while (!opts.signal?.aborted) {
    if (opts.shouldStopDrain?.()) break;
    let worked = 0;
    let jobOptions = opts.jobOptions;
    if (opts.jobId) {
      const fresh = loadJobOptions(opts.jobId);
      if (fresh) jobOptions = fresh;
    }
    for (const kind of kinds) {
      if (opts.signal?.aborted) break;
      const r = await runScrapeForKind(kind, {
        signal: opts.signal,
        onProgress: opts.onProgress,
        force: opts.force,
        jobId: opts.jobId,
        jobOptions,
        chainOrganize: opts.chainOrganize,
        dryRun: opts.dryRun,
        batchLimit: batchSize,
      });
      mergeScrapeResult(merged, r);
      worked += r.total;
    }
    if (opts.shouldStopDrain?.()) break;
    if (opts.isScanComplete() && worked === 0) break;
    if (worked > 0) opts.onBatch?.();
    if (worked === 0) {
      await new Promise((resolve) => setTimeout(resolve, idleMs));
    }
  }

  return [...merged.values()];
}

/** 从详情页 URL 推断优先刮削源 */
function inferSourceFromPageUrl(url: string): SourceId | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("javbus")) return "javbus";
    if (host.includes("dmm.co.jp")) return "dmm";
    if (host.includes("javdb")) return "javdb";
    if (host.includes("freejavbt")) return "freejavbt";
    if (host.includes("airav")) return "airav_io";
    if (host.includes("iqq")) return "iqqtv";
    if (host.includes("7mmtv") || host.includes("mmtv.sx")) return "sevenmmtv";
    if (host.includes("missav")) return "miss_av";
    if (host.includes("jav321")) return "jav321";
    if (host.includes("mgstage")) return "mgstage";
    if (host.includes("javlibrary")) return "javlibrary";
  } catch {
    /* ignore */
  }
  return null;
}

/** 单文件强制刮削（含元数据偏好与封面下载），供详情页「完整重刮」 */
export async function scrapeOneFile(
  fileId: number,
  opts: {
    force?: boolean;
    signal?: AbortSignal;
    codeOverride?: string;
    pageUrl?: string;
  } = {},
): Promise<{ meta: ScrapeMeta; ok: boolean }> {
  const db = openDatabase();
  const cfg = loadScrapeConfig();
  const row = db
    .prepare(`SELECT id, code, kind, mosaic, source_path FROM files WHERE id = ?`)
    .get(fileId) as FileRow | undefined;
  if (!row) throw new Error("文件不存在");

  const pipelineActive = Boolean(getPipeline(fileId)?.active);

  const codeOverride = opts.codeOverride?.trim();
  if (codeOverride) {
    db.prepare(`UPDATE files SET code = ? WHERE id = ?`).run(codeOverride, fileId);
    row.code = codeOverride;
  }
  if (!row.code) throw new Error("无番号，无法刮削");

  const kind = row.kind;
  const kindPrefs = resolveKindScrapePrefs(kind, cfg);
  const downloadPrefs = resolveDownloadPrefs(cfg, kind, undefined);
  const metadataPrefs = { ...kindPrefs.metadata };
  const force = opts.force !== false;
  const pageUrl = opts.pageUrl?.trim() || "";

  let metaSourcesOverride: SourceId[] | undefined;
  if (pageUrl) {
    const hinted = inferSourceFromPageUrl(pageUrl);
    const profile = getKindScrapeProfile(kind);
    metaSourcesOverride = hinted
      ? [...new Set([hinted, ...profile.metaSources, ...profile.coverSources])]
      : undefined;
  }

  // 保留 target_path / organized_at，重刮后 NFO 仍写入已有片库路径
  db.prepare(
    `UPDATE files SET status = 'scraping', error = NULL, scraped_at = NULL WHERE id = ?`,
  ).run(fileId);

  if (pipelineActive) {
    startParseStep(fileId, row.source_path || "", row.code, kind);
    const profile = getKindScrapeProfile(kind);
    const disabled = new Set(cfg.disabledProviders ?? []);
    for (const id of getProbeCooldownIds()) disabled.add(id);
    const override = metaSourcesOverride ?? [];
    const kindFieldPriority =
      profile.useGlobal?.sources === false ? profile.fieldPriority : undefined;
    const plannedSources = collectScrapeSourceIds(
      cfg.fieldPriority,
      kindFieldPriority,
      override.length ? override : profile.metaSources,
      override.length ? override : profile.coverSources,
    ).filter((id) => !disabled.has(id));
    startScrapeStep(fileId, plannedSources);
  }

  const detail = await scrapeCodeDetailed(row.code, kind, {
    force,
    signal: opts.signal,
    metaSourcesOverride,
    onSourceComplete: pipelineActive
      ? (run) => appendSourceRunItem(fileId, run)
      : undefined,
  });

  let finalMeta = detail.bySource.size
    ? attachSourceSnapshots(detail.meta, detail.bySource)
    : detail.meta;
  if (pageUrl) {
    finalMeta = { ...finalMeta, website: pageUrl };
  }
  if (row.mosaic && !finalMeta.mosaic) {
    finalMeta = { ...finalMeta, mosaic: row.mosaic };
  }
  finalMeta = await applyMetadataPrefs(finalMeta, metadataPrefs, cfg, {
    signal: opts.signal,
  });

  if (pipelineActive) {
    finishScrapeStep(fileId, finalMeta);
  }

  if (finalMeta.ok) {
    if (pipelineActive) ensureOrganizePipelineSteps(fileId);
    const covers = [
      ...new Set(
        [...detail.bySource.values()]
          .flatMap((r) => [r.coverUrl, ...(r.alternateCoverUrls || [])])
          .filter((u): u is string => Boolean(u)),
      ),
    ];
    let ordered = orderCoverDownloadCandidates(finalMeta.coverUrl, covers);
    if (cfg.coverDownloadStrategy === "size" && ordered.length > 1) {
      const best = await pickLargestCoverUrl(ordered, opts.signal);
      if (best) ordered = [best, ...ordered.filter((u) => u !== best)];
    }
    const url = pickCoverUrlForDownload(ordered, downloadPrefs) || finalMeta.coverUrl;
    if (url || downloadPrefs.amazonHdPoster || downloadPrefs.tenhowHdPoster) {
      const hd = await enhanceCoverWithHdPosters(finalMeta, url, downloadPrefs, {
        signal: opts.signal,
      });
      if (hd.amazonHardFail) {
        finalMeta = {
          ...finalMeta,
          ok: false,
          message: "Amazon 高清海报获取失败（严格模式已中止）",
        };
      } else {
        const finalUrl = hd.url || url;
        if (finalUrl) {
          const coverSourceId = finalMeta.fieldSources?.cover;
          const tryUrls = [
            ...new Set(
              [finalUrl, url, ...ordered.filter((u) => u !== finalUrl && u !== url)].filter(Boolean),
            ),
          ] as string[];
          let local: string | null = null;
          let usedUrl = finalUrl;
          for (const candidate of tryUrls) {
            local = await downloadCover(row.code, row.kind, candidate, {
              signal: opts.signal,
              force,
              sourceId: coverSourceId,
              pageUrl: pageUrl || finalMeta.website || undefined,
            });
            if (local) {
              usedUrl = candidate;
              break;
            }
          }
          finalMeta = {
            ...finalMeta,
            coverUrl: usedUrl,
            coverLocal: local ?? finalMeta.coverLocal,
          };
          if (pipelineActive) {
            appendCoverDownload(fileId, usedUrl, local ?? finalMeta.coverLocal);
          }
        }
      }
    }
    if (pipelineActive && !finalMeta.coverUrl && !finalMeta.coverLocal) {
      appendPipelineFailure(fileId, PIPELINE_STEPS.images, { tone: "warn", text: "未下载到封面" });
      markPipelineStepDone(fileId, PIPELINE_STEPS.images);
    }
    finalMeta = await applyMetadataPrefs(finalMeta, metadataPrefs, cfg, {
      signal: opts.signal,
    });
  }

  if (finalMeta.ok) {
    await withPersistLock(() => {
      writeScrapeCache(finalMeta);
      db.prepare(
        `UPDATE files SET status = 'scraped', error = NULL, scraped_at = ? WHERE id = ?`,
      ).run(Date.now(), fileId);
      notifyFileChanges(fileId, { kind, reason: "scrape" });
    });
  } else {
    await withPersistLock(() => {
      db.prepare(
        `UPDATE files SET status = 'failed', error = ?, scraped_at = NULL WHERE id = ?`,
      ).run(finalMeta.message ?? "刮削失败", fileId);
      notifyFileChanges(fileId, { kind, reason: "scrape" });
      try {
        deleteMetadataOnScrapeFail(row.code, kind, resolveOrganizeForKind(kind));
      } catch {
        /* ignore */
      }
    });
  }

  return { meta: finalMeta, ok: Boolean(finalMeta.ok) };
}
