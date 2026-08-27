import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeSevenmmtvTitle,
  parseSevenmmtvOutline,
  pickSevenmmtvDetailHref,
} from "./sevenmmtv.js";

describe("pickSevenmmtvDetailHref", () => {
  it("prefers censored_content over reducing-mosaic", () => {
    const html = `
      <a href="/zh/reducing-mosaic_content/1/sone-001.html">x</a>
      <a href="/zh/censored_content/2/sone-001-abc.html">y</a>
    `;
    assert.match(pickSevenmmtvDetailHref(html, "SONE-001"), /censored_content/);
  });
});

describe("normalizeSevenmmtvTitle", () => {
  it("collapses multiline like MDCX test_get_title", () => {
    const raw = "200GANA-3327 第一段標題\n          第二段標題 2259";
    assert.equal(normalizeSevenmmtvTitle(raw, "200GANA-3327"), "第一段標題 第二段標題 2259");
  });
});

describe("parseSevenmmtvOutline", () => {
  it("joins br lines like MDCX test_get_outline", () => {
    const html = `
      <div class="video-introduction-images-text">
        <p>第一行<br>第二行<br>第三行</p>
      </div>
    `;
    assert.equal(parseSevenmmtvOutline(html), "第一行\n第二行\n第三行");
  });
});
