import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getCachedIqqtvRoot,
  invalidateIqqtvMirror,
  isIqqtvRedirectSeed,
  normalizeIqqtvRoot,
  rememberIqqtvMirror,
  rememberIqqtvMirrorFromFinalUrl,
} from "./iqqtvMirror.js";

describe("iqqtvMirror landed cache", () => {
  it("treats iqq5.xyz as redirect seed, not a direct base", () => {
    assert.equal(isIqqtvRedirectSeed("https://iqq5.xyz/cn"), true);
    assert.equal(isIqqtvRedirectSeed("https://iqqk4.quest/cn/player/x"), false);
    assert.equal(normalizeIqqtvRoot("https://iqqk4.quest/cn/search.php"), "https://iqqk4.quest");
  });

  it("does not remember gateway hosts; remembers landed host from finalUrl", () => {
    invalidateIqqtvMirror();
    rememberIqqtvMirror("https://iqq5.xyz");
    assert.equal(getCachedIqqtvRoot(), null);

    const landed = rememberIqqtvMirrorFromFinalUrl(
      "https://iqqk4.quest/cn/search.php?kw=SONE-999",
      "https://iqq5.xyz/cn/search.php?kw=SONE-999",
    );
    assert.equal(landed, "https://iqqk4.quest");
    assert.equal(getCachedIqqtvRoot(), "https://iqqk4.quest");
  });
});
