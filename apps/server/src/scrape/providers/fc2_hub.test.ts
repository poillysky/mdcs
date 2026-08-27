import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { PROJECT_ROOT } from "../../paths.js";
import {
  parseFc2HubCover,
  parseFc2HubDetailHtml,
  parseFc2HubExtrafanart,
  parseFc2HubOutline,
  parseFc2HubStudio,
  parseFc2HubTags,
  parseFc2HubTitle,
  parseFc2HubTrailerVideoId,
  parseFc2Id,
} from "./fc2_hub.js";

const FIXTURE = `
<html><head>
<script type="application/ld+json">{"@type":"Movie","datePublished":"2023-04-15","duration":"PT0H45M","genre":["素人"],"actor":[{"name":"えりか"}],"image":"https://storage79000.contents.fc2.com/dead.jpg"}</script>
<meta property="og:image" content="https://storage79000.contents.fc2.com/og-dead.jpg"/>
</head><body>
<h1>FC2 Hub</h1>
<h1>FC2-PPV-3275049 えりかちゃん初ごっくん！</h1>
<a data-fancybox="gallery" href="https://cdn.example.test/cover3275049.jpg">cover</a>
<div class="col-8">えりかちゃん 0</div>
<p class="card-text"><a href="/tag/amateur">素人</a><a href="/tag/巨乳">巨乳</a></p>
<div class="col des">これは十分な長さの説明文です。Hub 简介テスト。</div>
<div style="padding: 0"><a href="https://cdn.example.test/extra1.jpg">e1</a></div>
<div style="padding: 0"><a href="https://cdn.example.test/extra2.jpg">e2</a></div>
<div class="player-api" data-id="3275049"></div>
</body></html>`;

describe("parseFc2Id (hub re-export)", () => {
  it("parses PPV id", () => {
    assert.deepEqual(parseFc2Id("FC2-PPV-3275049"), { id: "3275049", displayCode: "FC2-PPV-3275049" });
  });
});

describe("parseFc2HubTitle", () => {
  it("uses second h1", () => {
    const t = parseFc2HubTitle(FIXTURE, "FC2-PPV-3275049", "3275049");
    assert.match(t, /えりかちゃん初ごっくん/);
  });
});

describe("parseFc2HubCover", () => {
  it("uses fancybox only; ignores ld/og", () => {
    const url = parseFc2HubCover(FIXTURE, "https://javten.com/video/1/id3275049");
    assert.match(url || "", /cdn\.example\.test\/cover3275049\.jpg/);
  });

  it("returns null when only ld/og exist (no fancybox)", () => {
    const html = `<html><script type="application/ld+json">{"@type":"Movie","image":"https://storage1.contents.fc2.com/x.jpg"}</script>
<meta property="og:image" content="https://storage1.contents.fc2.com/y.jpg"/></html>`;
    assert.equal(parseFc2HubCover(html, "https://javten.com/"), null);
  });

  it("accepts protocol-relative contents-thumbnail fancybox", () => {
    const html = `<a data-fancybox="gallery" href="//contents-thumbnail2.fc2.com/w1280/storage1.contents.fc2.com/file/a.jpg">c</a>`;
    const url = parseFc2HubCover(html, "https://javten.com/");
    assert.match(url || "", /^https:\/\/contents-thumbnail2\.fc2\.com\/w1280\//);
  });
});

describe("parseFc2HubExtrafanart", () => {
  it("reads padding:0 gallery links", () => {
    assert.deepEqual(parseFc2HubExtrafanart(FIXTURE, "https://javten.com/"), [
      "https://cdn.example.test/extra1.jpg",
      "https://cdn.example.test/extra2.jpg",
    ]);
  });
});

describe("parseFc2HubStudio", () => {
  it("reads col-8 seller and strips trailing score", () => {
    assert.equal(parseFc2HubStudio(FIXTURE), "えりかちゃん");
  });
});

describe("parseFc2HubTags", () => {
  it("reads card-text tag links", () => {
    assert.deepEqual(parseFc2HubTags(FIXTURE), ["素人", "巨乳"]);
  });
});

describe("parseFc2HubOutline", () => {
  it("reads col.des plot", () => {
    assert.match(parseFc2HubOutline(FIXTURE) || "", /Hub 简介/);
  });
});

describe("parseFc2HubTrailerVideoId", () => {
  it("reads player-api data-id", () => {
    assert.equal(parseFc2HubTrailerVideoId(FIXTURE, "3275049"), "3275049");
  });
});

describe("parseFc2HubDetailHtml", () => {
  it("maps hub detail fixture (mdcx-aligned)", () => {
    const hit = parseFc2HubDetailHtml(
      FIXTURE,
      "https://javten.com/video/99/id3275049",
      "FC2-PPV-3275049",
      "https://sample.example.test/preview.mp4",
    );
    assert.ok(hit);
    assert.match(hit!.fields.title || "", /えりか/);
    assert.equal(hit!.fields.premiered, "2023-04-15");
    assert.equal(hit!.fields.runtime, 45);
    assert.equal(hit!.fields.studio, "えりかちゃん");
    assert.equal(hit!.fields.series, "FC2系列");
    assert.equal(hit!.fields.mosaic, "有码");
    assert.deepEqual(hit!.fields.genres, ["素人", "巨乳"]);
    // mdcx 默认不用卖家当演员；仅 LD actor
    assert.deepEqual(hit!.fields.actors, ["えりか"]);
    assert.equal(hit!.fields.trailerUrl, "https://sample.example.test/preview.mp4");
    assert.match(hit!.coverUrl || "", /cover3275049/);
    assert.equal(hit!.extrafanartUrls?.length, 2);
  });

  it("parses live dump if present", () => {
    const dump = path.join(PROJECT_ROOT, "data/_debug/fc2-hub-search-3275049.html");
    if (!fs.existsSync(dump)) return;
    const html = fs.readFileSync(dump, "utf8");
    const hit = parseFc2HubDetailHtml(
      html,
      "https://javten.com/video/1/id3275049",
      "FC2-PPV-3275049",
    );
    assert.ok(hit);
    assert.ok((hit!.fields.title || "").length >= 4);
    // 只认 fancybox；无 fancybox 时 cover 可为 null（不回退 LD/og）
  });

  it("parses 4962908 dump with tags+thumbnail cover", () => {
    const dump = path.join(PROJECT_ROOT, "data/_debug/fc2-hub-detail-4962908.html");
    if (!fs.existsSync(dump)) return;
    const hit = parseFc2HubDetailHtml(
      fs.readFileSync(dump, "utf8"),
      "https://javten.com/video/2115058/id4962908",
      "FC2-PPV-4962908",
    );
    assert.ok(hit);
    assert.match(hit!.fields.title || "", /保育士|陰キャ/);
    assert.equal(hit!.fields.studio, "野菜");
    assert.ok((hit!.fields.genres || []).includes("素人"));
    assert.match(hit!.coverUrl || "", /contents-thumbnail2\.fc2\.com/);
  });
});
