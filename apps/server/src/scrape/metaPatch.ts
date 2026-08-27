import path from "node:path";
import { toProjectRelativePath } from "../paths.js";
import type { ScrapeMeta } from "./types.js";

export type MetaFieldPatch = { value: string; source: string };

function splitList(value: string, sep: RegExp): string[] {
  return value
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean);
}

function toLocalCoverPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^[a-zA-Z]:[\\/]/.test(trimmed) || path.isAbsolute(trimmed) || trimmed.includes(":/")) {
    return toProjectRelativePath(trimmed);
  }
  return trimmed.replace(/^\/+/, "").replace(/\\/g, "/");
}

function parseRuntime(value: string): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseRating(value: string): { ratingValue?: number; score?: number } {
  const n = Number(value);
  if (!Number.isFinite(n)) return {};
  return { ratingValue: n, score: n };
}

/** 将编辑弹窗字段写回 ScrapeMeta（保留 sourceSnapshots） */
export function applyMetaFieldPatches(
  meta: ScrapeMeta,
  fields: Record<string, MetaFieldPatch>,
): ScrapeMeta {
  const next: ScrapeMeta = {
    ...meta,
    fieldSources: { ...meta.fieldSources },
  };

  for (const [key, patch] of Object.entries(fields)) {
    const value = patch.value?.trim() ?? "";
    const source = patch.source?.trim() || "custom";
    const setSource = (sourceKey: string) => {
      if (source && source !== "custom") next.fieldSources[sourceKey] = source;
      else if (source === "custom") next.fieldSources[sourceKey] = "custom";
    };

    switch (key) {
      case "code":
        if (value) next.code = value;
        setSource("code");
        break;
      case "publishNumber":
        next.publishNumber = value || undefined;
        setSource("publishNumber");
        break;
      case "title":
        if (value) next.titleZh = value;
        setSource("titleZh");
        break;
      case "originaltitle":
        if (value) next.title = value;
        setSource("title");
        break;
      case "plot":
        next.plot = value || undefined;
        setSource("plot");
        break;
      case "originalPlot":
        next.originalPlot = value || undefined;
        setSource("originalPlot");
        break;
      case "actors":
        next.actors = value ? splitList(value, /[,，、]/) : [];
        setSource("actors");
        break;
      case "coverUrl":
        next.coverUrl = value || null;
        setSource("cover");
        break;
      case "poster": {
        if (!value) break;
        if (/^https?:\/\//i.test(value)) {
          next.coverUrl = value;
        } else {
          next.coverLocal = toLocalCoverPath(value);
        }
        setSource("cover");
        break;
      }
      case "extrafanart":
        next.extrafanartUrls = value ? splitList(value, /,\s*/) : [];
        setSource("extrafanart");
        break;
      case "genres":
        next.genres = value ? splitList(value, /[,，、]/) : [];
        setSource("genres");
        break;
      case "premiered":
        next.premiered = value || undefined;
        setSource("premiered");
        break;
      case "runtime":
        next.runtime = parseRuntime(value);
        setSource("runtime");
        break;
      case "score": {
        const rating = parseRating(value);
        next.ratingValue = rating.ratingValue ?? null;
        next.score = rating.score ?? null;
        setSource("score");
        break;
      }
      case "directors":
        next.directors = value ? splitList(value, /[,，、]/) : [];
        setSource("directors");
        break;
      case "series":
        next.series = value || undefined;
        setSource("series");
        break;
      case "studio":
        next.studio = value || undefined;
        setSource("studio");
        break;
      case "publisher":
        next.publisher = value || undefined;
        setSource("publisher");
        break;
      case "votes":
        next.votes = value || null;
        setSource("votes");
        break;
      default:
        break;
    }
  }

  return next;
}
