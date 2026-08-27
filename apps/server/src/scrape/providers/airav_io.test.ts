import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  airavDetailCodeOk,
  isAiravJunkEntry,
  matchAiravNumber,
  normalizeAiravCode,
  parseAiravIoDetail,
  pickAiravHidFromSearch,
  pickAiravLdJsonCover,
} from "./airav_io.js";

describe("matchAiravNumber", () => {
  it("strict prefix like MDCX test_match_number", () => {
    assert.equal(matchAiravNumber("BF-002 中文标题", "BF-002"), true);
    assert.equal(matchAiravNumber("ABF-002 别的标题", "BF-002"), false);
    assert.equal(matchAiravNumber("252MY-001 x", "252MY-001"), true);
  });
});

describe("pickAiravHidFromSearch", () => {
  it("picks bf not abf like MDCX get_real_url", () => {
    const html = `
      <div class="col oneVideo"><a href="/cn/video?hid=abf002"></a><h5>ABF-002 别的标题</h5></div>
      <div class="col oneVideo"><a href="/cn/video?hid=bf002"></a><h5>BF-002 中文标题</h5></div>
    `;
    assert.equal(pickAiravHidFromSearch(html, "BF-002"), "/cn/video?hid=bf002");
  });

  it("skips junk crack entries", () => {
    const html = `
      <div class="col oneVideo"><a href="/cn/video?hid=bad"></a><h5>SONE-001 无码破解版</h5></div>
      <div class="col oneVideo"><a href="/cn/video?hid=good"></a><h5>SONE-001 正常标题</h5></div>
    `;
    assert.equal(pickAiravHidFromSearch(html, "SONE-001"), "/cn/video?hid=good");
  });
});

describe("parseAiravIoDetail", () => {
  it("maps MDCX-style detail html", () => {
    const html = `
      <html><head>
        <script type="application/ld+json">{"thumbnailUrl":["https://example.test/big_pic/cover.jpg"]}</script>
      </head><body>
        <div class="video-title my-3"><h1>JUQ-888 中文标题</h1></div>
        <div>番号<span>JUQ-888</span></div>
        <div>女優<a href="/cn/actor?id=1">演员A</a></div>
        <div>厂商<a href="/cn/tag?fid=1">制作商</a></div>
        <div><i class="fa fa-clock me-2"></i>2024-01-15</div>
        <div>标籤<a href="/cn/tag?tid=1">剧情</a></div>
        <div class="video-info"><p>中文简介 *根据分发信息</p></div>
        <div>系列<a href="/cn/series/x">系列A</a></div>
      </body></html>
    `;
    const parsed = parseAiravIoDetail(html, "https://airav.io/cn/video?hid=x", "JUQ-888");
    assert.ok(parsed);
    assert.equal(parsed!.fields.title, "中文标题");
    assert.deepEqual(parsed!.fields.actors, ["演员A"]);
    assert.equal(parsed!.fields.studio, "制作商");
    assert.equal(parsed!.fields.series, "系列A");
    assert.equal(parsed!.fields.premiered, "2024-01-15");
    assert.equal(parsed!.coverUrl, "https://example.test/big_pic/cover.jpg");
    assert.match(parsed!.fields.plot || "", /中文简介/);
    assert.match(parsed!.fields.originalPlot || "", /中文简介/);
  });
});

describe("pickAiravLdJsonCover", () => {
  it("reads thumbnailUrl array", () => {
    const html = `<script type="application/ld+json">{"thumbnailUrl":"https://x.test/a.jpg"}</script>`;
    assert.equal(pickAiravLdJsonCover(html), "https://x.test/a.jpg");
  });
});

describe("airavDetailCodeOk", () => {
  it("accepts span number", () => {
    const html = `番号<span>SONE-001</span>`;
    assert.equal(airavDetailCodeOk(html, "SONE-001"), true);
  });
});

describe("normalizeAiravCode", () => {
  it("lowercases N####", () => {
    assert.equal(normalizeAiravCode("N1234"), "n1234");
  });
});

describe("isAiravJunkEntry", () => {
  it("detects crack markers", () => {
    assert.equal(isAiravJunkEntry("SONE-001 马赛克破坏版"), true);
    assert.equal(isAiravJunkEntry("SONE-001 正常"), false);
  });
});
