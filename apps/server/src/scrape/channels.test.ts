import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allFastNoDetail,
  isNoDetailError,
  listUntriedFlareSources,
  shouldRunDeferredPass,
  sourceNeedsFlare,
  splitSourcesByChannel,
} from "./channels.js";
import { runPool } from "./pool.js";

describe("sourceNeedsFlare", () => {
  it("javdb 为 proxy_flare，进慢通道", () => {
    assert.equal(sourceNeedsFlare("javdb"), true);
  });

  it("javbus / jav321 / libredmm 不进慢通道", () => {
    assert.equal(sourceNeedsFlare("javbus"), false);
    assert.equal(sourceNeedsFlare("jav321"), false);
    assert.equal(sourceNeedsFlare("libredmm"), false);
  });
});

describe("splitSourcesByChannel", () => {
  const sources = ["javbus", "jav321", "javdb", "libredmm"];

  it("fast 跳过 flare，记入 deferredFlare", () => {
    const { use, deferredFlare } = splitSourcesByChannel(sources, "fast");
    assert.deepEqual(use, ["javbus", "jav321", "libredmm"]);
    assert.deepEqual(deferredFlare, ["javdb"]);
  });

  it("slow 只保留 flare 源", () => {
    const { use, deferredFlare } = splitSourcesByChannel(sources, "slow");
    assert.deepEqual(use, ["javdb"]);
    assert.deepEqual(deferredFlare, []);
  });

  it("auto 使用全部源", () => {
    const { use, deferredFlare } = splitSourcesByChannel(sources, "auto");
    assert.deepEqual(use, sources);
    assert.deepEqual(deferredFlare, []);
  });
});

describe("isNoDetailError", () => {
  it("识别空号类错误", () => {
    assert.equal(isNoDetailError("未找到"), true);
    assert.equal(isNoDetailError("HTTP 500"), false);
    assert.equal(allFastNoDetail([{ error: "未找到" }, { error: "not found" }], 2), true);
    assert.equal(allFastNoDetail([{ error: "timeout" }], 1), false);
  });
});

describe("runPool", () => {
  it("限制并发且不阻塞失败项之后的任务", async () => {
    const seen: number[] = [];
    let inflight = 0;
    let maxInflight = 0;
    await runPool([1, 2, 3, 4, 5], 2, async (n) => {
      inflight += 1;
      maxInflight = Math.max(maxInflight, inflight);
      await new Promise((r) => setTimeout(r, 20));
      seen.push(n);
      inflight -= 1;
    });
    assert.equal(seen.length, 5);
    assert.ok(maxInflight <= 2);
  });
});

describe("listUntriedFlareSources", () => {
  it("returns flare sources not yet tried", () => {
    assert.deepEqual(
      listUntriedFlareSources(["javbus", "jav321", "javdb"], ["javbus", "jav321"]),
      ["javdb"],
    );
  });
});

describe("shouldRunDeferredPass", () => {
  it("runs when metadata ok but flare sources remain", () => {
    assert.equal(
      shouldRunDeferredPass({
        metaOk: true,
        coverUrl: "https://example.test/a.jpg",
        allSources: ["javbus", "javdb"],
        sourcesTried: ["javbus"],
        deferredFlare: ["javdb"],
        fastResults: [{ error: undefined }],
        fastRanCount: 1,
      }),
      true,
    );
  });

  it("skips when all fast sources returned not found", () => {
    assert.equal(
      shouldRunDeferredPass({
        metaOk: false,
        coverUrl: null,
        allSources: ["javbus", "javdb"],
        sourcesTried: ["javbus"],
        deferredFlare: ["javdb"],
        fastResults: [{ error: "未找到" }],
        fastRanCount: 1,
      }),
      false,
    );
  });
});
