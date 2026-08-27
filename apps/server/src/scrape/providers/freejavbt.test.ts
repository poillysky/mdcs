import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseFreejavbtDetailHtml,
  parseFreejavbtTitle,
  pickActorsReferencedInTitle,
  stripTrailingActorsFromTitle,
} from "./freejavbt.js";

/** 移植 MDCX tests/crawlers/test_freejavbt.py FakeFreejavbtClient fixture */
const MDCX_DETAIL_FIXTURE = `
<html>
  <head><title>SSNI-531 Sample Title | FREE JAV BT</title></head>
  <head><meta property="og:image" content="https://example.test/cover.jpg" /></head>
  <body>
    <div class="single-video-info col-12"></div>
    <a class="btn actress active">演员A</a>
    <a class="btn actress active">森林原人</a>
    <div><span>日期</span><b>2026-04-03</b></div>
    <div><span>时长</span><b>120分钟</b></div>
    <div><span>系列</span><b>系列名</b></div>
    <div><span>导演</span><b>导演名</b></div>
    <div><span>制作</span><b>制作商</b></div>
    <div><span>发行</span><b>发行商</b></div>
    <a href="/genre/drama">#剧情</a><a href="/genre/sub">#中文字幕</a>
    <a class="tile-item" href="https://example.test/extra.jpg"></a>
    <video id="preview-video"><source src="https://cc3001.dmm.co.jp/pv/token/ssni531hhb.mp4"></video>
  </body>
</html>`;

const PAGE = "https://freejavbt22.cc/SSNI-531";

describe("parseFreejavbtTitle", () => {
  it("extracts title like MDCX get_title", () => {
    const r = parseFreejavbtTitle("<title>SSNI-531 Sample Title | FREE JAV BT</title>", "SSNI-531");
    assert.equal(r.title, "Sample Title");
    assert.equal(r.number, "SSNI-531");
  });

  it("rejects 每日更新 junk like MDCX", () => {
    const r = parseFreejavbtTitle("<title>每日更新 | FREE JAV BT</title>", "SSNI-531");
    assert.equal(r.title, "");
  });

  it("parses code plus single-segment title (no extra spaces)", () => {
    const r = parseFreejavbtTitle(
      "<title>SONE-001 エロめっちゃ可愛い三田真鈴の初・体・験3本番 | FREE JAV BT</title>",
      "SONE-001",
    );
    assert.equal(r.title, "エロめっちゃ可愛い三田真鈴の初・体・験3本番");
    assert.equal(r.number, "SONE-001");
  });
});

describe("pickActorsReferencedInTitle", () => {
  it("keeps only actors mentioned in title", () => {
    const title = "エロめっちゃ可愛い三田真鈴の初・体・験3本番";
    assert.deepEqual(
      pickActorsReferencedInTitle(title, ["三田真鈴", "天野美优", "小田切ジュン"]),
      ["三田真鈴"],
    );
  });
});

describe("stripTrailingActorsFromTitle", () => {
  it("removes trailing actor suffix including male names", () => {
    const raw =
      "エロめっちゃ可愛い三田真鈴の初・体・験3本番 人生初めて尽くし！ 激イキしまくりスペシャル！ 三田真鈴 小田切ジュン";
    const cleaned = stripTrailingActorsFromTitle(raw, ["三田真鈴", "小田切ジュン"]);
    assert.equal(cleaned, "エロめっちゃ可愛い三田真鈴の初・体・験3本番 人生初めて尽くし！ 激イキしまくりスペシャル！");
  });
});

describe("parseFreejavbtDetailHtml", () => {
  it("maps detail page like MDCX test_freejavbt_crawler_maps_detail_page", () => {
    const r = parseFreejavbtDetailHtml(MDCX_DETAIL_FIXTURE, "SSNI-531", PAGE);
    assert.notEqual("error" in r, true);
    if ("error" in r) return;

    assert.equal(r.fields.title, "Sample Title");
    assert.deepEqual(r.fields.actors, ["演员A"]);
    assert.deepEqual(r.fields.genres, ["剧情", "中文字幕"]);
    assert.equal(r.fields.premiered, "2026-04-03");
    assert.equal(r.fields.runtime, 120);
    assert.equal(r.fields.series, "系列名");
    assert.deepEqual(r.fields.directors, ["导演名"]);
    assert.equal(r.fields.studio, "制作商");
    assert.equal(r.fields.publisher, "发行商");
    assert.equal(r.coverUrl, "https://example.test/cover.jpg");
    assert.deepEqual(r.extrafanartUrls, ["https://example.test/extra.jpg"]);
    assert.equal(r.fields.trailerUrl, "https://cc3001.dmm.co.jp/pv/token/ssni531hhb.mp4");
  });

  it("returns error when not a detail page", () => {
    const r = parseFreejavbtDetailHtml("<html><body>empty</body></html>", "SSNI-531", PAGE);
    assert.deepEqual(r, { error: "非详情页" });
  });

  it("drops far-future premiered dates as site junk", () => {
    const html = `
<html>
  <head><title>SSNI-531 Sample | FREE JAV BT</title></head>
  <body>
    <div class="single-video-info col-12"></div>
    <div class="single-video-meta"><span>日期</span><span>2027-12-31</span></div>
    <a class="btn actress active">演员A</a>
  </body>
</html>`;
    const r = parseFreejavbtDetailHtml(html, "SSNI-531", PAGE);
    assert.notEqual("error" in r, true);
    if ("error" in r) return;
    assert.equal(r.fields.premiered, undefined);
  });

  it("filters page-attached actress not in title (SONE-001 pollution)", () => {
    const html = `
<html>
  <head><title>SONE-001 エロめっちゃ可愛い三田真鈴の初・体・験3本番 | FREE JAV BT</title></head>
  <body>
    <div class="single-video-info col-12"></div>
    <div class="single-video-meta"><span>演员</span><span><a class="actress">三田真鈴</a><a class="actress">天野美优</a></span></div>
    <a class="btn actress active">三田真鈴</a>
    <a class="btn actress active">天野美优</a>
  </body>
</html>`;
    const r = parseFreejavbtDetailHtml(html, "SONE-001", "https://www.freejavbt.com/SONE-001");
    assert.notEqual("error" in r, true);
    if ("error" in r) return;
    assert.deepEqual(r.fields.actors, ["三田真鈴"]);
  });

  it("strips actor suffix from live-style title tag (SONE-001)", () => {
    const html = `
<html>
  <head><title>SONE-001 エロめっちゃ可愛い三田真鈴の初・体・験3本番 人生初めて尽くし！ 激イキしまくりスペシャル！ 三田真鈴 小田切ジュン | FREE JAV BT</title></head>
  <body>
    <div class="single-video-info col-12"></div>
    <a class="btn actress active">三田真鈴</a>
    <a class="btn actress active">小田切ジュン</a>
  </body>
</html>`;
    const r = parseFreejavbtDetailHtml(html, "SONE-001", "https://www.freejavbt.com/SONE-001");
    assert.notEqual("error" in r, true);
    if ("error" in r) return;
    assert.equal(
      r.fields.title,
      "エロめっちゃ可愛い三田真鈴の初・体・験3本番 人生初めて尽くし！ 激イキしまくりスペシャル！",
    );
    assert.deepEqual(r.fields.actors, ["三田真鈴"]);
  });
});
