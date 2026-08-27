import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  displayPipelinePath,
  isNonCriticalSourceError,
  sourceRunLogTone,
} from "./pipelineLogHelpers.js";
import { PROJECT_ROOT, resolveProjectPath, toProjectRelativePath } from "../paths.js";
import path from "node:path";

describe("pipelineLogHelpers tones", () => {
  it("isNonCriticalSourceError 识别详情页未找到", () => {
    assert.equal(isNonCriticalSourceError("详情页未找到"), true);
    assert.equal(isNonCriticalSourceError("HTTP 404"), true);
    assert.equal(isNonCriticalSourceError("timeout after 30s"), false);
  });

  it("sourceRunLogTone 无数据黄灯、超时红灯", () => {
    assert.equal(
      sourceRunLogTone({ ok: false, error: "详情页未找到", channel: "fast" }),
      "warn",
    );
    assert.equal(
      sourceRunLogTone({ ok: false, error: "timeout", channel: "slow" }),
      "fail",
    );
    assert.equal(sourceRunLogTone({ ok: true, channel: "fast" }), "ok");
  });
});

describe("cover path relative storage", () => {
  it("displayPipelinePath 绝对路径转相对", () => {
    const abs = path.join(PROJECT_ROOT, "data", "covers", "japan_censored", "SONE-999.jpg");
    assert.equal(displayPipelinePath(abs), "data/covers/japan_censored/SONE-999.jpg");
  });

  it("toProjectRelativePath / resolveProjectPath 往返", () => {
    const abs = path.join(PROJECT_ROOT, "data", "covers", "japan_censored", "SONE-999.jpg");
    const rel = toProjectRelativePath(abs);
    assert.equal(rel, "data/covers/japan_censored/SONE-999.jpg");
    assert.equal(resolveProjectPath(rel), abs);
  });
});
