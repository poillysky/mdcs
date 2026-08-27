import { getKindScrapeProfile, loadScrapeConfig } from "../config/loadScrape.js";
import { readScrapeCache, writeScrapeCache } from "./cache.js";
import {
  allFastNoDetail,
  shouldRunDeferredPass,
  splitSourcesByChannel,
  sourceNeedsFlare,
  type ScrapeChannel,
} from "./channels.js";
import { collectScrapeSourceIds, mergeResultsForKind } from "./merge.js";
import { attachSourceSnapshots } from "./sourceSnapshots.js";
import { runPool } from "./pool.js";
import { getProbeCooldownIds } from "./probe.js";
import { getProvider } from "./providers/index.js";
import { resolveProviderRetry } from "./providers/providerSite.js";
import type { ProviderResult, ScrapeMeta, SourceId } from "./types.js";
import type { KindId } from "../types.js";

export type ScrapeOptions = {
  force?: boolean;
  signal?: AbortSignal;
  /** fast=跳过过盾；slow=只跑过盾；auto=快不够再补慢（API 默认） */
  channel?: ScrapeChannel;
  priorBySource?: Map<SourceId, ProviderResult>;
  priorTried?: SourceId[];
  priorRuns?: NonNullable<ScrapeMeta["sourceRuns"]>;
  /** 任务级覆盖：非空则替换 kindProfile.metaSources（同时用于 cover 候选） */
  metaSourcesOverride?: SourceId[];
  /** 单源完成回调（详情页管线日志） */
  onSourceComplete?: (run: {
    id: SourceId;
    ok: boolean;
    ms: number;
    error?: string;
    channel: "fast" | "slow";
  }) => void;
};

export type ScrapeCodeDetail = {
  meta: ScrapeMeta;
  bySource: Map<SourceId, ProviderResult>;
  sourcesTried: SourceId[];
};

/** 单源总时限（秒），默认跟 requestTimeoutSec=30 */
export function resolveSourceDeadlineSec(): number {
  const sec = loadScrapeConfig().requestTimeoutSec || 30;
  return Math.max(5, Math.floor(sec));
}

function combineAbortSignals(...signals: Array<AbortSignal | undefined>): AbortSignal {
  const list = signals.filter((s): s is AbortSignal => Boolean(s));
  if (list.length === 0) return AbortSignal.timeout(30_000);
  if (list.length === 1) return list[0]!;
  return AbortSignal.any(list);
}

function rejectWhenAborted(signal: AbortSignal, message: string): Promise<never> {
  return new Promise((_, reject) => {
    const fail = () => {
      const err = new Error(message);
      err.name = "TimeoutError";
      reject(err);
    };
    if (signal.aborted) {
      fail();
      return;
    }
    signal.addEventListener("abort", fail, { once: true });
  });
}

/** 单源硬超时：超时后编排层立即失败，即使 provider 内部还有后续请求 */
export async function scrapeProviderWithDeadline(
  scrape: (signal: AbortSignal) => Promise<ProviderResult | null>,
  opts: { deadlineMs: number; parent?: AbortSignal },
): Promise<ProviderResult | null> {
  const deadlineSec = Math.max(1, Math.round(opts.deadlineMs / 1000));
  const deadlineSignal = AbortSignal.timeout(opts.deadlineMs);
  const signal = combineAbortSignals(opts.parent, deadlineSignal);
  const timeoutMsg = `超时 ${deadlineSec}s`;
  try {
    return await Promise.race([scrape(signal), rejectWhenAborted(signal, timeoutMsg)]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const timedOut =
      signal.aborted ||
      /timeout|超时|aborted/i.test(message) ||
      (err instanceof Error && err.name === "TimeoutError");
    return {
      source: "unknown",
      fields: {},
      ms: opts.deadlineMs,
      error: timedOut ? timeoutMsg : message,
    } as ProviderResult;
  }
}

async function runSources(
  code: string,
  kind: KindId,
  sourceIds: SourceId[],
  channel: "fast" | "slow",
  concurrency: number,
  signal?: AbortSignal,
  onSourceComplete?: ScrapeOptions["onSourceComplete"],
): Promise<{ bySource: Map<SourceId, ProviderResult>; tried: SourceId[]; runs: NonNullable<ScrapeMeta["sourceRuns"]> }> {
  const bySource = new Map<SourceId, ProviderResult>();
  const tried: SourceId[] = [];
  const runs: NonNullable<ScrapeMeta["sourceRuns"]> = [];
  const profile = getKindScrapeProfile(kind);
  const deadlineMs = resolveSourceDeadlineSec() * 1000;

  await runPool(
    sourceIds,
    concurrency,
    async (sourceId) => {
      if (signal?.aborted) return;
      const provider = getProvider(sourceId);
      if (!provider) return;
      tried.push(sourceId);
      const maxRetry = resolveProviderRetry(sourceId);
      const started = Date.now();
      // 整段重试共享同一截止时间，避免重试把单源拖到数分钟
      const deadlineSignal = AbortSignal.timeout(deadlineMs);
      const sourceSignal = combineAbortSignals(signal, deadlineSignal);
      let result: ProviderResult | null = null;
      for (let attempt = 0; attempt <= maxRetry; attempt++) {
        if (sourceSignal.aborted) break;
        const remaining = deadlineMs - (Date.now() - started);
        if (remaining <= 0) break;
        try {
          const got = await scrapeProviderWithDeadline(
            (sig) =>
              provider.scrape({
                code,
                kind,
                metaSources: profile.metaSources,
                coverSources: profile.coverSources,
                signal: sig,
              }),
            { deadlineMs: remaining, parent: sourceSignal },
          );
          if (got) {
            result = {
              ...got,
              source: sourceId,
              ms: typeof got.ms === "number" && got.ms > 0 ? got.ms : Date.now() - started,
            };
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          result = {
            source: sourceId,
            ms: Date.now() - started,
            error: message,
            fields: {},
          } as ProviderResult;
        }
        if (!result?.error || attempt >= maxRetry || sourceSignal.aborted) break;
      }
      if (sourceSignal.aborted && (!result || result.error)) {
        result = {
          source: sourceId,
          fields: {},
          ms: Date.now() - started,
          error: `超时 ${Math.round(deadlineMs / 1000)}s`,
        } as ProviderResult;
      }
      if (result) {
        bySource.set(sourceId, result);
        const run = {
          id: sourceId,
          ok: !result.error,
          ms: result.ms,
          error: result.error,
          channel,
        };
        runs.push(run);
        onSourceComplete?.(run);
      } else {
        const run = { id: sourceId, ok: false, ms: Date.now() - started, channel };
        runs.push(run);
        onSourceComplete?.(run);
      }
    },
    signal,
  );

  return { bySource, tried, runs };
}

function withRuns(meta: ScrapeMeta, runs: NonNullable<ScrapeMeta["sourceRuns"]>): ScrapeMeta {
  return { ...meta, sourceRuns: runs };
}

export async function scrapeCodeDetailed(
  code: string,
  kind: KindId,
  opts: ScrapeOptions = {},
): Promise<ScrapeCodeDetail> {
  const cfg = loadScrapeConfig();
  const channel: ScrapeChannel = opts.channel ?? "auto";

  const empty = (message: string, ok = false): ScrapeCodeDetail => ({
    meta: {
      code,
      kind,
      title: code,
      actors: [],
      genres: [],
      source: ok ? "none" : channel === "fast" ? "fast" : "none",
      sourcesTried: [],
      fieldSources: {},
      scrapedAt: new Date().toISOString(),
      ok,
      message,
    },
    bySource: new Map(),
    sourcesTried: [],
  });

  if (!cfg.enabled) {
    return empty("刮削已禁用");
  }

  if (!opts.force) {
    const cached = readScrapeCache(code, kind);
    if (cached?.ok) {
      return { meta: cached, bySource: new Map(), sourcesTried: cached.sourcesTried };
    }
  }

  const profile = getKindScrapeProfile(kind);
  const disabled = new Set(cfg.disabledProviders ?? []);
  for (const id of getProbeCooldownIds()) disabled.add(id);
  const override = (opts.metaSourcesOverride ?? []).filter(Boolean);
  const metaSources = override.length ? override : profile.metaSources;
  const coverSources = override.length ? override : profile.coverSources;
  const kindFieldPriority =
    profile.useGlobal?.sources === false ? profile.fieldPriority : undefined;
  const allSources = collectScrapeSourceIds(
    cfg.fieldPriority,
    kindFieldPriority,
    metaSources,
    coverSources,
  ).filter((id) => !disabled.has(id));

  const fastConc = Math.max(1, cfg.exportFastConcurrency || 4);
  const slowConc = Math.max(1, cfg.exportSlowConcurrency || 2);

  const bySource = new Map<SourceId, ProviderResult>(opts.priorBySource ?? []);
  const sourcesTried: SourceId[] = [...(opts.priorTried ?? [])];
  const sourceRuns: NonNullable<ScrapeMeta["sourceRuns"]> = [...(opts.priorRuns ?? [])];

  const mergeNow = () => {
    const meta = mergeResultsForKind(
      code,
      kind,
      bySource,
      sourcesTried,
      override.length ? override : undefined,
    );
    return withRuns(attachSourceSnapshots(meta, bySource), sourceRuns);
  };

  const applyRun = (part: Awaited<ReturnType<typeof runSources>>) => {
    for (const [id, r] of part.bySource) bySource.set(id, r);
    for (const id of part.tried) {
      if (!sourcesTried.includes(id)) sourcesTried.push(id);
    }
    sourceRuns.push(...part.runs);
  };

  const runFastPass = async () => {
    const { use, deferredFlare } = splitSourcesByChannel(allSources, "fast");
    if (use.length) {
      applyRun(
        await runSources(code, kind, use, "fast", fastConc, opts.signal, opts.onSourceComplete),
      );
    }
    return deferredFlare;
  };

  const runSlowPass = async (flareIds: SourceId[]) => {
    const ids = flareIds.filter((id) => !sourcesTried.includes(id));
    if (!ids.length) return;
    applyRun(
      await runSources(code, kind, ids, "slow", slowConc, opts.signal, opts.onSourceComplete),
    );
  };

  if (channel === "fast") {
    const deferredFlare = await runFastPass();
    const meta = mergeNow();
    const fastResults = [...bySource.values()];
    if (meta.ok) {
      writeScrapeCache(meta);
      return { meta, bySource, sourcesTried };
    }
    if (deferredFlare.length > 0 && !allFastNoDetail(fastResults, fastResults.length)) {
      return {
        meta: { ...meta, ok: false, message: "needs_flare" },
        bySource,
        sourcesTried,
      };
    }
    return { meta: { ...meta, message: meta.message ?? "not_found" }, bySource, sourcesTried };
  }

  if (channel === "slow") {
    const flareIds = allSources.filter((id) => sourceNeedsFlare(id));
    await runSlowPass(flareIds);
    const meta = mergeNow();
    if (meta.ok) writeScrapeCache(meta);
    return { meta, bySource, sourcesTried };
  }

  // auto：快通道不够再补慢；元数据已 ok 时也补跑未试过的过盾源（多源快照）
  const deferredFlare = await runFastPass();
  let meta = mergeNow();
  if (
    shouldRunDeferredPass({
      metaOk: meta.ok,
      coverUrl: meta.coverUrl,
      allSources,
      sourcesTried,
      deferredFlare,
      fastResults: [...bySource.values()],
      fastRanCount: bySource.size,
    })
  ) {
    await runSlowPass(deferredFlare);
    meta = mergeNow();
  }
  if (meta.ok) writeScrapeCache(meta);
  return { meta, bySource, sourcesTried };
}

export async function scrapeCode(
  code: string,
  kind: KindId,
  opts: ScrapeOptions = {},
): Promise<ScrapeMeta> {
  const { meta } = await scrapeCodeDetailed(code, kind, opts);
  return meta;
}

/** 旧缓存无 sourceSnapshots 时，补抓全局+字段优先级源供编辑弹窗切换 */
export async function ensureSourceSnapshots(
  code: string,
  kind: KindId,
  opts: { signal?: AbortSignal } = {},
): Promise<ScrapeMeta | null> {
  const cached = readScrapeCache(code, kind);
  if (!cached) return null;
  const existing = cached.sourceSnapshots;
  if (existing && Object.keys(existing).length > 0) return cached;

  const cfg = loadScrapeConfig();
  const profile = getKindScrapeProfile(kind);
  const kindFieldPriority =
    profile.useGlobal?.sources === false ? profile.fieldPriority : undefined;
  const fromTried = cached.sourcesTried ?? [];
  const fromRuns = (cached.sourceRuns ?? []).filter((r) => r.ok).map((r) => r.id);
  const sourceIds = [
    ...new Set([
      ...collectScrapeSourceIds(
        cfg.fieldPriority,
        kindFieldPriority,
        profile.metaSources,
        profile.coverSources,
      ),
      ...fromTried,
      ...fromRuns,
    ]),
  ] as SourceId[];
  if (!sourceIds.length) return cached;

  const fastConc = Math.max(1, cfg.exportFastConcurrency || 4);
  const { bySource } = await runSources(code, kind, sourceIds, "fast", fastConc, opts.signal);
  if (!bySource.size) return cached;

  const next = attachSourceSnapshots(cached, bySource);
  writeScrapeCache(next);
  return next;
}
