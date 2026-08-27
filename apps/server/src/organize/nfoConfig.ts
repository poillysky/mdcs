/** NFO 字段开关与标签附加（对齐 MDC 设置·NFO） */

export type NfoMergeStrategy = "prefer_nfo" | "prefer_scraped";

/** 写入哪些 NFO 节点 */
export type NfoIncludeFlags = {
  sorttitle: boolean;
  originaltitle: boolean;
  /** 标题后追加分集 CD1 等 */
  titleCd: boolean;
  outline: boolean;
  plot: boolean;
  originalplot: boolean;
  /** 简介不用 CDATA（纯文本转义） */
  outlineNoCdata: boolean;
  /** 简介末尾追加「由 xxx 提供翻译」类来源（有 fieldSources.plot 时） */
  outlineShowFrom: boolean;
  release: boolean;
  releasedate: boolean;
  premiered: boolean;
  actor: boolean;
  director: boolean;
  country: boolean;
  mpaa: boolean;
  customrating: boolean;
  year: boolean;
  runtime: boolean;
  votes: boolean;
  score: boolean;
  criticrating: boolean;
  series: boolean;
  tag: boolean;
  /** genre 使用与 tag 相同的标签列表 */
  genre: boolean;
  studio: boolean;
  maker: boolean;
  publisher: boolean;
  label: boolean;
  poster: boolean;
  cover: boolean;
  trailer: boolean;
  website: boolean;
  /** <set> 用演员名 */
  actorSet: boolean;
  /** <set> 用系列 */
  seriesSet: boolean;
  /** <set> 用番号前缀 */
  prefixSet: boolean;
};

/** 附加到 <tag>/<genre> 的衍生内容 */
export type NfoTagExtraFlags = {
  letters: boolean;
  actor: boolean;
  definition: boolean;
  cnword: boolean;
  mosaic: boolean;
  series: boolean;
  studio: boolean;
  publisher: boolean;
};

export type NfoTagFormats = {
  cnword: string;
  series: string;
  studio: string;
  publisher: string;
};

export type NfoConfig = {
  enabled: boolean;
  mergeStrategy: NfoMergeStrategy;
  include: NfoIncludeFlags;
  tagExtras: NfoTagExtraFlags;
  tagline: string;
  tagFormats: NfoTagFormats;
};

export function defaultNfoInclude(): NfoIncludeFlags {
  return {
    sorttitle: true,
    originaltitle: true,
    titleCd: false,
    outline: true,
    plot: true,
    originalplot: true,
    outlineNoCdata: false,
    outlineShowFrom: false,
    release: true,
    releasedate: true,
    premiered: true,
    actor: true,
    director: true,
    country: true,
    mpaa: true,
    customrating: true,
    year: true,
    runtime: true,
    votes: true,
    score: true,
    criticrating: true,
    series: true,
    tag: true,
    genre: true,
    studio: true,
    maker: true,
    publisher: true,
    label: true,
    poster: true,
    cover: true,
    trailer: true,
    website: true,
    actorSet: false,
    seriesSet: true,
    prefixSet: false,
  };
}

export function defaultNfoTagExtras(): NfoTagExtraFlags {
  return {
    letters: true,
    actor: true,
    definition: true,
    cnword: true,
    mosaic: true,
    series: true,
    studio: true,
    publisher: true,
  };
}

export function defaultNfoTagFormats(): NfoTagFormats {
  return {
    cnword: "中文字幕",
    series: "系列: {series}",
    studio: "片商: {studio}",
    publisher: "发行: {publisher}",
  };
}

export function defaultNfoConfig(): NfoConfig {
  return {
    enabled: true,
    mergeStrategy: "prefer_scraped",
    include: defaultNfoInclude(),
    tagExtras: defaultNfoTagExtras(),
    tagline: "发行日期: {release}",
    tagFormats: defaultNfoTagFormats(),
  };
}

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function asStr(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

export function normalizeNfoConfig(raw: unknown, mergeFallback: NfoMergeStrategy = "prefer_scraped"): NfoConfig {
  const base = defaultNfoConfig();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...base, mergeStrategy: mergeFallback };
  }
  const o = raw as Record<string, unknown>;
  const incRaw = o.include && typeof o.include === "object" && !Array.isArray(o.include)
    ? (o.include as Record<string, unknown>)
    : {};
  const teRaw = o.tagExtras && typeof o.tagExtras === "object" && !Array.isArray(o.tagExtras)
    ? (o.tagExtras as Record<string, unknown>)
    : {};
  const tfRaw = o.tagFormats && typeof o.tagFormats === "object" && !Array.isArray(o.tagFormats)
    ? (o.tagFormats as Record<string, unknown>)
    : {};

  const include = { ...base.include };
  for (const k of Object.keys(include) as (keyof NfoIncludeFlags)[]) {
    include[k] = asBool(incRaw[k], include[k]);
  }

  const tagExtras = { ...base.tagExtras };
  for (const k of Object.keys(tagExtras) as (keyof NfoTagExtraFlags)[]) {
    tagExtras[k] = asBool(teRaw[k], tagExtras[k]);
  }

  const tagFormats: NfoTagFormats = {
    cnword: asStr(tfRaw.cnword, base.tagFormats.cnword),
    series: asStr(tfRaw.series, base.tagFormats.series),
    studio: asStr(tfRaw.studio, base.tagFormats.studio),
    publisher: asStr(tfRaw.publisher, base.tagFormats.publisher),
  };

  const merge =
    o.mergeStrategy === "prefer_nfo" || o.mergeStrategy === "prefer_scraped"
      ? o.mergeStrategy
      : mergeFallback;

  return {
    enabled: asBool(o.enabled, base.enabled),
    mergeStrategy: merge,
    include,
    tagExtras,
    tagline: asStr(o.tagline, base.tagline),
    tagFormats,
  };
}

/** 简单 `{field}` 替换；缺字段则空串 */
export function applyNfoTemplate(tpl: string, vars: Record<string, string>): string {
  return String(tpl || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => vars[key] ?? "");
}

export function codeLetters(code: string): string {
  const m = String(code || "")
    .trim()
    .toUpperCase()
    .match(/^([A-Z]+)/);
  return m?.[1] || "";
}
