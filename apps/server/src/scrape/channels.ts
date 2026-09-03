import { getCatalogEntry } from "./providers/catalog.js";
import type { SourceId } from "./types.js";

export type ScrapeChannel = "fast" | "slow" | "auto";

/** access=proxy_flare 的源需过盾（FlareSolverr）。 */
export function sourceNeedsFlare(id: SourceId): boolean {
  return getCatalogEntry(id)?.access === "proxy_flare";
}

export function splitSourcesByChannel(
  sources: SourceId[],
  channel: ScrapeChannel,
): { use: SourceId[]; deferredFlare: SourceId[] } {
  const use: SourceId[] = [];
  const deferredFlare: SourceId[] = [];
  const seen = new Set<string>();
  for (const raw of sources) {
    const id = String(raw || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (channel === "fast" && sourceNeedsFlare(id)) {
      deferredFlare.push(id);
    } else if (channel === "slow") {
      if (sourceNeedsFlare(id)) use.push(id);
    } else {
      use.push(id);
    }
  }
  return { use, deferredFlare };
}

export function isNoDetailError(err: string | undefined): boolean {
  const s = String(err || "").trim().toLowerCase();
  if (!s) return false;
  if (s === "not_found" || s === "notfound") return true;
  return (
    s.includes("未找到") ||
    s.includes("页面不匹配") ||
    s.includes("搜索无结果") ||
    s.includes("not found") ||
    s.includes("no detail") ||
    s.includes("无标题")
  );
}

export function allFastNoDetail(
  results: Array<{ error?: string }>,
  ranCount: number,
): boolean {
  if (ranCount === 0) return false;
  return results.length === ranCount && results.every((r) => isNoDetailError(r.error));
}

/** 源链中尚未跑过的过盾源（多源刮削 / 编辑弹窗切换来源） */
export function listUntriedFlareSources(
  allSources: SourceId[],
  sourcesTried: SourceId[],
): SourceId[] {
  const tried = new Set(sourcesTried);
  const out: SourceId[] = [];
  const seen = new Set<string>();
  for (const id of allSources) {
    const key = String(id || "").trim();
    if (!key || seen.has(key) || tried.has(key) || !sourceNeedsFlare(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/** 是否应补跑慢通道：元数据未齐、缺封面、或仍有过盾源未试 */
export function shouldRunDeferredPass(opts: {
  metaOk: boolean;
  coverUrl?: string | null;
  allSources: SourceId[];
  sourcesTried: SourceId[];
  deferredFlare: SourceId[];
  fastResults: Array<{ error?: string }>;
  fastRanCount: number;
}): boolean {
  if (!opts.deferredFlare.length) return false;
  if (allFastNoDetail(opts.fastResults, opts.fastRanCount)) return false;
  if (!opts.metaOk) return true;
  if (!opts.coverUrl) {
    if (opts.deferredFlare.some((id) => opts.allSources.includes(id))) return true;
  }
  return listUntriedFlareSources(opts.allSources, opts.sourcesTried).length > 0;
}
