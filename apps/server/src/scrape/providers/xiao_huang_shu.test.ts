import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseXhsDetail,
  parseXhsIsoDuration,
  parseXhsSearchHit,
  xiaoHuangShuProvider,
} from "./xiao_huang_shu.js";

describe("xiao_huang_shu parser", () => {
  it("extracts video card from search page", () => {
    const html = `
      <div class="item video">
        <a href="/video/id-643138d8108f9.html" title="外送小姨子">
          <div role="img" class="img" style="background-image:url('https://upload.xchina.io/video/643138d8108f9.webp');"></div>
        </a>
        <div class="title"><a href="/video/id-643138d8108f9.html">外送小姨子</a></div>
        <a href="/model/id-6006b8ce1f6e5.html" class="model-item">张芸熙</a>
        <div class="tags"><div>麻豆传媒</div><div class="empty"></div><div>MDX0006</div><div><i class="far fa-clock"></i>27:51</div></div>
      </div>
    `;
    const hit = parseXhsSearchHit(html, "MDX-0006", "https://xchina.co");
    assert.ok(hit);
    assert.equal(hit?.detailUrl, "https://xchina.co/video/id-643138d8108f9.html");
    assert.equal(hit?.title, "外送小姨子");
    assert.equal(hit?.coverUrl, "https://upload.xchina.io/video/643138d8108f9.webp");
    assert.deepEqual(hit?.actors, ["张芸熙"]);
    assert.equal(hit?.studio, "麻豆传媒");
    assert.equal(hit?.runtime, 28);
  });

  it("parses JSON-LD detail fields", () => {
    const html = `
      <h1 class="hero-title-item">外送小姨子（MDX0006）</h1>
      <script type="application/ld+json">[{"@type":"VideoObject","name":"MDX0006 外送小姨子","uploadDate":"2023-04-08T17:59:26+08:00","thumbnailUrl":"https://upload.xchina.io/video/643138d8108f9.webp","duration":"PT27M51S","actor":[{"name":"张芸熙"}]}]</script>
      <div class="info-card video-detail">
        <a href="/videos/series-63824a975d8ae.html">中文AV</a>
        <a href="/videos/series-5f904550b8fcc.html">麻豆传媒</a>
      </div>
    `;
    const r = parseXhsDetail(html, "https://xchina.co/video/id-643138d8108f9.html", "MDX-0006");
    assert.ok(r);
    assert.equal(r?.fields.title, "外送小姨子");
    assert.equal(r?.fields.studio, "麻豆传媒");
    assert.deepEqual(r?.fields.actors, ["张芸熙"]);
    assert.equal(r?.fields.premiered, "2023-04-08");
    assert.equal(r?.fields.runtime, 28);
    assert.equal(r?.coverUrl, "https://upload.xchina.io/video/643138d8108f9.webp");
  });

  it("parses ISO duration and provider id", () => {
    assert.equal(parseXhsIsoDuration("PT27M51S"), 28);
    assert.equal(xiaoHuangShuProvider.id, "xiao_huang_shu");
  });
});
