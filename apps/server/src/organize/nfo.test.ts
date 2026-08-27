import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMovieNfo } from "./nfo.js";
import { defaultNfoConfig } from "./nfoConfig.js";
import type { ScrapeMeta } from "../scrape/types.js";

const baseMeta: ScrapeMeta = {
  code: "SONE-001",
  kind: "japan_censored",
  title: "エロめっちゃ可愛い三田真鈴の初・体・験3本番",
  titleZh: "淫荡超可爱的三田真铃初・体・験3本番",
  plot: "中文简介",
  originalPlot: "日文あらすじ",
  actors: ["三田真鈴"],
  genres: ["巨乳"],
  studio: "S1 NO.1 STYLE",
  premiered: "2023-12-08",
  source: "dmm",
  sourcesTried: ["dmm"],
  fieldSources: {},
  fieldTimings: [],
  scrapedAt: "",
  ok: true,
};

describe("buildMovieNfo MDCX alignment", () => {
  it("title prefers titleZh for Emby display", () => {
    const xml = buildMovieNfo(baseMeta, { nfo: defaultNfoConfig() });
    assert.match(xml, /<title>淫荡超可爱的三田真铃/);
  });

  it("originaltitle includes code prefix + Japanese title", () => {
    const xml = buildMovieNfo(baseMeta, { nfo: defaultNfoConfig() });
    assert.match(xml, /<originaltitle>SONE-001 エロめっちゃ可愛い/);
    assert.match(xml, /<sorttitle>SONE-001 エロめっちゃ可愛い/);
  });

  it("writes plot outline and originalplot when present", () => {
    const xml = buildMovieNfo(baseMeta, { nfo: defaultNfoConfig() });
    assert.match(xml, /<plot>/);
    assert.match(xml, /<outline>/);
    assert.match(xml, /<originalplot>/);
    assert.match(xml, /日文あらすじ/);
  });
});
