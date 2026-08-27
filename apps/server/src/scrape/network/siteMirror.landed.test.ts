import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getCachedSiteMirror,
  listLiveSiteMirrors,
  rememberSiteMirrorFromFinalUrl,
  setSiteMirrorStorePath,
} from "./siteMirror.js";

describe("siteMirror landed remember", () => {
  it("remembers javbus landed host from finalUrl and exposes via listLiveSiteMirrors", () => {
    setSiteMirrorStorePath("");
    const landed = rememberSiteMirrorFromFinalUrl(
      "javbus",
      "https://seejav.me/S1N-001",
      "https://www.javbus.com/S1N-001",
    );
    assert.equal(landed, "https://seejav.me");
    assert.equal(getCachedSiteMirror("javbus"), "https://seejav.me");
    assert.equal(listLiveSiteMirrors().javbus, "https://seejav.me");
  });

  it("rejects out-of-family hosts", () => {
    setSiteMirrorStorePath("");
    const landed = rememberSiteMirrorFromFinalUrl(
      "javbus",
      "https://evil.example/cover.jpg",
      "https://www.javbus.com/",
    );
    assert.equal(landed, null);
  });
});
