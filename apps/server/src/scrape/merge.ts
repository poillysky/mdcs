import { getKindScrapeProfile, loadScrapeConfig } from "../config/loadScrape.js";
import type { FieldPriority, ProviderResult, ScrapeMeta, SourceId } from "./types.js";
import type { KindId } from "../types.js";

export type FieldTiming = {
  field: string;
  source?: string;
  ms?: number;
};

function isEmptyValue(val: unknown): boolean {
  if (val === undefined || val === null || val === "") return true;
  if (Array.isArray(val) && val.length === 0) return true;
  return false;
}

/** fieldPriority 配置键与合并字段名的别名（如 tags → genres） */
const FIELD_CONFIG_ALIASES: Record<string, string[]> = {
  genres: ["tags"],
  plot: ["outline"],
  // 原生分/满分/评分来源与 score（0–10）共用同一源链
  ratingValue: ["score"],
  ratingMax: ["score"],
  ratingSource: ["score"],
};

function fieldConfigKeys(field: string): string[] {
  const keys = new Set<string>([field]);
  for (const alias of FIELD_CONFIG_ALIASES[field] ?? []) keys.add(alias);
  for (const [canonical, aliases] of Object.entries(FIELD_CONFIG_ALIASES)) {
    if (aliases.includes(field)) {
      keys.add(canonical);
      for (const alias of aliases) keys.add(alias);
    }
  }
  return [...keys];
}

function dedupeSourceOrder(primary: SourceId[], fallback: SourceId[], blocked?: SourceId[]): SourceId[] {
  const blockSet = blocked?.length ? new Set(blocked) : null;
  const seen = new Set<SourceId>();
  const order: SourceId[] = [];
  for (const id of [...primary, ...fallback]) {
    if (!id || seen.has(id)) continue;
    if (blockSet?.has(id)) continue;
    seen.add(id);
    order.push(id);
  }
  return order;
}

/** 取字段级已配置源链（kind 非空优先；kind `[]` 继承 global 字段链） */
function pickConfiguredFieldSources(
  field: string,
  kindPriority: FieldPriority | undefined,
  globalPriority: FieldPriority,
): SourceId[] {
  const keys = fieldConfigKeys(field);
  for (const key of keys) {
    const kindList = kindPriority?.[key];
    if (kindList !== undefined) {
      if (kindList.length > 0) return kindList;
      break;
    }
  }
  for (const key of keys) {
    const globalList = globalPriority[key];
    if (globalList !== undefined) return globalList.length > 0 ? globalList : [];
  }
  return [];
}

/**
 * 解析字段取值顺序：
 * - 已配置字段源链优先；链内从左到右取第一个有值的源
 * - 字段链未命中时，按全局 metaSources（或 coverSources）顺序补充
 * - 字段/kind 列表 `[]` → 该层无字段链，仅用 fallback
 * - 未配置字段 → 仅用 fallback
 */
export function resolveFieldSourceOrder(
  field: string,
  kindPriority: FieldPriority | undefined,
  globalPriority: FieldPriority,
  metaSources: SourceId[],
  blocked?: SourceId[],
): SourceId[] {
  const fieldSources = pickConfiguredFieldSources(field, kindPriority, globalPriority);
  return dedupeSourceOrder(fieldSources, metaSources, blocked);
}

/** 刮削时合并全局源链与所有字段优先级源（去重） */
export function collectScrapeSourceIds(
  globalPriority: FieldPriority,
  kindPriority: FieldPriority | undefined,
  metaSources: SourceId[],
  coverSources: SourceId[],
): SourceId[] {
  const fromFields: SourceId[] = [];
  for (const list of Object.values(globalPriority)) {
    if (list?.length) fromFields.push(...list);
  }
  if (kindPriority) {
    for (const list of Object.values(kindPriority)) {
      if (list?.length) fromFields.push(...list);
    }
  }
  return [...new Set([...metaSources, ...coverSources, ...fromFields])];
}

export function resolveCoverSourceOrder(
  kindPriority: FieldPriority | undefined,
  globalPriority: FieldPriority,
  coverSources: SourceId[],
  blocked?: SourceId[],
): SourceId[] {
  return resolveFieldSourceOrder("cover", kindPriority, globalPriority, coverSources, blocked);
}

function readFieldValue(
  field: string,
  sourceId: SourceId,
  bySource: Map<SourceId, ProviderResult>,
): unknown {
  const r = bySource.get(sourceId);
  if (!r || r.error) return undefined;
  return (r.fields as Record<string, unknown>)[field];
}

export function pickFieldStrict<T>(
  field: string,
  order: SourceId[],
  bySource: Map<SourceId, ProviderResult>,
): { value?: T; source?: string; ms?: number } {
  for (const sourceId of order) {
    const r = bySource.get(sourceId);
    if (!r || r.error) continue;
    const val = readFieldValue(field, sourceId, bySource);
    if (!isEmptyValue(val)) {
      return { value: val as T, source: sourceId, ms: r.ms };
    }
  }
  return {};
}

export function pickCoverStrict(
  order: SourceId[],
  bySource: Map<SourceId, ProviderResult>,
): { url?: string | null; source?: string; ms?: number } {
  for (const sourceId of order) {
    const r = bySource.get(sourceId);
    if (r?.coverUrl) return { url: r.coverUrl, source: sourceId, ms: r.ms };
  }
  return {};
}

export function pickExtrafanartStrict(
  order: SourceId[],
  bySource: Map<SourceId, ProviderResult>,
): { urls?: string[]; source?: string; ms?: number } {
  for (const sourceId of order) {
    const r = bySource.get(sourceId);
    if (r?.extrafanartUrls?.length) {
      return { urls: r.extrafanartUrls, source: sourceId, ms: r.ms };
    }
  }
  return {};
}

const FIELD_ALIASES: Record<string, string[]> = {
  plot: ["outline"],
  genres: ["tags"],
};

function pickWithAliases<T>(
  field: string,
  order: SourceId[],
  bySource: Map<SourceId, ProviderResult>,
): { value?: T; source?: string; ms?: number } {
  const direct = pickFieldStrict<T>(field, order, bySource);
  if (direct.value !== undefined) return direct;
  for (const alias of FIELD_ALIASES[field] ?? []) {
    const alt = pickFieldStrict<T>(alias, order, bySource);
    if (alt.value !== undefined) return alt;
  }
  return {};
}

export function mergeScrapeResults(
  code: string,
  kind: KindId,
  bySource: Map<SourceId, ProviderResult>,
  sourcesTried: SourceId[],
  globalPriority: FieldPriority,
  kindPriority?: FieldPriority,
  /** 任务/单源覆盖：非空时字段回退序用它，且忽略全局字段优先级里「不含这些源」的硬列表 */
  sourcesOverride?: SourceId[],
  globalBlocked?: FieldPriority,
): ScrapeMeta {
  const profile = getKindScrapeProfile(kind);
  const metaSources = sourcesOverride?.length ? sourcesOverride : profile.metaSources;
  const coverFallback = sourcesOverride?.length ? sourcesOverride : profile.coverSources;
  const fieldTimings: FieldTiming[] = [];
  const fieldSources: Record<string, string> = {};

  const resolve = (field: string) => {
    if (sourcesOverride?.length) {
      // 单源/任务覆盖：严格按覆盖列表取字段，避免全局优先序把覆盖源排除
      return sourcesOverride;
    }
    const blocked = globalBlocked?.[field];
    return resolveFieldSourceOrder(field, kindPriority, globalPriority, metaSources, blocked);
  };

  const pick = <T>(field: string) => {
    const order = resolve(field);
    const result = pickWithAliases<T>(field, order, bySource);
    if (result.source) {
      fieldSources[field] = result.source;
      fieldTimings.push({ field, source: result.source, ms: result.ms });
    }
    return result;
  };

  const publishNumberPick = pick<string>("publishNumber");
  const titlePick = pick<string>("title");
  const titleZhPick = pick<string>("titleZh");
  const plotPick = pick<string>("plot");
  const studioPick = pick<string>("studio");
  const publisherPick = pick<string>("publisher");
  const seriesPick = pick<string>("series");
  const actorsPick = pick<string[]>("actors");
  const genresPick = pick<string[]>("genres");
  const runtimePick = pick<number>("runtime");
  const premieredPick = pick<string>("premiered");
  const directorsPick = pick<string[]>("directors");
  const trailerPick = pick<string>("trailerUrl");
  const websitePick = pick<string>("website");
  const scorePick = pick<number>("score");
  const ratingValuePick = pick<number>("ratingValue");
  const ratingMaxPick = pick<number>("ratingMax");
  const ratingSourcePick = pick<string>("ratingSource");
  const votesPick = pick<string>("votes");
  const originalPlotPick = pick<string>("originalPlot");

  const coverOrder = sourcesOverride?.length
    ? sourcesOverride
    : resolveCoverSourceOrder(
        kindPriority,
        globalPriority,
        coverFallback,
        globalBlocked?.cover,
      );
  const cover = pickCoverStrict(coverOrder, bySource);
  if (cover.source) {
    fieldSources.cover = cover.source;
    fieldTimings.push({ field: "cover", source: cover.source, ms: cover.ms });
  }

  const extrafanartOrder = resolve("extrafanart");
  const extrafanart = pickExtrafanartStrict(extrafanartOrder, bySource);
  if (extrafanart.source) {
    fieldSources.extrafanart = extrafanart.source;
    fieldTimings.push({ field: "extrafanart", source: extrafanart.source, ms: extrafanart.ms });
  }

  const ok = Boolean(titlePick.value);
  const primarySource =
    titlePick.source ?? sourcesTried.find((s) => bySource.get(s) && !bySource.get(s)?.error) ?? "none";

  // 番号由路径/文件名识别，不是站点字段
  if (code && !fieldSources.code) {
    fieldSources.code = "系统解析";
  }

  return {
    code,
    publishNumber: publishNumberPick.value,
    kind,
    title: titlePick.value ?? code,
    titleZh: titleZhPick.value,
    plot: plotPick.value,
    premiered: premieredPick.value,
    studio: studioPick.value,
    publisher: publisherPick.value,
    series: seriesPick.value,
    actors: actorsPick.value ?? [],
    genres: genresPick.value ?? [],
    runtime: runtimePick.value ?? null,
    directors: directorsPick.value,
    trailerUrl: trailerPick.value,
    website: websitePick.value,
    score: scorePick.value ?? null,
    ratingValue: ratingValuePick.value ?? null,
    ratingMax: ratingMaxPick.value,
    ratingSource: ratingSourcePick.value,
    votes: votesPick.value ?? null,
    originalPlot: originalPlotPick.value,
    coverUrl: cover.url ?? null,
    extrafanartUrls: extrafanart.urls,
    source: primarySource,
    sourcesTried,
    fieldSources,
    fieldTimings,
    scrapedAt: new Date().toISOString(),
    ok,
    message: ok ? undefined : "所有源均未返回有效元数据",
  };
}

export function mergeResultsForKind(
  code: string,
  kind: KindId,
  bySource: Map<SourceId, ProviderResult>,
  sourcesTried: SourceId[],
  sourcesOverride?: SourceId[],
): ScrapeMeta {
  const cfg = loadScrapeConfig();
  const profile = getKindScrapeProfile(kind);
  const kindPriority =
    profile.useGlobal?.sources === false ? profile.fieldPriority : undefined;
  return mergeScrapeResults(
    code,
    kind,
    bySource,
    sourcesTried,
    cfg.fieldPriority,
    kindPriority,
    sourcesOverride,
    cfg.fieldBlockedSources,
  );
}
