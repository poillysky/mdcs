import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeScrapeConfig } from "../config/schema.js";

describe("normalizeWatermarkConfig", () => {
  it("空配置给出完整默认水印字段", () => {
    const cfg = normalizeScrapeConfig({});
    assert.equal(cfg.watermark.layout, "stack");
    assert.equal(cfg.watermark.heightRatio, 9);
    assert.equal(cfg.watermark.markResolution, true);
    assert.equal(cfg.watermark.posSubtitle, "auto");
  });

  it("旧 scalePercent 可推导 heightRatio", () => {
    const cfg = normalizeScrapeConfig({
      watermark: { enabled: true, scalePercent: 10, markSubtitle: true },
    });
    assert.ok(cfg.watermark.heightRatio >= 2);
    assert.equal(cfg.watermark.enabled, true);
  });
});
