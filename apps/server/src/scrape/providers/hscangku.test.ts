import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hscangkuProvider, parseHscangkuDetail, parseHscangkuSearchHit } from "./hscangku.js";

describe("hscangku parser", () => {
  it("extracts detail url from search page", () => {
    const html = `
      <a class="stui-vodlist__thumb lazyload" href="/vodplay/41998-1-1.html" title="MDX-0006 外送小姨子" data-original="https://img.example/poster.jpg"></a>
    `;
    const hit = parseHscangkuSearchHit(html, "MDX-0006", "https://hsck.example");
    assert.equal(hit.detailUrl, "https://hsck.example/vodplay/41998-1-1.html");
    assert.equal(hit.coverUrl, "https://img.example/poster.jpg");
  });

  it("parses detail title and cover", () => {
    const html = `
      <h3 class="title">MDX-0006 外送小姨子</h3>
      <a href="/vodplay/41998-1-1.html" data-original="https://img.example/cover.jpg"></a>
    `;
    const r = parseHscangkuDetail(html, "https://hsck.example/vodplay/41998-1-1.html", "MDX-0006");
    assert.ok(r);
    assert.equal(r?.fields.title, "外送小姨子");
    assert.equal(r?.coverUrl, "https://img.example/cover.jpg");
  });

  it("provider id", () => {
    assert.equal(hscangkuProvider.id, "hscangku");
  });
});

