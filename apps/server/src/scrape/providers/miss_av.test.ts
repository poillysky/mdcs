import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  isMissAvDetailHtml,
  missAvPathCodes,
  parseMissAvDetailHtml,
  pickMissAvDetailHref,
} from "./miss_av.js";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "../../../../../data/_debug");
const DETAIL = readFileSync(join(FIX, "missav-detail-sone001.html"), "utf8");
const SEARCH = readFileSync(join(FIX, "missav-search-SONE-001.html"), "utf8");
const PAGE_URL = "https://missav123.com/dm94/cn/sone-001";

describe("missAvPathCodes", () => {
  it("includes compact and hyphen forms", () => {
    const codes = missAvPathCodes("SONE-001");
    assert.ok(codes.includes("sone001"));
    assert.ok(codes.includes("sone-001"));
  });
});

describe("isMissAvDetailHtml", () => {
  it("accepts SONE-001 detail fixture", () => {
    assert.equal(isMissAvDetailHtml(DETAIL, "SONE-001"), true);
  });

  it("rejects search page", () => {
    assert.equal(isMissAvDetailHtml(SEARCH, "SONE-001"), false);
  });
});

describe("pickMissAvDetailHref", () => {
  it("prefers main censored detail over uncensored leak", () => {
    const href = pickMissAvDetailHref(SEARCH, "SONE-001");
    assert.match(href, /\/cn\/sone-001$/i);
    assert.doesNotMatch(href, /uncensored-leak/i);
  });
});

describe("parseMissAvDetailHtml", () => {
  it("parses title, actors, genres, cover from SONE-001", () => {
    const r = parseMissAvDetailHtml(DETAIL, PAGE_URL, "SONE-001");
    assert.ok(r);
    assert.match(r!.fields.titleZh || "", /玛琳|三田|体验/);
    assert.ok((r!.fields.actors || []).includes("三田真铃"));
    assert.ok((r!.fields.genres || []).includes("巨乳"));
    assert.equal(r!.fields.studio, "S1");
    assert.equal(r!.fields.premiered, "2023-12-09");
    assert.ok((r!.fields.runtime || 0) > 100);
    assert.match(r!.coverUrl || "", /fourhoi\.com\/sone-001\/cover/i);
    assert.equal(r!.fields.mosaic, "有码");
  });
});
