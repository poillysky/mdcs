import { toStorageRelativePath } from "../paths.js";

function normalizeOutboundSourcePath(value: unknown): string | null {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  if (!s) return null;
  return toStorageRelativePath(s) || s.replace(/\\/g, "/").replace(/^\/+/, "");
}

function normalizeOutboundTargetPath(value: unknown): string | null {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.replace(/\\/g, "/").replace(/^\/+/, "");
}

function parseMetaJson(raw: unknown): Record<string, unknown> | null {
  if (raw == null || raw === "") return null;
  try {
    return typeof raw === "string" ? (JSON.parse(raw) as Record<string, unknown>) : (raw as Record<string, unknown>);
  } catch {
    return null;
  }
}

function formatDurationMs(ms: number): string | null {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatActorsFromMeta(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  const actors = meta.actors;
  if (Array.isArray(actors)) {
    const names = actors.map((v) => String(v).trim()).filter(Boolean);
    if (names.length) return names.join(", ");
  }
  if (typeof actors === "string" && actors.trim()) return actors.trim();
  const actorUrls = meta.actorUrls;
  if (actorUrls && typeof actorUrls === "object" && !Array.isArray(actorUrls)) {
    const names = Object.keys(actorUrls as Record<string, unknown>).filter(Boolean);
    if (names.length) return names.join(", ");
  }
  return null;
}

function formatDurationFromMeta(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  const runs = meta.sourceRuns;
  if (Array.isArray(runs) && runs.length) {
    const total = runs.reduce((sum, item) => {
      const ms = Number((item as { ms?: number }).ms);
      return sum + (Number.isFinite(ms) ? ms : 0);
    }, 0);
    const formatted = formatDurationMs(total);
    if (formatted) return formatted;
  }
  const timings = meta.fieldTimings;
  if (Array.isArray(timings) && timings.length) {
    const total = timings.reduce((sum, item) => {
      const ms = Number((item as { ms?: number }).ms);
      return sum + (Number.isFinite(ms) ? ms : 0);
    }, 0);
    const formatted = formatDurationMs(total);
    if (formatted) return formatted;
  }
  return null;
}

function actorsFromFileName(fileName: string, code?: string | null): string | null {
  const stem = fileName.replace(/\.[^.]+$/, "").trim();
  if (!stem) return null;
  const codeNorm = code?.trim();
  if (codeNorm) {
    const stemLower = stem.toLowerCase();
    const codeLower = codeNorm.toLowerCase();
    if (stemLower.startsWith(codeLower)) {
      const rest = stem.slice(codeNorm.length).replace(/^[\s._-]+/, "").trim();
      if (rest && /[A-Za-z\u4e00-\u9fff]/.test(rest)) return rest;
    }
  }
  const commaMatch = stem.match(/^(.+,\s*.+?)(?:\s*[-–]\s*|\s+\[)/);
  if (commaMatch?.[1]) return commaMatch[1].trim();
  return null;
}

function durationFromTimestamps(
  scrapedAt?: number | null,
  organizedAt?: number | null,
  status?: string,
): string | null {
  if (!scrapedAt || !organizedAt || organizedAt <= scrapedAt) return null;
  if (status !== "done") return null;
  return formatDurationMs(organizedAt - scrapedAt);
}

export const FILE_LIST_SELECT = `f.id, f.kind, f.source_path, f.file_name, f.file_size, f.file_mtime, f.code,
              f.cd_index, f.mosaic, f.status, f.target_path, f.error, f.scraped_at, f.organized_at,
              c.meta_json, j.trigger_source AS trigger_source`;

export const FILE_LIST_JOINS = `FROM files f
       LEFT JOIN scrape_cache c ON c.code = f.code AND c.kind = f.kind
       LEFT JOIN jobs j ON j.id = f.job_id`;

/** 入库/刮削完成时间，用于活动排序与周统计 */
export const FILE_ACTIVITY_TS = `COALESCE(f.organized_at, f.scraped_at, f.file_mtime)`;

export function mapFileListRow(row: Record<string, unknown>) {
  const meta = parseMetaJson(row.meta_json);
  const code = row.code ? String(row.code) : null;
  const fileName = String(row.file_name ?? "");
  const status = String(row.status ?? "");
  const scrapedAt = row.scraped_at != null ? Number(row.scraped_at) : null;
  const organizedAt = row.organized_at != null ? Number(row.organized_at) : null;
  const { meta_json: _meta, trigger_source: _ts, ...rest } = row;
  const titleZh =
    meta && typeof meta.titleZh === "string" && meta.titleZh.trim() ? meta.titleZh.trim() : null;
  const titleFromMeta =
    meta && typeof meta.title === "string" && meta.title.trim() ? meta.title.trim() : null;
  const actors =
    formatActorsFromMeta(meta) ?? actorsFromFileName(fileName, code);
  const duration =
    formatDurationFromMeta(meta) ?? durationFromTimestamps(scrapedAt, organizedAt, status);
  const premiered =
    meta && typeof meta.premiered === "string" && meta.premiered.trim()
      ? meta.premiered.trim().slice(0, 10)
      : null;
  const rawTrigger = row.trigger_source != null ? String(row.trigger_source).trim() : "";
  const triggerSource: "manual" | "monitor" =
    rawTrigger === "monitor" ? "monitor" : "manual";
  const sourcePath = normalizeOutboundSourcePath(row.source_path);
  const targetPath = normalizeOutboundTargetPath(row.target_path);
  return {
    ...rest,
    source_path: sourcePath ?? rest.source_path,
    target_path: targetPath ?? rest.target_path,
    title: titleZh ?? titleFromMeta ?? rest.title ?? null,
    titleZh,
    premiered,
    scrape_source:
      (meta && typeof meta.source === "string" ? meta.source : null) ?? rest.scrape_source ?? null,
    cover_url:
      (meta && typeof meta.coverUrl === "string" ? meta.coverUrl : null) ?? rest.cover_url ?? null,
    actors,
    duration,
    triggerSource,
  };
}
