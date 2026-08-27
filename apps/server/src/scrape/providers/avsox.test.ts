import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  avsoxCodesMatch,
  avsoxSearchQueries,
  isAvsoxSearchEmpty,
  parseAvsoxDetailHtml,
  pickAvsoxMoviePath,
} from "./avsox.js";

const SEARCH_FIXTURE = `
<a href="/cn/movies/kxawewn" class="movie-card shadow-2">
  <img src="https://file.netcdn.space/storage/caribbeancom/moviepages/010117-339/images/jacket.jpg" class="poster">
  <div class="movie-info">
    <div class="movie-name"><span>カリビアンキューティー Vol.30</span></div>
    <div class="movie-meta"><span>010117-339</span><span>2017-01-01</span></div>
  </div>
</a>`;

const DETAIL_FIXTURE = `
<section class="movie-detail">
  <h1>010117-339 カリビアンキューティー Vol.30</h1>
  <div class="poster-image"><img src="https://file.netcdn.space/storage/caribbeancom/moviepages/010117-339/images/l_l.jpg"></div>
  <span class="detail-label">识别码:</span><span class="detail-value detail-value--accent">010117-339</span>
  <span class="detail-label">发行时间:</span><span class="detail-value">2017-01-01</span>
  <span class="detail-label">长度:</span><span class="detail-value">62分钟</span>
  <span class="detail-label">制作商:</span><a class="detail-value detail-text-link">カリビアンコム</a>
  <span class="detail-label">系列:</span><a class="detail-value detail-text-link">カリビアンキューティー</a>
  <span class="detail-label">类别:</span><span class="link-row">
    <a class="detail-link">中出し</a><a class="detail-link">初裏</a>
  </span></div></div></div>
  <section class="actresses"><div class="actress-name">姫川ゆうな</div></section>
</section>`;

const LIVE_DETAIL = fs.readFileSync(
  path.join(import.meta.dirname, "../../../../../data/_debug/avsox-detail-010117-339.html"),
  "utf8",
);

describe("avsoxSearchQueries", () => {
  it("expands CARIB prefix", () => {
    const q = avsoxSearchQueries("CARIB-010117-339");
    assert.ok(q.includes("CARIB-010117-339"));
    assert.ok(q.includes("010117-339"));
  });
});

describe("avsoxCodesMatch", () => {
  it("matches carib page id", () => {
    assert.equal(avsoxCodesMatch("010117-339", "CARIB-010117-339"), true);
  });
});

describe("isAvsoxSearchEmpty", () => {
  it("detects no results banner", () => {
    assert.equal(isAvsoxSearchEmpty('<div class="q-banner">没有结果。</div>'), true);
  });
});

describe("pickAvsoxMoviePath", () => {
  it("finds movie via 010117-339 meta", () => {
    assert.equal(pickAvsoxMoviePath(SEARCH_FIXTURE, "CARIB-010117-339"), "/cn/movies/kxawewn");
    assert.equal(pickAvsoxMoviePath(SEARCH_FIXTURE, "SONE-001"), null);
  });
});

describe("parseAvsoxDetailHtml", () => {
  it("parses CARIB fixture", () => {
    const hit = parseAvsoxDetailHtml(
      DETAIL_FIXTURE,
      "https://avsox.click/cn/movies/kxawewn",
      "CARIB-010117-339",
    );
    assert.ok(hit);
    assert.match(hit!.fields.title || "", /カリビアンキューティー/);
    assert.deepEqual(hit!.fields.actors, ["姫川ゆうな"]);
    assert.ok(hit!.fields.genres?.includes("中出し"));
    assert.equal(hit!.fields.studio, "カリビアンコム");
    assert.equal(hit!.fields.premiered, "2017-01-01");
    assert.equal(hit!.fields.runtime, 62);
    assert.match(hit!.coverUrl || "", /010117-339\/images\/l_l\.jpg/);
  });

  it("parses live dump", () => {
    const hit = parseAvsoxDetailHtml(
      LIVE_DETAIL,
      "https://avsox.click/cn/movies/kxawewn",
      "CARIB-010117-339",
    );
    assert.ok(hit);
    assert.match(hit!.fields.title || "", /カリビアンキューティー/);
    assert.deepEqual(hit!.fields.actors, ["姫川ゆうな"]);
    assert.equal(hit!.fields.studio, "カリビアンコム");
  });
});
