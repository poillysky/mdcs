import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { PROJECT_ROOT } from "../paths.js";
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

  it("将绝对路径转为项目相对路径", () => {
    const abs = path.join(PROJECT_ROOT, "media", "本地索引", "test");
    const rel = normalizeRelativePath(abs);
    assert.equal(rel, "media/本地索引/test");
  });

  it("去除前导斜杠", () => {
    assert.equal(normalizeRelativePath("/media/foo"), "media/foo");
  });
});
