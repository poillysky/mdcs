import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  avheatCodesMatch,
  avheatSearchQueries,
  avheatSiteIdFromLocalCode,
  isAvheatSearchEmpty,
  parseAvheatDetailHtml,
  pickAvheatMoviePath,
} from "./avheat.js";

const SEARCH_FIXTURE = `
<a href="/cn/movies/nozmjlk" class="movie-card shadow-2">
  <div class="movie-info">
    <div class="movie-name"><span>WeLiveTogether.12.02.23 Sammie Rhodes - Office Play</span></div>
    <div class="movie-meta"><span>WeLiveTogether.12.02.23</span><span>2012-02-23</span></div>
  </div>
</a>`;

const DETAIL_FIXTURE = `
<section class="movie-detail">
  <h1>WeLiveTogether.12.02.23 Sammie Rhodes,Dani Daniels,Spencer Scott - Office Play</h1>
  <div class="poster-image"><div class="q-img poster-image"><img class="q-img__image" src="https://file.netcdn.space/storage/realitykings/movies/WeLiveTogether/12.02.23/b_00.jpg"></div></div>
  <span class="detail-label">识别码:</span><span class="detail-value detail-value--accent">WeLiveTogether.12.02.23</span>
  <span class="detail-label">发行时间:</span><span class="detail-value">2012-02-23</span>
  <span class="detail-label">长度:</span><span class="detail-value">-</span>
  <span class="detail-label">制作商:</span><a class="detail-value detail-text-link">RealityKings</a>
  <span class="detail-label">系列:</span><a class="detail-value detail-text-link">WeLiveTogether</a>
  <span class="detail-label">类别:</span><span class="link-row">
    <a class="detail-link">Lesbian</a><a class="detail-link">Office</a>
  </span></div></div></div>
  <section class="actresses"><div class="actress-name">Spencer Scott</div><div class="actress-name">Dani Daniels</div></section>
</section>`;

const LIVE_DETAIL = fs.existsSync(
  path.join(import.meta.dirname, "../../../scripts/_avheat-dump/detail_office_play.html"),
)
  ? fs.readFileSync(
      path.join(import.meta.dirname, "../../../scripts/_avheat-dump/detail_office_play.html"),
      "utf8",
    )
  : "";

describe("avheatSearchQueries", () => {
  it("keeps site native id", () => {
    const q = avheatSearchQueries("WeLiveTogether.12.02.23");
    assert.ok(q.includes("WeLiveTogether.12.02.23"));
    assert.ok(q.includes("WeLiveTogether 2012-02-23"));
  });

  it("maps WLT local code to site id", () => {
    assert.equal(avheatSiteIdFromLocalCode("WLT.2012.02.23"), "WeLiveTogether.12.02.23");
    const q = avheatSearchQueries("WLT.2012.02.23");
    assert.ok(q.includes("WeLiveTogether.12.02.23"));
  });
});

describe("avheatCodesMatch", () => {
  it("matches site id", () => {
    assert.equal(avheatCodesMatch("WeLiveTogether.12.02.23", "WeLiveTogether.12.02.23"), true);
  });

  it("matches local WLT by date suffix", () => {
    assert.equal(
      avheatCodesMatch("WeLiveTogether.12.02.23", "WLT.2012.02.23", "2012-02-23"),
      true,
    );
  });
});

describe("isAvheatSearchEmpty", () => {
  it("detects no results banner", () => {
    assert.equal(isAvheatSearchEmpty('<div class="q-banner">没有结果。</div>'), true);
  });
});

describe("pickAvheatMoviePath", () => {
  it("finds movie via site id meta", () => {
    assert.equal(
      pickAvheatMoviePath(SEARCH_FIXTURE, "WeLiveTogether.12.02.23"),
      "/cn/movies/nozmjlk",
    );
    assert.equal(pickAvheatMoviePath(SEARCH_FIXTURE, "SONE-001"), null);
  });
});

describe("parseAvheatDetailHtml", () => {
  it("parses western fixture", () => {
    const hit = parseAvheatDetailHtml(
      DETAIL_FIXTURE,
      "https://avheat.shop/cn/movies/nozmjlk",
      "WeLiveTogether.12.02.23",
    );
    assert.ok(hit);
    assert.equal(hit!.fields.title, "Office Play");
    assert.deepEqual(hit!.fields.actors, ["Spencer Scott", "Dani Daniels"]);
    assert.ok(hit!.fields.genres?.includes("Lesbian"));
    assert.equal(hit!.fields.studio, "RealityKings");
    assert.equal(hit!.fields.series, "WeLiveTogether");
    assert.equal(hit!.fields.premiered, "2012-02-23");
    assert.match(hit!.coverUrl || "", /WeLiveTogether\/12\.02\.23\/b_00\.jpg/);
  });

  it("parses live dump when present", () => {
    if (!LIVE_DETAIL) return;
    const hit = parseAvheatDetailHtml(
      LIVE_DETAIL,
      "https://avheat.shop/cn/movies/nozmjlk",
      "WeLiveTogether.12.02.23",
    );
    assert.ok(hit);
    assert.equal(hit!.fields.title, "Office Play");
    assert.equal(hit!.fields.studio, "RealityKings");
  });
});
