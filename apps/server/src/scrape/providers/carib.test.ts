import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  caribCoverUrl,
  caribDetailUrl,
  isCaribDetailHtml,
  parseCaribActors,
  parseCaribDetailHtml,
  parseCaribExtrafanart,
  parseCaribGenres,
  parseCaribIsoDuration,
  parseCaribMovieKey,
  parseCaribPlot,
  parseCaribPremieredFromKey,
  parseCaribRating,
  parseCaribTrailer,
} from "./carib.js";

const FIXTURE = fs.readFileSync(
  path.join(import.meta.dirname, "../../../../../data/_debug/carib-detail-010117-339.html"),
  "utf8",
);
const BASE = "https://www.caribbeancom.com";
const CODE = "CARIB-010117-339";
const KEY = "010117-339";
const DETAIL = caribDetailUrl(BASE, KEY);

describe("parseCaribMovieKey", () => {
  it("strips CARIB prefix", () => {
    assert.equal(parseCaribMovieKey("CARIB-010117-339"), KEY);
    assert.equal(parseCaribMovieKey("010117-339"), KEY);
  });

  it("rejects invalid codes", () => {
    assert.equal(parseCaribMovieKey("SONE-001"), null);
  });
});

describe("parseCaribPremieredFromKey", () => {
  it("derives date from MMDDYY", () => {
    assert.equal(parseCaribPremieredFromKey(KEY), "2017-01-01");
  });
});

describe("parseCaribIsoDuration", () => {
  it("parses ISO8601 duration", () => {
    assert.equal(parseCaribIsoDuration("T01H01M52S"), 62);
  });
});

describe("caribDetailUrl", () => {
  it("builds moviepages path", () => {
    assert.equal(DETAIL, `${BASE}/moviepages/${KEY}/index.html`);
    assert.match(caribCoverUrl(BASE, KEY), /l_l\.jpg$/);
  });
});

describe("isCaribDetailHtml", () => {
  it("accepts fixture", () => {
    assert.equal(isCaribDetailHtml(FIXTURE, KEY), true);
  });
});

describe("parseCaribPlot", () => {
  it("reads itemprop description", () => {
    const plot = parseCaribPlot(FIXTURE);
    assert.ok(plot.length >= 20);
  });
});

describe("parseCaribTrailer", () => {
  it("reads sample_flash_url", () => {
    const url = parseCaribTrailer(FIXTURE);
    assert.match(url || "", /smovie\.caribbeancom\.com\/sample\/movies\/010117-339\/480p\.mp4/);
  });
});

describe("parseCaribActors", () => {
  it("reads only main cast row", () => {
    const actors = parseCaribActors(FIXTURE);
    assert.equal(actors.length, 1);
  });
});

describe("parseCaribGenres", () => {
  it("reads itemprop genre tags", () => {
    const genres = parseCaribGenres(FIXTURE);
    assert.ok(genres.length >= 5);
  });
});

describe("parseCaribExtrafanart", () => {
  it("collects gallery large images", () => {
    const urls = parseCaribExtrafanart(FIXTURE, DETAIL);
    assert.ok(urls.length >= 5);
    assert.match(urls[0]!, /\/images\/l\/001\.jpg$/);
  });
});

describe("parseCaribRating", () => {
  it("counts star glyphs", () => {
    const r = parseCaribRating(FIXTURE);
    assert.equal(r?.ratingValue, 5);
    assert.equal(r?.ratingMax, 5);
  });
});

describe("parseCaribDetailHtml", () => {
  it("maps CARIB-010117-339 fixture", () => {
    const r = parseCaribDetailHtml(FIXTURE, DETAIL, CODE);
    assert.ok(r);
    assert.ok(r!.fields.title && r!.fields.title!.length >= 4);
    assert.equal(r!.fields.studio, "カリビアンコム");
    assert.equal(r!.fields.premiered, "2017-01-01");
    assert.equal(r!.fields.runtime, 62);
    assert.equal(r!.fields.actors!.length, 1);
    assert.ok(r!.fields.genres!.length >= 5);
    assert.ok(r!.fields.series);
    assert.ok(r!.fields.plot && r!.fields.plot.length >= 20);
    assert.equal(r!.fields.ratingValue, 5);
    assert.equal(r!.fields.website, DETAIL);
    assert.match(r!.coverUrl || "", /010117-339\/images\/l_l\.jpg$/);
    assert.ok(r!.extrafanartUrls!.length >= 5);
  });
});
