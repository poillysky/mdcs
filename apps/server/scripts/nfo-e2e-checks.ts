import type { NfoConfig } from "../src/organize/nfoConfig.js";
import { metaCollectedFields } from "../src/organize/nfoCtx.js";
import type { ScrapeMeta } from "../src/scrape/types.js";

export type NfoFieldCheck = {
  id: string;
  label: string;
  /** 是否参与「必须通过」判定 */
  required: boolean;
  ok: boolean;
  note?: string;
};

function hasTag(xml: string, tag: string): boolean {
  return new RegExp(`<${tag}(\\s|>|/)`).test(xml);
}

function tagHasText(xml: string, tag: string): boolean {
  const cdata = xml.match(new RegExp(`<${tag}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, "i"));
  if (cdata?.[1]?.trim()) return true;
  const plain = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return Boolean(plain?.[1]?.replace(/<[^>]+>/g, "").trim());
}

/**
 * 按 scrape.json → nfo.include 检查 NFO 节点。
 * 传入 collected 时：仅对刮削结果里「有值」的字段做必过判定（有多少验多少）。
 */
export function checkNfoFields(
  nfoText: string,
  code: string,
  nfoCfg: NfoConfig,
  collected?: Record<string, boolean>,
): NfoFieldCheck[] {
  const inc = nfoCfg.include;
  const checks: NfoFieldCheck[] = [];

  const add = (
    id: string,
    label: string,
    ok: boolean,
    enabled = true,
    note?: string,
  ) => {
    if (!enabled) return;
    const required = collected ? collected[id] === true : id === "title" || id === "num";
    checks.push({ id, label, required, ok, note });
  };

  add("title", "title", tagHasText(nfoText, "title"));
  add("originaltitle", "originaltitle", tagHasText(nfoText, "originaltitle"), inc.originaltitle);
  add("sorttitle", "sorttitle", tagHasText(nfoText, "sorttitle"), inc.sorttitle);
  add("plot", "plot", tagHasText(nfoText, "plot"), inc.plot);
  add("outline", "outline", tagHasText(nfoText, "outline"), inc.outline);
  add("originalplot", "originalplot", tagHasText(nfoText, "originalplot"), inc.originalplot);

  add("num", "num", nfoText.includes(`<num>${code}</num>`));
  add("uniqueid", "uniqueid", /<uniqueid[^>]*type=["']num["']/i.test(nfoText));

  add("tagline", "tagline", tagHasText(nfoText, "tagline"), Boolean(nfoCfg.tagline?.trim()));
  add("premiered", "premiered", tagHasText(nfoText, "premiered"), inc.premiered);
  add("releasedate", "releasedate", tagHasText(nfoText, "releasedate"), inc.releasedate);
  add("release", "release", tagHasText(nfoText, "release"), inc.release);

  add("countrycode", "countrycode", tagHasText(nfoText, "countrycode"), inc.country);
  add("mpaa", "mpaa", tagHasText(nfoText, "mpaa"), inc.mpaa);
  add("customrating", "customrating", tagHasText(nfoText, "customrating"), inc.customrating);

  add("actor", "actor", /<actor>[\s\S]*?<name>/i.test(nfoText), inc.actor);
  add("director", "director", tagHasText(nfoText, "director"), inc.director);

  add("year", "year", tagHasText(nfoText, "year"), inc.year);
  add("runtime", "runtime", tagHasText(nfoText, "runtime"), inc.runtime);

  add("rating", "rating", tagHasText(nfoText, "rating"), inc.score);
  add("criticrating", "criticrating", tagHasText(nfoText, "criticrating"), inc.criticrating);
  add("ratings", "ratings", hasTag(nfoText, "ratings"), inc.score);
  add("votes", "votes", hasTag(nfoText, "votes"), inc.votes);

  add("set", "set", hasTag(nfoText, "set"), inc.seriesSet);
  add("series", "series", tagHasText(nfoText, "series"), inc.series);

  add("studio", "studio", tagHasText(nfoText, "studio"), inc.studio);
  add("maker", "maker", tagHasText(nfoText, "maker"), inc.maker);
  add("publisher", "publisher", tagHasText(nfoText, "publisher"), inc.publisher);
  add("label", "label", tagHasText(nfoText, "label"), inc.label);

  add("tag", "tag", hasTag(nfoText, "tag"), inc.tag);
  add("genre", "genre", hasTag(nfoText, "genre"), inc.genre);

  add("poster", "poster", tagHasText(nfoText, "poster"), inc.poster);
  add("thumb", "thumb", tagHasText(nfoText, "thumb"), inc.poster);
  add("fanart", "fanart", hasTag(nfoText, "fanart"), inc.poster);
  add("cover", "cover", tagHasText(nfoText, "cover"), inc.cover);
  add("trailer", "trailer", tagHasText(nfoText, "trailer"), inc.trailer);
  add("website", "website", tagHasText(nfoText, "website"), inc.website);

  add("source", "source", tagHasText(nfoText, "source"));

  return checks;
}

export function summarizeNfoChecks(checks: NfoFieldCheck[]): {
  requiredOk: boolean;
  required: NfoFieldCheck[];
  optionalPresent: NfoFieldCheck[];
  optionalMissing: NfoFieldCheck[];
  collectedCount: number;
  nfoWrittenOk: NfoFieldCheck[];
  nfoWrittenFail: NfoFieldCheck[];
} {
  const required = checks.filter((c) => c.required);
  const optional = checks.filter((c) => !c.required);
  const nfoWrittenOk = checks.filter((c) => c.ok);
  const nfoWrittenFail = checks.filter((c) => !c.ok);
  return {
    requiredOk: required.every((c) => c.ok),
    required,
    optionalPresent: optional.filter((c) => c.ok),
    optionalMissing: optional.filter((c) => !c.ok),
    collectedCount: required.length,
    nfoWrittenOk,
    nfoWrittenFail,
  };
}

/** UI nfo.include 开启的字段清单（id → 中文标签） */
export const NFO_FIELD_LABELS: Record<string, string> = {
  title: "title",
  originaltitle: "originaltitle",
  sorttitle: "sorttitle",
  plot: "plot",
  outline: "outline",
  originalplot: "originalplot",
  num: "num",
  uniqueid: "uniqueid",
  tagline: "tagline",
  premiered: "premiered",
  releasedate: "releasedate",
  release: "release",
  countrycode: "countrycode",
  mpaa: "mpaa",
  customrating: "customrating",
  actor: "actor",
  director: "director",
  year: "year",
  runtime: "runtime",
  rating: "rating",
  criticrating: "criticrating",
  ratings: "ratings(javdb)",
  votes: "votes",
  set: "set",
  series: "series",
  studio: "studio",
  maker: "maker",
  publisher: "publisher",
  label: "label",
  tag: "tag",
  genre: "genre",
  poster: "poster",
  thumb: "thumb",
  fanart: "fanart",
  cover: "cover",
  trailer: "trailer",
  website: "website",
  source: "source",
};

/** 按 nfo.include 列出应关注的字段 id */
export function enabledNfoFieldIds(nfoCfg: NfoConfig): string[] {
  const inc = nfoCfg.include;
  const ids: string[] = ["title", "num", "uniqueid", "source"];
  if (inc.originaltitle) ids.push("originaltitle");
  if (inc.sorttitle) ids.push("sorttitle");
  if (inc.plot) ids.push("plot");
  if (inc.outline) ids.push("outline");
  if (inc.originalplot) ids.push("originalplot");
  if (nfoCfg.tagline?.trim()) ids.push("tagline");
  if (inc.premiered) ids.push("premiered");
  if (inc.releasedate) ids.push("releasedate");
  if (inc.release) ids.push("release");
  if (inc.country) ids.push("countrycode");
  if (inc.mpaa) ids.push("mpaa");
  if (inc.customrating) ids.push("customrating");
  if (inc.actor) ids.push("actor");
  if (inc.director) ids.push("director");
  if (inc.year) ids.push("year");
  if (inc.runtime) ids.push("runtime");
  if (inc.score) ids.push("rating", "ratings");
  if (inc.criticrating) ids.push("criticrating");
  if (inc.votes) ids.push("votes");
  if (inc.seriesSet) ids.push("set");
  if (inc.series) ids.push("series");
  if (inc.studio) ids.push("studio");
  if (inc.maker) ids.push("maker");
  if (inc.publisher) ids.push("publisher");
  if (inc.label) ids.push("label");
  if (inc.tag) ids.push("tag");
  if (inc.genre) ids.push("genre");
  if (inc.poster) ids.push("poster", "thumb", "fanart");
  if (inc.cover) ids.push("cover");
  if (inc.trailer) ids.push("trailer");
  if (inc.website) ids.push("website");
  return [...new Set(ids)];
}

/** 由 NFO 生成器/config 推导、不依赖站点刮削的字段 */
const SCRAPE_DERIVED_FIELDS = new Set([
  "uniqueid",
  "tagline",
  "countrycode",
  "mpaa",
  "customrating",
  "year",
  "source",
  "fanart",
]);

/** 单源刮削：哪些字段有值 / 哪些未采集 */
export function scrapeFieldGapReport(
  meta: ScrapeMeta,
  nfoCfg: NfoConfig,
): {
  enabled: string[];
  collected: string[];
  notCollected: string[];
  derived: string[];
  collectedLabels: string[];
  notCollectedLabels: string[];
  derivedLabels: string[];
} {
  const enabled = enabledNfoFieldIds(nfoCfg);
  const flags = metaCollectedFields(meta);
  const label = (id: string) => NFO_FIELD_LABELS[id] || id;
  const derived = enabled.filter((id) => SCRAPE_DERIVED_FIELDS.has(id));
  const needsScrape = enabled.filter((id) => !SCRAPE_DERIVED_FIELDS.has(id));
  const collected = needsScrape.filter((id) => flags[id]);
  const notCollected = needsScrape.filter((id) => !flags[id]);
  return {
    enabled,
    collected,
    notCollected,
    derived,
    collectedLabels: collected.map(label),
    notCollectedLabels: notCollected.map(label),
    derivedLabels: derived.map(label),
  };
}

export function printFieldGapReport(
  source: string,
  meta: ScrapeMeta,
  nfoCfg: NfoConfig,
  summary: ReturnType<typeof summarizeNfoChecks>,
): void {
  const gap = scrapeFieldGapReport(meta, nfoCfg);
  const scrapeTotal = gap.collected.length + gap.notCollected.length;
  console.log(`\n=== ${source} 字段清单 (${meta.code}) ===`);
  console.log(`刮削采集: ${gap.collected.length}/${scrapeTotal}（不含生成器推导项）`);
  console.log(`  ✓ 已采集: ${gap.collectedLabels.join(", ") || "(无)"}`);
  console.log(`  ✗ 未采集: ${gap.notCollectedLabels.join(", ") || "(无)"}`);
  if (gap.derivedLabels.length) {
    console.log(`  ○ 生成器推导: ${gap.derivedLabels.join(", ")}`);
  }
  console.log(
    `NFO 写入: 已采集项 ${summary.requiredOk ? "全部通过" : "有缺失"} (${summary.nfoWrittenOk.filter((c) => c.required).length}/${summary.required.length} 必过)`,
  );
  const nfoFailCollected = summary.required.filter((c) => !c.ok);
  if (nfoFailCollected.length) {
    console.log(`  ✗ 已采集但未写入 NFO: ${nfoFailCollected.map((c) => c.label).join(", ")}`);
  }
}
