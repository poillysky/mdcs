import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveWatermarkLabels } from "./poster.js";
import { defaultWatermarkConfig } from "./watermarkConfig.js";

describe("resolveWatermarkLabels", () => {
  const cfg = defaultWatermarkConfig();

  it("破解优先于无码", () => {
    const labels = resolveWatermarkLabels("无码破解", false, cfg);
    assert.equal(labels[0]?.text, "破解");
  });

  it("字幕角标", () => {
    const labels = resolveWatermarkLabels("有码", true, cfg);
    assert.ok(labels.some((l) => l.text === "字幕"));
  });

  it("4K 分辨率角标", () => {
    const labels = resolveWatermarkLabels("有码", false, cfg, "4K");
    assert.ok(labels.some((l) => l.id === "resolution" && l.fileName === "4k.png"));
  });

  it("关闭时为空", () => {
    assert.deepEqual(resolveWatermarkLabels("有码", true, { ...cfg, enabled: false }), []);
  });
});

describe("resolveWatermarkAssetDir", () => {
  it("分辨率标使用 style4k 目录", async () => {
    const { resolveWatermarkAssetDir } = await import("./watermarkConfig.js");
    const dir = resolveWatermarkAssetDir(
      { customDir: "", style: "default", style4k: "emby" },
      "resolution",
    );
    assert.equal(dir, "assets/watermarks/emby");
  });

  it("customDir 优先", async () => {
    const { resolveWatermarkAssetDir } = await import("./watermarkConfig.js");
    const dir = resolveWatermarkAssetDir(
      { customDir: "assets/watermarks/custom", style: "default", style4k: "default" },
      "subtitle",
    );
    assert.equal(dir, "assets/watermarks/custom");
  });
});
