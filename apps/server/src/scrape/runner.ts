import { getKindScrapeProfile, loadScrapeConfig, resolveKindScrapePrefs } from "../config/loadScrape.js";
import { resolveOrganizeForKind } from "../config/loadConfig.js";
import { openDatabase } from "../db/init.js";
import type { JobOptions } from "../jobs/options.js";
import { deleteMetadataOnScrapeFail } from "../organize/deleteMetaOnFail.js";
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
  finishScrapeStep,
  PIPELINE_STEPS,
  startOrganizeSteps,
  startParseStep,
  startScrapeStep,
} from "./pipelineLogHelpers.js";
import { getPipeline } from "./pipelineProgress.js";
import { scrapeCodeDetailed } from "./orchestrator.js";
import { listUntriedFlareSources } from "./channels.js";
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

type SlowHandoff = {
  row: FileRow;
  bySource: Map<SourceId, ProviderResult>;
  sourcesTried: SourceId[];
  priorRuns: NonNullable<ScrapeMeta["sourceRuns"]>;
};

function resolveDownloadPrefs(
  cfg: ReturnType<typeof loadScrapeConfig>,
  kind: KindId,
  jobOptions?: JobOptions,
): DownloadPrefs {
  const kindPrefs = resolveKindScrapePrefs(kind, cfg);
  const global = kindPrefs.download;
  const useGlobal = jobOptions?.useGlobal?.download !== false;
  const job = jobOptions?.download;
  const base: DownloadPrefs = {
    downloadPoster: global.downloadPoster,
    downloadThumb: global.downloadThumb,
    preferHighResPoster: global.preferHighResPoster,
    skipAmazon: global.skipAmazon,
    amazonHdPoster: global.amazonHdPoster,
    tenhowHdPoster: global.tenhowHdPoster,
    amazonStrictMode: global.amazonStrictMode,
  };
  if (useGlobal || !job) return base;
  return {
    downloadPoster: job.downloadPoster ?? base.downloadPoster,
    downloadThumb: job.downloadThumb ?? base.downloadThumb,
    preferHighResPoster: job.preferHighResPoster ?? base.preferHighResPoster,
    skipAmazon: job.skipAmazon ?? base.skipAmazon,
    amazonHdPoster: job.amazonHdPoster ?? base.amazonHdPoster,
    tenhowHdPoster: job.tenhowHdPoster ?? base.tenhowHdPoster,
    amazonStrictMode: job.amazonStrictMode ?? base.amazonStrictMode,
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
  const fastConc = Math.max(1, cfg.exportFastConcurrency || 4);
  const slowConc = Math.max(1, cfg.exportSlowConcurrency || 2);
  const jobId = opts.jobId?.trim() || null;

  const rows = db
    .prepare(`
      SELECT id, code, kind, mosaic FROM files
      WHERE kind = ? AND code IS NOT NULL
        AND status IN ('pending', 'failed', 'scraping')
      ORDER BY id ASC
    `)
    .all(kind) as FileRow[];

  const codeCache = new Map<string, ScrapeMeta>();
  let scraped = 0;
  let failed = 0;
  let skipped = 0;

  const updateStatus = db.prepare(`
    UPDATE files SET status = @status, error = @error, scraped_at = @scraped_at,
      job_id = COALESCE(@job_id, job_id)
    WHERE id = @id
  `);

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
    if (next.ok) writeScrapeCache(next);
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
    } else {
      failed += 1;
      updateStatus.run({
        id: row.id,
        status: "failed",
        error: finalMeta.message ?? "刮削失败",
        scraped_at: null,
        job_id: jobId,
      });
      try {
        deleteMetadataOnScrapeFail(row.code, kind, resolveOrganizeForKind(kind));
      } catch {
        /* ignore cleanup errors */
      }
    }
    codeCache.set(row.code, finalMeta);
  }

  function markScraping(row: FileRow) {
    updateStatus.run({
      id: row.id,
      status: "scraping",
      error: null,
      scraped_at: null,
      job_id: jobId,
    });
  }

  const slowQueue: SlowHandoff[] = [];

  await runPool(
    rows,
    fastConc,
    async (row) => {
      if (opts.signal?.aborted) return;
      markScraping(row);
      opts.onProgress?.(`刮削(快) ${row.code}`);

      const cached = codeCache.get(row.code);
      if (cached) {
        await applyMeta(row, cached);
        return;
      }

      const detail = await scrapeCodeDetailed(row.code, row.kind, {
        force: opts.force,
        signal: opts.signal,
        channel: "fast",
        metaSourcesOverride,
      });

      const profile = getKindScrapeProfile(row.kind);
      const override = metaSourcesOverride?.length ? metaSourcesOverride : undefined;
      const metaSources = override ?? profile.metaSources;
      const coverSources = override ?? profile.coverSources;
      const allSources = [...new Set([...metaSources, ...coverSources])];
      const pendingFlare = listUntriedFlareSources(allSources, detail.sourcesTried);

      if (detail.meta.message === "needs_flare" || pendingFlare.length > 0) {
        slowQueue.push({
          row,
          bySource: detail.bySource,
          sourcesTried: detail.sourcesTried,
          priorRuns: detail.meta.sourceRuns ?? [],
        });
        return;
      }

      await applyMeta(row, detail.meta, detail.bySource);
    },
    opts.signal,
  );

  await runPool(
    slowQueue,
    slowConc,
    async (item) => {
      if (opts.signal?.aborted) return;
      opts.onProgress?.(`刮削(慢) ${item.row.code}`);

      const cached = codeCache.get(item.row.code);
      if (cached) {
        await applyMeta(item.row, cached);
        return;
      }

      const detail = await scrapeCodeDetailed(item.row.code, item.row.kind, {
        force: opts.force,
        signal: opts.signal,
        channel: "slow",
        priorBySource: item.bySource,
        priorTried: item.sourcesTried,
        priorRuns: item.priorRuns,
        metaSourcesOverride,
      });
      await applyMeta(item.row, detail.meta, detail.bySource);
    },
    opts.signal,
  );

  if (opts.signal?.aborted) skipped = rows.length - scraped - failed;

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

  db.prepare(
    `UPDATE files SET status = 'scraping', error = NULL, scraped_at = NULL,
       target_path = NULL, organized_at = NULL WHERE id = ?`,
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
    channel: "auto",
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
    if (pipelineActive) startOrganizeSteps(fileId);
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
    }
    finalMeta = await applyMetadataPrefs(finalMeta, metadataPrefs, cfg, {
      signal: opts.signal,
    });
  }

  if (finalMeta.ok) {
    writeScrapeCache(finalMeta);
    db.prepare(
      `UPDATE files SET status = 'scraped', error = NULL, scraped_at = ? WHERE id = ?`,
    ).run(Date.now(), fileId);
  } else {
    db.prepare(
      `UPDATE files SET status = 'failed', error = ?, scraped_at = NULL WHERE id = ?`,
    ).run(finalMeta.message ?? "刮削失败", fileId);
    try {
      deleteMetadataOnScrapeFail(row.code, kind, resolveOrganizeForKind(kind));
    } catch {
      /* ignore */
    }
  }

  return { meta: finalMeta, ok: Boolean(finalMeta.ok) };
}
