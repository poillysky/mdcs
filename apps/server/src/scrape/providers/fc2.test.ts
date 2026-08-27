import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { PROJECT_ROOT } from "../../paths.js";
import {
  parseFc2DetailHtml,
  parseFc2Id,
  parseFc2Premiered,
  parseFc2Runtime,
} from "./fc2.js";

const FIXTURE = `
<html><head>
<meta property="og:title" content="FC2-PPV-1545500 テストタイトル">
<meta property="og:description" content="これは十分な長さの説明文です。">
<meta property="og:image" content="https://storage.example.test/sample.jpg">
</head><body>
<div class="items_article_headerInfo">
  <h2>テストタイトル</h2>
  <a href="/users/seller123/">ハメタロウ</a>
  販売日: 2021/03/08
</div>
<div class="items_article_MainitemThumb"><img src="https://storage.example.test/thumb.jpg"></div>
<div class="items_article_TagArea"><a href="/tag/a">人妻</a><a href="/tag/b">素人</a></div>
</body></html>`;

const CN_FIXTURE = `
<html><head>
<meta property="og:title" content="FC2-PPV-1545500 中文标题">
<meta property="og:url" content="https://adult.contents.fc2.com/article/1545500/">
<meta property="og:video" content="https://adult.contents.fc2.com/embed/1545500/">
<script type="application/ld+json">{"@type":"Product","description":"","aggregateRating":{"ratingValue":5,"bestRating":5,"reviewCount":598}}</script>
</head><body>
<p class="items_article_info">44:13</p>
<li class="items_article_writer">by <a href="https://adult.contents.fc2.com/users/hametaro69/">ハメタロウ</a></li>
<div class="items_article_softDevice"><p>上架时间 : 2020/10/24</p></div>
<section class="items_article_TagArea"><a class="tag tagTag" data-tag="人妻" href="/search/?tag=x">人妻</a></section>
</body></html>`;

describe("parseFc2Id", () => {
  it("parses FC2 and FC2-PPV codes", () => {
    assert.deepEqual(parseFc2Id("FC2-1545500"), { id: "1545500", displayCode: "FC2-PPV-1545500" });
    assert.deepEqual(parseFc2Id("FC2-PPV-3275049"), { id: "3275049", displayCode: "FC2-PPV-3275049" });
    assert.equal(parseFc2Id("SONE-001"), null);
  });
});

describe("parseFc2Premiered", () => {
  it("accepts JP and CN sale date labels", () => {
    assert.equal(parseFc2Premiered(FIXTURE), "2021-03-08");
    assert.equal(parseFc2Premiered(CN_FIXTURE), "2020-10-24");
  });
});

describe("parseFc2Runtime", () => {
  it("parses MM:SS duration", () => {
    assert.equal(parseFc2Runtime(CN_FIXTURE), 44);
  });
});

describe("parseFc2DetailHtml", () => {
  it("maps official article page (JP labels)", () => {
    const hit = parseFc2DetailHtml(
      FIXTURE,
      "https://adult.contents.fc2.com/article/1545500/",
      "FC2-1545500",
    );
    assert.ok(hit);
    assert.match(hit!.fields.title || "", /テストタイトル/);
    assert.equal(hit!.fields.studio, "ハメタロウ");
    assert.equal(hit!.fields.premiered, "2021-03-08");
    assert.deepEqual(hit!.fields.genres, ["人妻", "素人"]);
    assert.match(hit!.coverUrl || "", /sample\.jpg/);
  });

  it("maps CN UI labels, runtime, rating, trailer", () => {
    const hit = parseFc2DetailHtml(
      CN_FIXTURE,
      "https://adult.contents.fc2.com/article/1545500/",
      "FC2-1545500",
    );
    assert.ok(hit);
    assert.equal(hit!.fields.premiered, "2020-10-24");
    assert.equal(hit!.fields.runtime, 44);
    assert.equal(hit!.fields.studio, "ハメタロウ");
    assert.equal(hit!.fields.trailerUrl, "https://adult.contents.fc2.com/embed/1545500/");
    assert.equal(hit!.fields.ratingValue, 5);
    assert.equal(hit!.fields.votes, "598");
    assert.deepEqual(hit!.fields.genres, ["人妻"]);
  });

  it("parses live dump FC2-1545500", () => {
    const dump = path.join(PROJECT_ROOT, "data/_debug/fc2-detail-1545500.html");
    if (!fs.existsSync(dump)) return;
    const hit = parseFc2DetailHtml(
      fs.readFileSync(dump, "utf8"),
      "https://adult.contents.fc2.com/article/1545500/",
      "FC2-1545500",
    );
    assert.ok(hit);
    assert.equal(hit!.fields.premiered, "2020-10-24");
    assert.equal(hit!.fields.runtime, 44);
    assert.equal(hit!.fields.ratingValue, 5);
    assert.equal(hit!.fields.votes, "598");
    assert.ok((hit!.fields.genres?.length ?? 0) >= 5);
  });
});
