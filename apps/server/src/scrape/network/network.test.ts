import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { looksBlockedHtml, normalizeFlareUrl } from "./flaresolverr.js";
import { normalizeProxyUrl } from "./proxy.js";

describe("network helpers", () => {
  it("normalizeProxyUrl 补全 scheme", () => {
    assert.equal(normalizeProxyUrl("127.0.0.1:7890"), "http://127.0.0.1:7890");
    assert.equal(normalizeProxyUrl("http://127.0.0.1:7890/"), "http://127.0.0.1:7890");
    assert.equal(normalizeProxyUrl(""), "");
  });

  it("normalizeFlareUrl 补全 /v1", () => {
    assert.equal(normalizeFlareUrl("http://127.0.0.1:8191"), "http://127.0.0.1:8191/v1");
    assert.equal(normalizeFlareUrl("http://127.0.0.1:8191/v1"), "http://127.0.0.1:8191/v1");
  });

  it("looksBlockedHtml 识别 Cloudflare 挑战页", () => {
    assert.equal(looksBlockedHtml("<html>Just a moment...</html>" + "x".repeat(400)), true);
    assert.equal(
      looksBlockedHtml("<div id='cf-browser-verification'></div>" + "x".repeat(400)),
      true,
    );
    assert.equal(looksBlockedHtml("短"), true); // <400 视为空壳
    assert.equal(
      looksBlockedHtml("<html><body>正常页面标题" + "正文".repeat(200) + "</body></html>"),
      false,
    );
  });
});
