import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAioThinShell,
  mirrorNetcdnToDmm,
  parseAvmooDetailHtml,
  parseAvmooExtrafanart,
  pickAvmooMoviePath,
} from "./avmoo.js";

const SEARCH_FIXTURE = `
<a href="/cn/movies/nzgxjqa" class="movie-card">
  <img src="https://jp.netcdn.space/digital/video/sone00001/sone00001ps.jpg" class="poster">
  <div class="movie-info">
    <div class="movie-name"><span>エロめっちゃ可愛い三田真鈴</span></div>
    <div class="movie-meta"><span>SONE-001</span><span>2023-12-08</span></div>
  </div>
</a>`;

const DETAIL_FIXTURE = `
<section class="movie-detail">
  <h1>SONE-001 エロめっちゃ可愛い三田真鈴の初・体・験3本番</h1>
  <img class="q-img__image" src="https://jp.netcdn.space/digital/video/sone00001/sone00001pl.jpg">
  <span class="detail-label">识别码:</span><span class="detail-value">SONE-001</span>
  <span class="detail-label">发行时间:</span><span class="detail-value">2023-12-08</span>
  <span class="detail-label">长度:</span><span class="detail-value">153分钟</span>
  <span class="detail-label">导演:</span><a class="detail-value detail-text-link">嵐山みちる</a>
  <span class="detail-label">制作商:</span><a class="detail-value detail-text-link">エスワン ナンバーワンスタイル</a>
  <span class="detail-label">发行商:</span><a class="detail-value detail-text-link">S1 NO.1 STYLE</a>
  <span class="detail-label">系列:</span><a class="detail-value detail-text-link">初体験○本番スペシャル</a>
  <span class="detail-label">类别:</span><span class="link-row">
    <a class="detail-link">巨乳</a><a class="detail-link">单体作品</a>
  </span></div></div></div>
  <div class="actress-name">三田真鈴</div>
  <section class="samples"><div class="sample-grid">
    <img src="https://jp.netcdn.space/digital/video/sone00001/sone00001-1.jpg">
    <img src="https://jp.netcdn.space/digital/video/sone00001/sone00001-2.jpg">
  </div></section>
</section>`;

const THIN_SHELL = `<html><body><div id="jav-site-index"></div></body></html>`;

describe("isAioThinShell", () => {
  it("detects SPA shell", () => {
    assert.equal(isAioThinShell(THIN_SHELL), true);
    assert.equal(isAioThinShell(DETAIL_FIXTURE), false);
  });
});

describe("pickAvmooMoviePath", () => {
  it("matches movie-meta code", () => {
    assert.equal(pickAvmooMoviePath(SEARCH_FIXTURE, "SONE-001"), "/cn/movies/nzgxjqa");
    assert.equal(pickAvmooMoviePath(SEARCH_FIXTURE, "ABP-001"), null);
  });
});

describe("parseAvmooDetailHtml", () => {
  it("parses SONE-001 detail fixture", () => {
    const hit = parseAvmooDetailHtml(DETAIL_FIXTURE, "https://avmoo.shop/cn/movies/nzgxjqa", "SONE-001");
    assert.ok(hit);
    assert.match(hit!.fields.title || "", /三田真鈴/);
    assert.deepEqual(hit!.fields.actors, ["三田真鈴"]);
    assert.ok(hit!.fields.genres?.includes("巨乳"));
    assert.equal(hit!.fields.studio, "エスワン ナンバーワンスタイル");
    assert.equal(hit!.fields.publisher, "S1 NO.1 STYLE");
    assert.equal(hit!.fields.premiered, "2023-12-08");
    assert.equal(hit!.fields.runtime, 153);
    assert.deepEqual(hit!.fields.directors, ["嵐山みちる"]);
    assert.match(hit!.coverUrl || "", /sone00001pl\.jpg/);
  });

  it("returns null for thin shell", () => {
    assert.equal(parseAvmooDetailHtml(THIN_SHELL, "https://avmoo.shop/cn/movies/x", "SONE-001"), null);
  });
});

describe("parseAvmooExtrafanart", () => {
  it("collects sample images", () => {
    const urls = parseAvmooExtrafanart(DETAIL_FIXTURE, "https://avmoo.shop/cn/movies/nzgxjqa");
    assert.ok(urls.length >= 2);
    assert.ok(urls.some((u) => /sone00001-1\.jpg/.test(u)));
  });
});

describe("mirrorNetcdnToDmm", () => {
  it("rewrites netcdn host to pics.dmm.co.jp", () => {
    assert.equal(
      mirrorNetcdnToDmm("https://jp.netcdn.space/digital/video/sone00001/sone00001pl.jpg"),
      "https://pics.dmm.co.jp/digital/video/sone00001/sone00001pl.jpg",
    );
    assert.equal(mirrorNetcdnToDmm("https://pics.dmm.co.jp/x.jpg"), null);
  });
});

describe("parseAvmooDetailHtml cover urls", () => {
  it("keeps netcdn as primary with dmm alternate", () => {
    const hit = parseAvmooDetailHtml(DETAIL_FIXTURE, "https://avmoo.shop/cn/movies/nzgxjqa", "SONE-001");
    assert.match(hit!.coverUrl || "", /netcdn\.space/);
    assert.ok(hit!.alternateCoverUrls?.some((u) => /pics\.dmm\.co\.jp/.test(u)));
    assert.ok(hit!.extrafanartUrls?.every((u) => /netcdn\.space/.test(u)));
  });
});
