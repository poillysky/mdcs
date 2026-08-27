import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  isJavdayDetailHtml,
  javdayPathCode,
  javdayUrlPathCodes,
  parseJavdayDetailHtml,
} from "./javday.js";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "../../../../../data/_debug");
const DETAIL_FIXTURE = readFileSync(join(FIX, "javday-detail-SONE001.html"), "utf8");
const BASE = "https://javday.app/videos/SONE001/";

describe("javdayPathCode", () => {
  it("strips hyphen for video URL path", () => {
    assert.equal(javdayPathCode("SONE-001"), "SONE001");
    assert.equal(javdayPathCode("SNOS-371"), "SNOS371");
  });
});

describe("javdayUrlPathCodes", () => {
  it("dedupes compact variants", () => {
    const codes = javdayUrlPathCodes("SONE-001");
    assert.ok(codes.includes("SONE001"));
    assert.equal(codes.length, 1);
  });
});

describe("isJavdayDetailHtml", () => {
  it("accepts SONE-001 detail fixture", () => {
    assert.equal(isJavdayDetailHtml(DETAIL_FIXTURE), true);
  });

  it("rejects 404 shell", () => {
    assert.equal(isJavdayDetailHtml("<html><body>aks-404-page 荒原</body></html>"), false);
  });
});

describe("parseJavdayDetailHtml", () => {
  it("parses title, actors, genres, cover from SONE-001", () => {
    const r = parseJavdayDetailHtml(DETAIL_FIXTURE, BASE, "SONE-001");
    assert.ok(r);
    assert.match(r!.fields.title || "", /三田真鈴/);
    assert.equal(r!.fields.actors?.[0], "三田真鈴");
    assert.ok((r!.fields.genres || []).includes("巨乳"));
    assert.match(r!.coverUrl || "", /javday\.app\/upload\/vod/);
    assert.equal(r!.fields.mosaic, "有码");
  });

  it("rejects mismatched jpnum", () => {
    const bad = DETAIL_FIXTURE.replace(/<span class="jpnum">SONE-001<\/span>/, '<span class="jpnum">SONE-999</span>');
    assert.equal(parseJavdayDetailHtml(bad, BASE, "SONE-001"), null);
  });
});
