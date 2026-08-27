import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  airavDetailCodeOk,
  parseAiravIoDetail,
} from "./airav_io.js";

/** 与 airav.ts scrapeAiravWikiFallback 内 404 判定一致 */
function isAiravWikiNotFoundShell(html: string): boolean {
  return (
    /找不到|404|Not Found|521:\s*Web server/i.test(html.slice(0, 2500)) &&
    !/video-title|og:title|番[号號]/i.test(html)
  );
}

describe("airav wiki fallback parsing", () => {
  it("reuses airav_io detail parser on wiki /video/{CODE} html", () => {
    const html = `
      <html><head>
        <script type="application/ld+json">{"thumbnailUrl":["https://example.test/wiki/cover.jpg"]}</script>
      </head><body>
        <div class="video-title my-3"><h1>SONE-001 中文标题</h1></div>
        <div>番号<span>SONE-001</span></div>
        <div>女優<a href="/actor?id=1">演员A</a></div>
        <div class="video-info"><p>简介正文</p></div>
      </body></html>
    `;
    const landed = "https://www.airav.wiki/video/SONE-001";
    assert.equal(isAiravWikiNotFoundShell(html), false);
    assert.equal(airavDetailCodeOk(html, "SONE-001"), true);
    const parsed = parseAiravIoDetail(html, landed, "SONE-001");
    assert.ok(parsed);
    assert.equal(parsed!.fields.title, "中文标题");
    assert.equal(parsed!.coverUrl, "https://example.test/wiki/cover.jpg");
  });

  it("rejects 404 shell without detail markers", () => {
    const html = `<html><body><h1>404 Not Found</h1><p>找不到页面</p></body></html>`;
    assert.equal(isAiravWikiNotFoundShell(html), true);
  });

  it("accepts page with 404 text but valid detail block", () => {
    const html = `
      <div class="video-title"><h1>SONE-001 标题</h1></div>
      <div>番号<span>SONE-001</span></div>
      <p>404 字样可能出现在侧栏</p>
    `;
    assert.equal(isAiravWikiNotFoundShell(html), false);
  });
});
