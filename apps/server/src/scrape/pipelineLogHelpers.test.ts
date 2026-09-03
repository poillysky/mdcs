import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  displayPipelinePath,
  ensureOrganizePipelineSteps,
  isCriticalSourceError,
  isNonCriticalSourceError,
  PIPELINE_STEPS,
  sourceRunLogTone,
  startParseStep,
  startScrapeStep,
} from "./pipelineLogHelpers.js";
import { beginPipeline, clearPipeline, getPipeline } from "./pipelineProgress.js";
import { PROJECT_ROOT, resolveProjectPath, toProjectRelativePath } from "../paths.js";
import path from "node:path";

describe("pipelineLogHelpers tones", () => {
  it("isCriticalSourceError 识别超时", () => {
    assert.equal(isCriticalSourceError("timeout after 30s"), true);
    assert.equal(isCriticalSourceError("HTTP POST 失败"), false);
  });

  it("isNonCriticalSourceError 默认真、超时除外", () => {
    assert.equal(isNonCriticalSourceError("详情页未找到"), true);
    assert.equal(isNonCriticalSourceError("HTTP POST 失败 https://www.jav321.com/search"), true);
    assert.equal(isNonCriticalSourceError("timeout after 30s"), false);
  });

  it("sourceRunLogTone 无数据/HTTP 失败黄灯、超时红灯", () => {
    assert.equal(
      sourceRunLogTone({ ok: false, error: "详情页未找到", channel: "fast" }),
      "warn",
    );
    assert.equal(
      sourceRunLogTone({ ok: false, error: "HTTP POST 失败 https://www.jav321.com/search", channel: "fast" }),
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

describe("ensureOrganizePipelineSteps", () => {
  it("刮削两步后仍能补登记整理四步", () => {
    const fileId = 99_001;
    clearPipeline(fileId);
    beginPipeline(fileId, "rescrape", "initial");
    startParseStep(fileId, "media/foo/bar.mp4", "SONE-001", "japan_censored");
    startScrapeStep(fileId, ["dmm"]);
    assert.equal(getPipeline(fileId)?.steps.length, 2);
    ensureOrganizePipelineSteps(fileId);
    const titles = getPipeline(fileId)?.steps.map((s) => s.title) ?? [];
    assert.deepEqual(titles, [
      PIPELINE_STEPS.parse,
      PIPELINE_STEPS.scrape,
      PIPELINE_STEPS.mkdir,
      PIPELINE_STEPS.images,
      PIPELINE_STEPS.transfer,
      PIPELINE_STEPS.nfo,
    ]);
    clearPipeline(fileId);
  });
});
