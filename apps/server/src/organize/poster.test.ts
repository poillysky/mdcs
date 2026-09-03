import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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

describe("processPosterImage same-path", () => {
  it("no-op when src and dest are the same existing file", async () => {
    const { processPosterImage } = await import("./poster.js");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "mdcs-poster-"));
    const poster = path.join(root, "poster.jpg");
    fs.writeFileSync(poster, "poster");

    const ok = await processPosterImage(poster, poster, {
      cropMode: "none",
      cropRatio: "emby",
      cropIndependentPoster: false,
      preferCropResult: false,
      watermark: defaultWatermarkConfig(),
      mosaic: "有码",
      hasSubtitle: false,
      resolution: "",
      overwriteImages: true,
    });
    assert.equal(ok, true);
    assert.equal(fs.readFileSync(poster, "utf8"), "poster");
  });

  it("returns false when same path but file missing", async () => {
    const { processPosterImage } = await import("./poster.js");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "mdcs-poster-"));
    const poster = path.join(root, "poster.jpg");

    const ok = await processPosterImage(poster, poster, {
      cropMode: "none",
      cropRatio: "emby",
      cropIndependentPoster: false,
      preferCropResult: false,
      watermark: defaultWatermarkConfig(),
      mosaic: "有码",
      hasSubtitle: false,
      resolution: "",
      overwriteImages: true,
    });
    assert.equal(ok, false);
  });

  it("skips right-crop when source is already portrait poster", async () => {
    const sharp = (await import("sharp")).default;
    const { processPosterImage } = await import("./poster.js");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "mdcs-poster-"));
    const src = path.join(root, "src.jpg");
    const dest = path.join(root, "dest.jpg");
    await sharp({
      create: { width: 376, height: 532, channels: 3, background: { r: 200, g: 50, b: 50 } },
    })
      .jpeg()
      .toFile(src);

    const ok = await processPosterImage(src, dest, {
      cropMode: "right",
      cropRatio: "emby",
      cropIndependentPoster: false,
      preferCropResult: true,
      watermark: { ...defaultWatermarkConfig(), enabled: false },
      mosaic: "有码",
      hasSubtitle: false,
      resolution: "",
      overwriteImages: true,
    });
    assert.equal(ok, true);
    const out = await sharp(dest).metadata();
    assert.equal(out.width, 376);
    assert.equal(out.height, 532);
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
