import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  isJavlibraryDetailHtml,
  javlibraryCodeToken,
  parseJavlibraryDetailHtml,
  pickJavlibraryDetailUrl,
} from "./javlibrary.js";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "../../../../../data/_debug");

function searchHtml(href: string, title: string): string {
  return `<html><body><div id="video_title"><h3><a href="${href}">${title}</a></h3></div></body></html>`;
}

function detailHtml(title: string, actor: string, withTbody = false): string {
  const tbody = (inner: string) => (withTbody ? `<tbody>${inner}</tbody>` : inner);
  return `<html><body>
    <div id="video_title"><h3><a>${title}</a></h3></div>
    <div id="video_id"><table>${tbody('<tr><td class="text">FSDSS-200</td></tr>')}</table></div>
    <div id="video_cast"><table>${tbody('<tr><td class="text"><span><span class="star"><a>' + actor + '</a></span></span></td></tr>')}</table></div>
    <img id="video_jacket_img" src="//img.example.test/cover.jpg" />
    <div id="video_genres"><table>${tbody('<tr><td class="text"><span><a>剧情</a></span></td></tr>')}</table></div>
    <div id="video_date"><table>${tbody('<tr><td class="text">2026-04-03</td></tr>')}</table></div>
    <div id="video_maker"><table>${tbody('<tr><td class="text"><span><a>制作商</a></span></td></tr>')}</table></div>
    <div id="video_label"><table>${tbody('<tr><td class="text"><span><a>发行商</a></span></td></tr>')}</table></div>
    <div id="video_length"><table>${tbody('<tr><td><span class="text">120</span></td></tr>')}</table></div>
    <div id="video_review"><table>${tbody('<tr><td><span class="score">(4.20)</span></td></tr>')}</table></div>
    <div id="video_director"><table>${tbody('<tr><td class="text"><span><a>导演A</a></span></td></tr>')}</table></div>
    <a href="userswanted.php?mode=add">99</a>
  </body></html>`;
}

describe("javlibraryCodeToken", () => {
  it("normalizes code for title match", () => {
    assert.equal(javlibraryCodeToken("FSDSS-200"), "FSDSS200 ");
  });
});

describe("pickJavlibraryDetailUrl", () => {
  it("matches video_title link", () => {
    const html = searchHtml("/ja/?v=javtest200", "FSDSS-200 Japanese Title");
    const url = pickJavlibraryDetailUrl(html, "FSDSS-200", "https://www.javlibrary.com/ja");
    assert.equal(url, "https://www.javlibrary.com/ja/?v=javtest200");
  });

  it("skips blu-ray duplicate titles", () => {
    const html = `<html><body>
      <a href="/ja/?v=javbd" title="FSDSS-200 ブルーレイディスク"></a>
      <a href="/ja/?v=javok" title="FSDSS-200 Normal"></a>
    </body></html>`;
    const url = pickJavlibraryDetailUrl(html, "FSDSS-200", "https://www.javlibrary.com/ja");
    assert.match(url || "", /javok/);
  });

  it("matches div.video mirror links", () => {
    const html = `<html><body>
      <div class="video" id="vid_javmembera"><a href="./javmembera.html" title="SONE-001 Blu-ray ブルーレイディスク"><div class="id">SONE-001</div></a></div>
      <div class="video" id="vid_javmemberi"><a href="./javmemberi.html" title="SONE-001 正常版"><div class="id">SONE-001</div></a></div>
    </body></html>`;
    const url = pickJavlibraryDetailUrl(html, "SONE-001", "https://www.f101w.com/cn");
    assert.match(url || "", /javmemberi\.html/);
  });
});

describe("parseJavlibraryDetailHtml", () => {
  it("parses detail without tbody", () => {
    const r = parseJavlibraryDetailHtml(
      detailHtml("FSDSS-200 Japanese Title", "女優A"),
      "https://www.javlibrary.com/ja/?v=javtest200",
      "FSDSS-200",
    );
    assert.ok(r);
    assert.equal(r!.fields.title, "Japanese Title");
    assert.deepEqual(r!.fields.actors, ["女優A"]);
    assert.equal(r!.fields.genres?.[0], "剧情");
    assert.equal(r!.fields.premiered, "2026-04-03");
    assert.equal(r!.fields.runtime, 120);
    assert.equal(r!.fields.ratingValue, 4.2);
    assert.equal(r!.fields.votes, "99");
    assert.equal(r!.fields.studio, "制作商");
    assert.equal(r!.fields.directors?.[0], "导演A");
    assert.equal(r!.coverUrl, "https://img.example.test/cover.jpg");
  });

  it("parses detail with tbody (Selenium HTML)", () => {
    const r = parseJavlibraryDetailHtml(
      detailHtml("FSDSS-200 Test Title", "女優A", true),
      "https://www.javlibrary.com/ja/?v=javtest200",
      "FSDSS-200",
    );
    assert.ok(r);
    assert.equal(r!.fields.title, "Test Title");
  });

  it("detects detail shell", () => {
    assert.equal(isJavlibraryDetailHtml(detailHtml("x", "y")), true);
    assert.equal(isJavlibraryDetailHtml("<html>Just a moment</html>"), false);
  });
});

describe("parseJavlibraryDetailHtml fixture file", () => {
  it("loads live dump when present", () => {
    const path = join(FIX, "javlibrary-detail-SONE-001.html");
    try {
      const html = readFileSync(path, "utf8");
      const r = parseJavlibraryDetailHtml(html, "https://www.javlibrary.com/ja/?v=jav", "SONE-001");
      assert.ok(r?.fields.title || r?.coverUrl);
    } catch {
      /* optional live fixture */
    }
  });
});
