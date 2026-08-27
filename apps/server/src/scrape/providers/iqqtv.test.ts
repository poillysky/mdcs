import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getIqqtvRealUrl,
  matchIqqtvNumber,
  parseIqqtvDetailHtml,
  parseIqqtvOutline,
  removeIqqtvWebNumberSuffix,
} from "./iqqtv.js";

function detailHtml(title: string, outline: string): string {
  return `
<html>
  <head><meta property="og:image" content="https://example.test/cover.jpg" /></head>
  <body>
    <h1 class="h4 b">${title}</h1>
    <a href="/actor/a"><span>演员A</span></a>
    <div class="intro"><p>简介：${outline}</p></div>
    <div class="date">2026/04/03</div>
    <div class="tag-info"><a href="/tag/a">剧情</a></div>
    <a href="/fac/a"><div itemprop="name">制作商</div></a>
    <a href="/series/a">系列</a>
  </body>
</html>`;
}

describe("matchIqqtvNumber", () => {
  it("BF-002 不匹配 ABF-002（MDCX test_get_real_url_bf_not_matched_by_abf）", () => {
    assert.equal(matchIqqtvNumber("ABF-002 别的标题", "BF-002"), false);
    assert.equal(matchIqqtvNumber("BF-002 中文标题", "BF-002"), true);
  });
});

describe("getIqqtvRealUrl", () => {
  it("picks exact code path", () => {
    const html = `
<html><body>
  <span class="title"><a href="/jp/player/ABF-002" title="ABF-002 别的标题"></a></span>
  <span class="title"><a href="/jp/player/BF-002" title="BF-002 中文标题"></a></span>
</body></html>`;
    assert.equal(getIqqtvRealUrl(html, "BF-002"), "/jp/player/BF-002");
  });
});

describe("removeIqqtvWebNumberSuffix", () => {
  it("drops trailing web number like MDCX test_iqqtv_title_cleanup", () => {
    assert.equal(
      removeIqqtvWebNumberSuffix("One more time, One more fuck caribbeancom_060626_001", "060626_001"),
      "One more time, One more fuck",
    );
  });
});

describe("parseIqqtvOutline", () => {
  it("supports 紹介 label and nested content", () => {
    const html = `
<html><body><div class="intro bd-light w-100 mt-1"><p>紹介：<span>第一行</span><br>第二行</p></div></body></html>`;
    assert.equal(parseIqqtvOutline(html), "第一行第二行");
  });

  it("removes distribution notice", () => {
    const html = `<html><body><div class="intro"><p>简介：第一段內容*根据分发方式,内容可能会有所不同</p></div></body></html>`;
    assert.equal(parseIqqtvOutline(html), "第一段內容");
  });
});

describe("parseIqqtvDetailHtml", () => {
  it("maps CN/JP pages like MDCX test_iqqtv_crawler_keeps_jp_original_fields_for_zh_cn", () => {
    const jp = parseIqqtvDetailHtml(detailHtml("JP Title SSIS-001", "JP Outline"), "SSIS-001", "https://iqq5.xyz/jp/player/SSIS-001");
    const cn = parseIqqtvDetailHtml(detailHtml("中文标题 SSIS-001", "中文简介"), "SSIS-001", "https://iqq5.xyz/cn/player/SSIS-001");

    assert.equal(cn.fields.title, "中文标题");
    assert.equal(jp.fields.title, "JP Title");
    assert.equal(cn.fields.plot, "中文简介");
    assert.equal(jp.fields.plot, "JP Outline");
    assert.deepEqual(cn.fields.actors, ["演员A"]);
    assert.deepEqual(cn.fields.genres, ["剧情"]);
    assert.equal(cn.fields.premiered, "2026-04-03");
    assert.equal(cn.fields.studio, "制作商");
    assert.equal(cn.fields.series, "系列");
    assert.equal(cn.coverUrl, "https://example.test/cover.jpg");
  });
});
