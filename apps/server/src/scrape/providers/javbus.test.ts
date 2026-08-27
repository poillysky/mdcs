import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeJavbusPremiered, parseJavbusDetailHtml } from "./javbus.js";

/** 移植 MDCX tests/crawlers/test_javbus_new.py FakeJavbusClient fixture */
const MDCX_DETAIL_FIXTURE = `
<html>
  <body>
    <li class="active"><a>有碼</a></li>
    <h3>SSIS-243 Sample Title</h3>
    <p><span class="header">識別碼:</span><span>SSIS-243</span></p>
    <p><span class="header">發行日期:</span>2026/04/03</p>
    <p><span class="header">長度:</span>120分鐘</p>
    <a class="bigImage" href="/pics/cover/ssis243_b.jpg"></a>
    <div class="star-name"><a>演员A</a></div>
    <span class="genre"><label><a href="/genre/a">剧情</a></label></span>
    <a href="/studio/abc">制作商</a>
    <a href="/label/abc">发行商</a>
    <a href="/director/abc">导演</a>
    <a href="/series/abc">系列</a>
    <div id="sample-waterfall"><a href="/sample1.jpg"></a></div>
  </body>
</html>`;

const BASE = "https://www.javbus.com";
const PAGE = `${BASE}/SSIS-243`;

describe("parseJavbusDetailHtml", () => {
  it("maps detail page like MDCX test_javbus_crawler_maps_detail_page", () => {
    const r = parseJavbusDetailHtml(MDCX_DETAIL_FIXTURE, "SSIS-243", BASE, PAGE);
    assert.notEqual("error" in r, true);
    if ("error" in r) return;

    assert.equal(r.fields.title, "Sample Title");
    assert.deepEqual(r.fields.actors, ["演员A"]);
    assert.deepEqual(r.fields.genres, ["剧情"]);
    assert.equal(r.fields.premiered, "2026-04-03");
    assert.equal(r.fields.runtime, 120);
    assert.equal(r.fields.studio, "制作商");
    assert.equal(r.fields.publisher, "发行商");
    assert.deepEqual(r.fields.directors, ["导演"]);
    assert.equal(r.fields.series, "系列");
    assert.equal(r.coverUrl, `${BASE}/pics/cover/ssis243_b.jpg`);
  });

  it("returns error when title missing", () => {
    const r = parseJavbusDetailHtml("<html><body></body></html>", "SSIS-243", BASE, PAGE);
    assert.deepEqual(r, { error: "未找到标题" });
  });
});

describe("normalizeJavbusPremiered", () => {
  it("normalizes slash and short date parts (MDCX getValidRelease)", () => {
    assert.equal(normalizeJavbusPremiered("2024/1/2"), "2024-01-02");
    assert.equal(normalizeJavbusPremiered("2026/04/03"), "2026-04-03");
  });

  it("returns undefined for placeholder date", () => {
    assert.equal(normalizeJavbusPremiered("0000-00-00"), undefined);
  });

  it("returns undefined for invalid calendar date", () => {
    assert.equal(normalizeJavbusPremiered("2017/13/40"), undefined);
  });
});
