import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultNamingConfig } from "./namingConfig.js";
import {
  detectResolutionFromPath,
  mapResolutionText,
  resolveResolutionKey,
} from "./resolution.js";

describe("resolution", () => {
  it("路径关键词识别档位", () => {
    assert.equal(detectResolutionFromPath("a/1080p", "x.mp4"), "1080P");
    assert.equal(detectResolutionFromPath("a", "x-4K.mp4"), "4K");
    assert.equal(detectResolutionFromPath("a", "plain.mp4"), "");
  });

  it("textMap 按 720P/1080P/4K/8K 顺序映射", () => {
    assert.equal(mapResolutionText("1080P", "A, B, C, D"), "B");
    assert.equal(mapResolutionText("4K", "A, B, C, D"), "C");
    assert.equal(mapResolutionText("未知", "A, B, C, D"), "未知");
  });

  it("prefer_path：路径命中则不探 probe", () => {
    const naming = {
      ...defaultNamingConfig(),
      resolutionSource: "prefer_path" as const,
      resolutionFallback: true,
    };
    assert.equal(
      resolveResolutionKey({
        naming,
        sourcePath: "inbox",
        fileName: "x-720p.mp4",
        videoAbs: "C:\\no-such-file.mp4",
      }),
      "720P",
    );
  });

  it("path 模式：仅路径", () => {
    const naming = {
      ...defaultNamingConfig(),
      resolutionSource: "path" as const,
      resolutionFallback: true,
    };
    assert.equal(
      resolveResolutionKey({
        naming,
        sourcePath: "inbox",
        fileName: "plain.mp4",
        videoAbs: "C:\\no-such-file.mp4",
      }),
      "",
    );
  });
});
