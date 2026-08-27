import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveCoverImageReferer } from "./imageReferer.js";

describe("resolveCoverImageReferer", () => {
  it("image.avsex.cc 用 avsex.cc Referer（非 CDN origin）", () => {
    assert.equal(
      resolveCoverImageReferer("https://image.avsex.cc/cover/SONE-001-2.jpg"),
      "https://avsex.cc/",
    );
  });

  it("有详情页时用详情 URL 作 Referer", () => {
    assert.equal(
      resolveCoverImageReferer("https://image.avsex.cc/cover/x.jpg", {
        pageUrl: "https://avsex.cc/tw/video/detail/364579",
      }),
      "https://avsex.cc/tw/video/detail/364579",
    );
  });

  it("其它 CDN 仍用 origin", () => {
    assert.equal(
      resolveCoverImageReferer("https://pics.dmm.co.jp/digital/video/foo/ps.jpg"),
      "https://pics.dmm.co.jp/",
    );
  });
});
