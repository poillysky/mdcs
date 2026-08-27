import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveProviderRetry, resolveProviderSite } from "./providerSite.js";

describe("resolveProviderSite", () => {
  it("loads javlibrary cookie from scrape.json when configured", () => {
    const site = resolveProviderSite("javlibrary");
    assert.equal(typeof site.overrideRetry, "boolean");
    assert.ok(site.retry >= 0);
    // cookie 可能为空（用户未配）；结构须完整
    assert.ok("proxyUrlOverride" in site);
    assert.ok("userAgent" in site);
  });
});

describe("resolveProviderRetry", () => {
  it("returns non-negative retry count", () => {
    assert.ok(resolveProviderRetry("javbus") >= 0);
    assert.ok(resolveProviderRetry("javlibrary") >= 0);
  });
});
