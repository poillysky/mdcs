import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  getAvsexRealUrl,
  matchAvsexSearchTitle,
  normalizeAvsexCode,
  pickBestAvsexImageUrl,
  parseAvsexDetailHtml,
  parseAvsexExtrafanart,
  parseAvsexMosaic,
  parseAvsexOutline,
  parseAvsexPremiered,
  parseAvsexRuntime,
  parseAvsexTitle,
} from "./avsex.js";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "../../../../../data/_debug");

const SEARCH_FIXTURE = readFileSync(join(FIX, "avsex-search-proxy_flare.html"), "utf8");
const DETAIL_FIXTURE = readFileSync(join(FIX, "avsex-detail-364579-proxy_flare.html"), "utf8");
const BASE = "https://avsex.cc";

describe("normalizeAvsexCode", () => {
  it("lowercases n#### amateur codes", () => {
    assert.equal(normalizeAvsexCode("N1234"), "n1234");
  });

  it("uppercases standard codes", () => {
    assert.equal(normalizeAvsexCode("sone-001"), "SONE-001");
  });
});

describe("matchAvsexSearchTitle", () => {
  it("matches prefix like MDCX get_real_url", () => {
    assert.equal(matchAvsexSearchTitle("SONE-001 色情又可愛的三田真鈴", "SONE-001"), true);
    assert.equal(matchAvsexSearchTitle("SONE-705 [AI解碼版]标题", "SONE-001"), false);
  });
});

describe("getAvsexRealUrl", () => {
  it("picks exact SONE-001 from live search fixture", () => {
    const hit = getAvsexRealUrl(SEARCH_FIXTURE, "SONE-001", BASE);
    assert.ok(hit);
    assert.match(hit!.detailUrl, /\/tw\/video\/detail\/364579$/);
    assert.match(hit!.posterUrl, /SONE-001-1\.jpg/);
  });
});

describe("parseAvsexRuntime", () => {
  it("parses HH:MM:SS to minutes", () => {
    assert.equal(parseAvsexRuntime("02:33:43"), 153);
  });
});

describe("parseAvsexPremiered", () => {
  it("normalizes slash dates", () => {
    assert.equal(parseAvsexPremiered("2023/12/11"), "2023-12-11");
  });
});

describe("parseAvsexTitle", () => {
  it("reads sr-only h1 from detail fixture", () => {
    const title = parseAvsexTitle(DETAIL_FIXTURE, "SONE-001");
    assert.match(title, /三田真鈴/);
    assert.doesNotMatch(title, /^SONE-001/i);
  });
});

describe("parseAvsexOutline", () => {
  it("extracts 劇情簡介 paragraph", () => {
    const plot = parseAvsexOutline(DETAIL_FIXTURE);
    assert.ok(plot.length >= 40);
    assert.match(plot, /真鈴/);
  });
});

describe("parseAvsexDetailHtml", () => {
  it("maps SONE-001 detail like live page", () => {
    const r = parseAvsexDetailHtml(DETAIL_FIXTURE, "SONE-001", BASE);
    assert.match(r.fields.title || "", /三田真鈴/);
    assert.deepEqual(r.fields.actors, ["三田真鈴"]);
    assert.equal(r.fields.studio, "エスワン ナンバーワンスタイル");
    assert.equal(r.fields.runtime, 153);
    assert.equal(r.fields.premiered, "2023-12-11");
    assert.equal(r.fields.mosaic, "有码");
    assert.ok((r.fields.genres?.length ?? 0) >= 3);
    assert.match(r.coverUrl || "", /SONE-001-2\.jpg/);
    assert.ok((r.extrafanartUrls?.length ?? 0) >= 10);
  });
});

describe("parseAvsexMosaic", () => {
  it("defaults censored for SONE-001 fixture", () => {
    assert.equal(parseAvsexMosaic(DETAIL_FIXTURE, "エスワン ナンバーワンスタイル"), "有码");
  });
});

describe("pickBestAvsexImageUrl", () => {
  it("prefers largest srcset width", () => {
    const url = pickBestAvsexImageUrl(
      "https://image.avsex.cc/films/x/0.jpg",
      "https://image.avsex.cc/films/x/responsive-images/0___media_library_original_1920_1080.jpg 1920w, https://image.avsex.cc/films/x/0.jpg 400w",
    );
    assert.match(url, /1920_1080/);
  });
});

describe("parseAvsexExtrafanart", () => {
  it("extracts 精彩劇照 images from detail fixture", () => {
    const list = parseAvsexExtrafanart(DETAIL_FIXTURE, BASE);
    assert.ok(list.length >= 10);
    assert.match(list[0] || "", /responsive-images|1968195/);
  });
});
