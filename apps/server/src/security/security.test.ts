import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { redactSecrets } from "./redact.js";
import { normalizeRelativePath } from "./pathPolicy.js";

describe("redactSecrets", () => {
  it("脱敏 apiKey 与 sk-", () => {
    const out = redactSecrets({ apiKey: "sk-abcdefghijklmnop", token: "secret123" });
    assert.match(out, /\*\*\*/);
    assert.doesNotMatch(out, /sk-abcdefghijklmnop/);
  });
});

describe("pathPolicy", () => {
  it("拒绝 .. 穿越", () => {
    assert.throws(() => normalizeRelativePath("../etc"), /不在允许范围内/);
  });
});
