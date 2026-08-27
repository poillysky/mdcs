import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAvbaseActorName,
  matchAvbaseWorkId,
  parseAvbaseDate,
  parseAvbaseDetailHtml,
  parseAvbaseSearchHtml,
  pickAvbaseWorkFromSearch,
  stripAvbaseDescription,
} from "./avbase.js";

const DETAIL_FIXTURE = `
<html><body>
<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"work":{"work_id":"SONE-001","title":"Sample Title","min_date":"Fri Dec 08 2023 09:00:00 GMT+0900","casts":[{"actor":{"name":"三田真鈴","order":0}},{"actor":{"name":"1","order":1}}],"genres":[{"name":"巨乳"},{"name":"単体作品"}],"products":[{"product_id":"sone00001","source":"fanza","image_url":"https://pics.dmm.co.jp/digital/video/sone00001/sone00001pl.jpg","date":"Fri Dec 08 2023 10:00:00 GMT+0900","maker":{"name":"エスワン"},"label":{"name":"S1 NO.1 STYLE"},"series":{"name":"初体験スペシャル"},"sample_image_urls":[{"l":"https://pics.dmm.co.jp/digital/video/sone00001/sone00001jp-1.jpg"}],"sample_movie_url":"https://cc3001.dmm.co.jp/pv/sample.mp4","iteminfo":{"director":"嵐山みちる","volume":"153","description":"【简介】&lt;br&gt;&lt;br&gt;正文"}}]}}}}</script>
</body></html>`;

const SEARCH_FIXTURE = `
<html><body>
<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"works":[{"work_id":"ABF-002","title":"wrong"},{"work_id":"SONE-001","title":"Sample Title","products":[{"image_url":"https://example.test/cover.jpg","iteminfo":{"volume":"120"}}]}],"total":2}}}</script>
</body></html>`;

describe("matchAvbaseWorkId", () => {
  it("matches case-insensitive work id", () => {
    assert.equal(matchAvbaseWorkId("sone-001", "SONE-001"), true);
    assert.equal(matchAvbaseWorkId("ABF-002", "SONE-001"), false);
  });
});

describe("isAvbaseActorName", () => {
  it("filters numeric order pollution", () => {
    assert.equal(isAvbaseActorName("三田真鈴"), true);
    assert.equal(isAvbaseActorName("1"), false);
  });
});

describe("parseAvbaseDate", () => {
  it("parses JS date string", () => {
    assert.equal(parseAvbaseDate("Fri Dec 08 2023 10:00:00 GMT+0900"), "2023-12-08");
  });
});

describe("stripAvbaseDescription", () => {
  it("unwraps br and entities", () => {
    assert.equal(stripAvbaseDescription("【简介】&lt;br&gt;&lt;br&gt;正文"), "【简介】\n\n正文");
  });
});

describe("pickAvbaseWorkFromSearch", () => {
  it("prefers exact work_id", () => {
    const works = [
      { work_id: "ABF-002", title: "wrong" },
      { work_id: "SONE-001", title: "ok" },
    ];
    assert.equal(pickAvbaseWorkFromSearch(works, "SONE-001")?.title, "ok");
  });
});

describe("parseAvbaseDetailHtml", () => {
  it("maps __NEXT_DATA__ work payload", () => {
    const r = parseAvbaseDetailHtml(DETAIL_FIXTURE, "https://www.avbase.net/works/SONE-001", "SONE-001");
    assert.ok(r);
    assert.equal(r!.fields.title, "Sample Title");
    assert.deepEqual(r!.fields.actors, ["三田真鈴"]);
    assert.deepEqual(r!.fields.genres, ["巨乳", "単体作品"]);
    assert.equal(r!.fields.studio, "エスワン");
    assert.equal(r!.fields.publisher, "S1 NO.1 STYLE");
    assert.equal(r!.fields.series, "初体験スペシャル");
    assert.equal(r!.fields.premiered, "2023-12-08");
    assert.equal(r!.fields.runtime, 153);
    assert.equal(r!.fields.directors?.[0], "嵐山みちる");
    assert.match(r!.fields.plot || "", /正文/);
    assert.equal(r!.coverUrl, "https://pics.dmm.co.jp/digital/video/sone00001/sone00001pl.jpg");
    assert.deepEqual(r!.extrafanartUrls, [
      "https://pics.dmm.co.jp/digital/video/sone00001/sone00001jp-1.jpg",
    ]);
    assert.equal(r!.fields.trailerUrl, "https://cc3001.dmm.co.jp/pv/sample.mp4");
  });
});

describe("parseAvbaseSearchHtml", () => {
  it("extracts exact hit from search works", () => {
    const work = parseAvbaseSearchHtml(SEARCH_FIXTURE, "SONE-001");
    assert.equal(work?.work_id, "SONE-001");
  });
});
