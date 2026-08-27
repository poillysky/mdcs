import fs from "node:fs";
import path from "node:path";
import { ensureDir } from "../paths.js";
import type { NfoMergeStrategy, ScrapeMeta } from "../scrape/types.js";
import { escapeXml, wrapCdata } from "./xml.js";
import {
  applyNfoTemplate,
  codeLetters,
  defaultNfoConfig,
  type NfoConfig,
} from "./nfoConfig.js";

export type NfoWriteContext = {
  /** 媒体库显示标题（mediaTitleTemplate） */
  mediaTitle?: string;
  /** 分集后缀，如 cd1 / CD1 */
  cdPart?: string;
  hasSubtitle?: boolean;
  resolution?: string;
  mosaic?: string;
  /** 本地海报相对文件名或 URL */
  posterPath?: string | null;
  /** 封面/thumb URL 或本地名 */
  coverPath?: string | null;
  trailerUrl?: string | null;
  website?: string | null;
  /** 导演（刮削暂无则空） */
  directors?: string[];
  /** 本地 thumb 文件名 */
  thumbPath?: string | null;
  score?: number | null;
  votes?: string | null;
  /** 嵌套 <ratings>，如 javdb */
  ratingSource?: string;
  ratingValue?: number;
  ratingMax?: number;
  country?: string;
  /** 原简介（日文等）；缺省用 meta.title 不合适，仅当另存字段时传入 */
  originalPlot?: string | null;
  /** 翻译来源展示名 */
  outlineFrom?: string | null;
};

export type NfoOptions = {
  writeActors?: boolean;
  writeGenres?: boolean;
  mergeStrategy?: NfoMergeStrategy;
  mediaTitle?: string;
  /** 完整 NFO 配置；缺省用 default */
  nfo?: NfoConfig;
  ctx?: NfoWriteContext;
};

function tag(name: string, value: string | number | null | undefined): string {
  if (value === undefined || value === null || value === "") return "";
  return `  <${name}>${escapeXml(String(value))}</${name}>\n`;
}

function textOrCdata(name: string, value: string, noCdata: boolean): string {
  if (!value) return "";
  if (noCdata) return tag(name, value.replace(/\n/g, "")).trimEnd() + "\n";
  return `  <${name}>${wrapCdata(value)}</${name}>\n`;
}

function pickXmlTag(xml: string, name: string): string {
  const cdata = xml.match(new RegExp(`<${name}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${name}>`, "i"));
  if (cdata?.[1] != null) return cdata[1].trim();
  const plain = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i"));
  return plain?.[1]?.replace(/<[^>]+>/g, "").trim() || "";
}

function pickXmlActors(xml: string): string[] {
  const out: string[] = [];
  for (const m of xml.matchAll(/<actor>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/actor>/gi)) {
    const name = m[1]?.replace(/<[^>]+>/g, "").trim();
    if (name) out.push(name);
  }
  return out;
}

function pickXmlGenres(xml: string): string[] {
  const out: string[] = [];
  for (const m of xml.matchAll(/<genre>([\s\S]*?)<\/genre>/gi)) {
    const g = m[1]?.replace(/<[^>]+>/g, "").trim();
    if (g) out.push(g);
  }
  return out;
}

/** 从已有 NFO 抽取可合并字段 */
export function parseExistingNfo(xml: string): Partial<ScrapeMeta> {
  return {
    title: pickXmlTag(xml, "originaltitle") || pickXmlTag(xml, "title") || undefined,
    titleZh: pickXmlTag(xml, "title") || undefined,
    plot: pickXmlTag(xml, "plot") || pickXmlTag(xml, "outline") || undefined,
    premiered: pickXmlTag(xml, "premiered") || pickXmlTag(xml, "releasedate") || undefined,
    studio: pickXmlTag(xml, "studio") || undefined,
    publisher: pickXmlTag(xml, "publisher") || undefined,
    series: pickXmlTag(xml, "series") || pickXmlTag(xml, "set") || undefined,
    runtime: Number(pickXmlTag(xml, "runtime")) || null,
    actors: pickXmlActors(xml),
    genres: pickXmlGenres(xml),
  };
}

function isEmpty(v: unknown): boolean {
  if (v === undefined || v === null || v === "") return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

/**
 * prefer_scraped：刮削覆盖本地（缺省）
 * prefer_nfo：本地 NFO 非空字段优先，刮削只补空
 */
export function mergeMetaForNfo(
  scraped: ScrapeMeta,
  existingXml: string | null,
  strategy: NfoMergeStrategy = "prefer_scraped",
): ScrapeMeta {
  if (!existingXml || strategy === "prefer_scraped") return scraped;
  const local = parseExistingNfo(existingXml);
  const pick = <K extends keyof ScrapeMeta>(key: K): ScrapeMeta[K] => {
    const localVal = local[key as keyof typeof local];
    const scrapedVal = scraped[key];
    if (!isEmpty(localVal)) return localVal as ScrapeMeta[K];
    return scrapedVal;
  };
  return {
    ...scraped,
    title: (pick("title") as string) || scraped.title,
    titleZh: pick("titleZh") as string | undefined,
    plot: pick("plot") as string | undefined,
    premiered: pick("premiered") as string | undefined,
    studio: pick("studio") as string | undefined,
    publisher: pick("publisher") as string | undefined,
    series: pick("series") as string | undefined,
    runtime: (pick("runtime") as number | null | undefined) ?? scraped.runtime,
    actors: (pick("actors") as string[]) || scraped.actors,
    genres: (pick("genres") as string[]) || scraped.genres,
    directors: (pick("directors") as string[] | undefined) || scraped.directors,
    trailerUrl: (pick("trailerUrl") as string | undefined) || scraped.trailerUrl,
    website: (pick("website") as string | undefined) || scraped.website,
    score: (pick("score") as number | null | undefined) ?? scraped.score,
    ratingValue: (pick("ratingValue") as number | null | undefined) ?? scraped.ratingValue,
    ratingMax: (pick("ratingMax") as number | undefined) || scraped.ratingMax,
    ratingSource: (pick("ratingSource") as string | undefined) || scraped.ratingSource,
    votes: (pick("votes") as string | null | undefined) ?? scraped.votes,
    originalPlot: (pick("originalPlot") as string | undefined) || scraped.originalPlot,
  };
}

function buildExtraTags(
  meta: ScrapeMeta,
  nfo: NfoConfig,
  ctx: NfoWriteContext,
): string[] {
  const extras: string[] = [];
  const te = nfo.tagExtras;
  const fmt = nfo.tagFormats;
  const vars = {
    series: meta.series || "",
    studio: meta.studio || "",
    publisher: meta.publisher || "",
    release: meta.premiered || "",
    actor: (meta.actors || [])[0] || "",
  };
  if (te.letters) {
    const letters = codeLetters(meta.code);
    if (letters) extras.push(letters);
  }
  if (te.actor) {
    for (const a of meta.actors || []) {
      if (a) extras.push(a);
    }
  }
  if (te.definition && ctx.resolution) extras.push(ctx.resolution);
  if (te.cnword && ctx.hasSubtitle) {
    const t = applyNfoTemplate(fmt.cnword, vars).trim() || "中文字幕";
    extras.push(t);
  }
  if (te.mosaic) {
    const m = (ctx.mosaic || meta.mosaic || "").trim();
    if (m) extras.push(m);
  }
  if (te.series && meta.series) {
    extras.push(applyNfoTemplate(fmt.series, vars).trim() || meta.series);
  }
  if (te.studio && meta.studio) {
    extras.push(applyNfoTemplate(fmt.studio, vars).trim() || meta.studio);
  }
  if (te.publisher && meta.publisher) {
    extras.push(applyNfoTemplate(fmt.publisher, vars).trim() || meta.publisher);
  }
  return extras;
}

function uniqTags(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of list) {
    const s = t.trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/** Emby/Jellyfin/Kodi 兼容 movie.nfo */
export function buildMovieNfo(meta: ScrapeMeta, opts: NfoOptions = {}): string {
  const nfo = opts.nfo ?? defaultNfoConfig();
  const inc = nfo.include;
  const ctx: NfoWriteContext = {
    mediaTitle: opts.mediaTitle,
    ...(opts.ctx || {}),
  };

  // 任务级旧开关兼容
  const writeActors = opts.writeActors === false ? false : inc.actor;
  const writeGenres = opts.writeGenres === false ? false : true;

  let plotText = meta.plot || "";
  const originalPlot = (ctx.originalPlot || meta.originalPlot || "").trim();
  if (inc.outlineShowFrom && ctx.outlineFrom) {
    plotText = plotText
      ? `${plotText}\n\n由 ${ctx.outlineFrom} 提供翻译`
      : `由 ${ctx.outlineFrom} 提供翻译`;
  }

  let displayTitle = (ctx.mediaTitle || opts.mediaTitle || "").trim() || meta.titleZh || meta.title || meta.code;
  const cd = (ctx.cdPart || "").replace(/^[-_\s]+/, "").toUpperCase();
  if (inc.titleCd && cd) displayTitle = `${displayTitle} ${cd}`.trim();

  const release = meta.premiered || "";
  const year = release.slice(0, 4);
  const country = ctx.country || "JP";
  const letters = codeLetters(meta.code);

  const tagList = uniqTags([
    ...(writeGenres ? meta.genres || [] : []),
    ...buildExtraTags(meta, nfo, ctx),
  ]);

  const lines: string[] = [
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`,
    `<movie>`,
  ];

  lines.push(tag("title", displayTitle).trimEnd());

  if (inc.originaltitle) {
    const originalTitle =
      meta.code && meta.title && meta.code !== meta.title
        ? `${meta.code} ${meta.title}`
        : meta.title || meta.code;
    lines.push(tag("originaltitle", originalTitle).trimEnd());
  }
  if (inc.sorttitle) {
    const sort =
      meta.code && meta.title && meta.code !== meta.title
        ? `${meta.code} ${meta.title}`
        : meta.code || meta.title;
    lines.push(tag("sorttitle", sort).trimEnd());
  }

  if (plotText) {
    if (inc.plot) lines.push(textOrCdata("plot", plotText, inc.outlineNoCdata).trimEnd());
    if (inc.outline) lines.push(textOrCdata("outline", plotText, inc.outlineNoCdata).trimEnd());
  }
  if (originalPlot && inc.originalplot) {
    lines.push(textOrCdata("originalplot", originalPlot, inc.outlineNoCdata).trimEnd());
  }

  if (release) {
    const tagline = applyNfoTemplate(nfo.tagline, { release, series: meta.series || "", studio: meta.studio || "" }).trim();
    if (tagline) lines.push(tag("tagline", tagline).trimEnd());
    if (inc.premiered) lines.push(tag("premiered", release).trimEnd());
    if (inc.releasedate) lines.push(tag("releasedate", release).trimEnd());
    if (inc.release) lines.push(tag("release", release).trimEnd());
  }

  lines.push(tag("num", meta.code).trimEnd());
  lines.push(`  <uniqueid type="num" default="true">${escapeXml(meta.code)}</uniqueid>`);

  if (inc.country) lines.push(tag("countrycode", country).trimEnd());
  if (inc.mpaa) lines.push(tag("mpaa", country === "JP" ? "JP-18+" : "NC-17").trimEnd());
  if (inc.customrating) {
    lines.push(tag("customrating", country === "JP" ? "JP-18+" : "NC-17").trimEnd());
  }

  if (writeActors) {
    for (const name of meta.actors ?? []) {
      lines.push(`  <actor>`);
      lines.push(`    <name>${escapeXml(name)}</name>`);
      const url = meta.actorUrls?.[name];
      if (url) lines.push(`    <url>${escapeXml(url)}</url>`);
      lines.push(`    <type>Actor</type>`);
      lines.push(`  </actor>`);
    }
  }

  const directors = ctx.directors?.length ? ctx.directors : meta.directors;
  if (inc.director) {
    for (const d of directors || []) {
      if (d) lines.push(tag("director", d).trimEnd());
    }
  }

  if (ctx.score != null && Number.isFinite(ctx.score)) {
    const ratingText = Number(ctx.score.toFixed(1)).toString();
    if (inc.score) lines.push(tag("rating", ratingText).trimEnd());
    if (inc.criticrating) lines.push(tag("criticrating", Math.round(ctx.score * 10)).trimEnd());
  }
  if (
    inc.score &&
    ctx.ratingSource &&
    ctx.ratingValue != null &&
    Number.isFinite(ctx.ratingValue)
  ) {
    const max = ctx.ratingMax && ctx.ratingMax > 0 ? ctx.ratingMax : 5;
    const val = Number(ctx.ratingValue.toFixed(2));
    lines.push(`  <ratings>`);
    lines.push(
      `    <rating name="${escapeXml(ctx.ratingSource)}" max="${max}" default="true">`,
    );
    lines.push(`      <value>${val}</value>`);
    lines.push(`      <votes>${ctx.votes ? escapeXml(String(ctx.votes)) : ""}</votes>`);
    lines.push(`    </rating>`);
    lines.push(`  </ratings>`);
  }
  if (inc.votes) {
    if (ctx.votes) lines.push(tag("votes", ctx.votes).trimEnd());
    else if (ctx.ratingSource) lines.push(`  <votes/>`);
  }
  if (inc.year && year) lines.push(tag("year", year).trimEnd());
  if (inc.runtime && meta.runtime != null) lines.push(tag("runtime", meta.runtime).trimEnd());

  if (inc.actorSet) {
    for (const name of meta.actors || []) {
      if (!name) continue;
      lines.push(`  <set>`);
      lines.push(`    <name>${escapeXml(name)}</name>`);
      lines.push(`  </set>`);
    }
  }
  if (inc.seriesSet && meta.series) {
    lines.push(`  <set>`);
    lines.push(`    <name>${escapeXml(meta.series)}</name>`);
    lines.push(`  </set>`);
  }
  if (inc.prefixSet && letters) {
    lines.push(`  <set>`);
    lines.push(`    <name>${escapeXml(letters)}</name>`);
    lines.push(`  </set>`);
  }

  if (inc.series && meta.series) lines.push(tag("series", meta.series).trimEnd());
  if (meta.studio) {
    if (inc.studio) lines.push(tag("studio", meta.studio).trimEnd());
    if (inc.maker) lines.push(tag("maker", meta.studio).trimEnd());
  }
  if (meta.publisher) {
    if (inc.publisher) lines.push(tag("publisher", meta.publisher).trimEnd());
    if (inc.label) lines.push(tag("label", meta.publisher).trimEnd());
  }

  if (inc.tag) {
    for (const t of tagList) lines.push(tag("tag", t).trimEnd());
  }
  if (inc.genre && writeGenres) {
    for (const t of tagList) lines.push(tag("genre", t).trimEnd());
  }

  const poster = ctx.posterPath || null;
  const thumb = ctx.thumbPath || null;
  const cover = ctx.coverPath || meta.coverUrl || null;
  if (inc.poster && poster) lines.push(tag("poster", poster).trimEnd());
  if (inc.poster && thumb) lines.push(tag("thumb", thumb).trimEnd());
  if (inc.poster && poster) lines.push(`  <fanart/>`);
  if (inc.cover && cover) lines.push(tag("cover", cover).trimEnd());
  const trailer = ctx.trailerUrl || meta.trailerUrl;
  if (inc.trailer && trailer) lines.push(tag("trailer", trailer).trimEnd());
  const website = ctx.website || meta.website;
  if (inc.website && website) lines.push(tag("website", website).trimEnd());

  lines.push(tag("source", meta.source).trimEnd());
  lines.push(`</movie>`);
  return `${lines.filter(Boolean).join("\n")}\n`;
}

export function writeMovieNfo(
  nfoAbs: string,
  meta: ScrapeMeta,
  opts: NfoOptions = {},
  dryRun = false,
): void {
  const nfoCfg = opts.nfo ?? defaultNfoConfig();
  if (!nfoCfg.enabled) return;

  const mergeStrategy = opts.mergeStrategy ?? nfoCfg.mergeStrategy ?? "prefer_scraped";
  let existing: string | null = null;
  if (mergeStrategy === "prefer_nfo" && fs.existsSync(nfoAbs)) {
    try {
      existing = fs.readFileSync(nfoAbs, "utf8");
    } catch {
      existing = null;
    }
  }
  const merged = mergeMetaForNfo(meta, existing, mergeStrategy);
  const xml = buildMovieNfo(merged, { ...opts, nfo: nfoCfg, mergeStrategy });
  if (dryRun) return;
  ensureDir(path.dirname(nfoAbs));
  fs.writeFileSync(nfoAbs, xml, "utf8");
}
