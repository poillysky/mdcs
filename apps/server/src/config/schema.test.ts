import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDefaultLibrariesConfig, normalizeLibrariesConfig } from "./schema.js";
import { KIND_IDS } from "../types.js";

describe("normalizeLibrariesConfig", () => {
  it("空对象返回七路径默认配置", () => {
    const cfg = normalizeLibrariesConfig({});
    assert.equal(cfg.organize.defaultMode, "hardlink");
    assert.equal(KIND_IDS.length, Object.keys(cfg.kinds).length);
  });

  it("非法 organizeMode 回退默认", () => {
    const cfg = normalizeLibrariesConfig({
      organize: { defaultMode: "invalid", defaultFallback: "copy", onConflict: "skip" },
    });
    assert.equal(cfg.organize.defaultMode, "hardlink");
  });
});

describe("createDefaultLibrariesConfig", () => {
  it("包含全部 KindId", () => {
    const cfg = createDefaultLibrariesConfig();
    for (const id of KIND_IDS) {
      assert.ok(cfg.kinds[id]);
    }
  });
});
