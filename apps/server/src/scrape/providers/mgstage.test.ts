import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  extractMgstageSamplePid,
  mgstageTableValue,
  parseMgstageActors,
  parseMgstageDate,
  parseMgstageDetailHtml,
  parseMgstageExtrafanart,
  parseMgstageGenres,
  parseMgstageRating,
  parseMgstageRuntime,
  pickMgstageDetailHref,
} from "./mgstage.js";

const FIXTURE = fs.readFileSync(
  path.join(import.meta.dirname, "../../../scripts/_mgstage-dump/product_product_detail_ABP_001.html"),
  "utf8",
);

describe("parseMgstageDate", () => {
  it("normalizes slash date", () => {
    assert.equal(parseMgstageDate("2013/06/01"), "2013-06-01");
  });
});

describe("parseMgstageRuntime", () => {
  it("parses minutes", () => {
    assert.equal(parseMgstageRuntime("135min"), 135);
  });
});

describe("mgstageTableValue", () => {
  it("reads maker and sku from fixture", () => {
    assert.equal(mgstageTableValue(FIXTURE, "メーカー"), "プレステージ");
    assert.equal(mgstageTableValue(FIXTURE, "品番"), "ABP-001");
  });
});

describe("parseMgstageActors", () => {
  it("extracts performer", () => {
    assert.deepEqual(parseMgstageActors(FIXTURE), ["水咲ローラ（滝澤ローラ）"]);
  });
});

describe("parseMgstageGenres", () => {
  it("collects genre links", () => {
    const genres = parseMgstageGenres(FIXTURE);
    assert.ok(genres.includes("手コキ"));
    assert.ok(genres.includes("コスプレ"));
  });
});

describe("parseMgstageRating", () => {
  it("parses score and votes", () => {
    const r = parseMgstageRating(FIXTURE);
    assert.ok(r);
    assert.equal(r!.ratingValue, 4.2);
    assert.equal(r!.votes, "4");
    assert.equal(r!.score, 8.4);
  });
});

describe("parseMgstageExtrafanart", () => {
  it("collects sample images", () => {
    const urls = parseMgstageExtrafanart(FIXTURE);
    assert.ok(urls.length >= 5);
    assert.match(urls[0], /cap_e_0_abp-001\.jpg$/);
  });
});

describe("extractMgstageSamplePid", () => {
  it("finds sample player pid", () => {
    assert.equal(extractMgstageSamplePid(FIXTURE), "400b3bb7-cd3c-45ae-be77-6317ec6b9c6e");
  });
});

describe("pickMgstageDetailHref", () => {
  it("matches exact code path", () => {
    assert.equal(pickMgstageDetailHref('<a href="/product/product_detail/ABP-001/">x</a>', "ABP-001"), "/product/product_detail/ABP-001/");
  });
});

describe("parseMgstageDetailHtml", () => {
  it("maps ABP-001 detail page", () => {
    const r = parseMgstageDetailHtml(
      FIXTURE,
      "https://www.mgstage.com/product/product_detail/ABP-001/",
      "ABP-001",
    );
    assert.ok(r);
    assert.match(r!.fields.title || "", /水咲ローラ/);
    assert.equal(r!.fields.studio, "プレステージ");
    assert.equal(r!.fields.publisher, "ABSOLUTELY PERFECT");
    assert.equal(r!.fields.series, "最新やみつきエステ");
    assert.equal(r!.fields.premiered, "2013-06-01");
    assert.equal(r!.fields.runtime, 135);
    assert.equal(r!.fields.ratingValue, 4.2);
    assert.equal(r!.fields.votes, "4");
    assert.match(r!.coverUrl || "", /pb_e_abp-001\.jpg$/);
    assert.ok((r!.extrafanartUrls?.length || 0) >= 5);
  });
});
