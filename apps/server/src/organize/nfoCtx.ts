import fs from "node:fs";
import path from "node:path";
import type { ScrapeMeta } from "../scrape/types.js";
import type { NfoWriteContext } from "./nfo.js";

export type BuildNfoCtxInput = {
  meta: ScrapeMeta;
  mediaTitle?: string;
  hasSubtitle?: boolean;
  resolution?: string;
  mosaic?: string;
  posterAbs?: string | null;
  thumbAbs?: string | null;
  cdPart?: string;
};

/** 从刮削结果 + 整理计划构建 NFO 写入上下文（单源有多少填多少） */
export function buildNfoWriteContext(input: BuildNfoCtxInput): NfoWriteContext {
  const { meta } = input;
  const posterPath = input.posterAbs ? path.basename(input.posterAbs) : undefined;
  let thumbPath = input.thumbAbs ? path.basename(input.thumbAbs) : undefined;
  if (!thumbPath && input.posterAbs) {
    const dir = path.dirname(input.posterAbs);
    const thumbCandidate = path.join(dir, "thumb.jpg");
    if (fs.existsSync(thumbCandidate)) thumbPath = "thumb.jpg";
  }

  const score10 =
    meta.score != null && Number.isFinite(meta.score)
      ? meta.score
      : meta.ratingValue != null && meta.ratingMax
        ? (meta.ratingValue / meta.ratingMax) * 10
        : null;

  return {
    mediaTitle: input.mediaTitle,
    cdPart: input.cdPart,
    hasSubtitle: input.hasSubtitle,
    resolution: input.resolution,
    mosaic: input.mosaic || meta.mosaic,
    posterPath,
    thumbPath,
    coverPath: meta.coverUrl || posterPath,
    trailerUrl: meta.trailerUrl || undefined,
    website: meta.website || undefined,
    directors: meta.directors?.length ? meta.directors : undefined,
    score: score10,
    votes: meta.votes ?? undefined,
    originalPlot:
      meta.originalPlot || (meta.plot && !meta.titleZh ? meta.plot : undefined),
    outlineFrom: meta.fieldSources?.plot || meta.fieldSources?.titleZh || undefined,
    ratingSource: meta.ratingSource,
    ratingValue: meta.ratingValue ?? undefined,
    ratingMax: meta.ratingMax,
  };
}

/** 刮削结果里实际有值的字段（供 E2E「有多少验多少」） */
export function metaCollectedFields(meta: ScrapeMeta): Record<string, boolean> {
  const hasText = (v?: string | null) => Boolean(v && String(v).trim());
  return {
    title: hasText(meta.titleZh) || hasText(meta.title),
    originaltitle: hasText(meta.title),
    sorttitle: hasText(meta.title) || hasText(meta.code),
    plot: hasText(meta.plot),
    outline: hasText(meta.plot),
    originalplot: hasText(meta.originalPlot),
    num: hasText(meta.code),
    premiered: hasText(meta.premiered),
    releasedate: hasText(meta.premiered),
    release: hasText(meta.premiered),
    actor: (meta.actors?.length ?? 0) > 0,
    director: (meta.directors?.length ?? 0) > 0,
    studio: hasText(meta.studio),
    maker: hasText(meta.studio),
    publisher: hasText(meta.publisher),
    label: hasText(meta.publisher),
    series: hasText(meta.series),
    set: hasText(meta.series),
    runtime: meta.runtime != null && meta.runtime > 0,
    year: hasText(meta.premiered?.slice(0, 4)),
    tag: (meta.genres?.length ?? 0) > 0,
    genre: (meta.genres?.length ?? 0) > 0,
    poster: Boolean(meta.coverLocal || meta.coverUrl),
    cover: hasText(meta.coverUrl),
    trailer: hasText(meta.trailerUrl),
    website: hasText(meta.website),
    rating: meta.score != null || meta.ratingValue != null,
    criticrating: meta.score != null || meta.ratingValue != null,
    ratings: meta.ratingSource != null && meta.ratingValue != null,
    votes: hasText(meta.votes),
    thumb: Boolean(meta.coverLocal || meta.coverUrl),
    source: hasText(meta.source),
  };
}

/** 从 poster 复制 thumb.jpg（仅兼容旧逻辑；整理流程应改用 processThumbImage） */
export function ensureThumbBesidePoster(posterAbs: string | null | undefined): string | null {
  if (!posterAbs || !fs.existsSync(posterAbs)) return null;
  const thumbAbs = path.join(path.dirname(posterAbs), "thumb.jpg");
  if (thumbAbs === posterAbs) return thumbAbs;
  fs.copyFileSync(posterAbs, thumbAbs);
  return thumbAbs;
}
