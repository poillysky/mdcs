import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyFromPath, resolveFileKind } from "./classify.js";

describe("classifyFromPath", () => {
  it("识别无码破解", () => {
    const r = classifyFromPath("inbox/有码/SSIS-001-破解.mp4", "SSIS-001-破解.mp4", "SSIS-001");
    assert.equal(r.mosaic, "无码破解");
    assert.ok(r.matched.length);
  });

  it("识别无码流出", () => {
    const r = classifyFromPath("D:/vids/流出/ABC-123.mp4", "ABC-123.mp4", "ABC-123");
    assert.equal(r.mosaic, "无码流出");
  });

  it("识别无码路径", () => {
    const r = classifyFromPath("inbox/无码/carib-123.mp4", "carib-123.mp4", null);
    assert.equal(r.mosaic, "无码");
    assert.equal(r.suggestedKind, "japan_uncensored");
  });

  it("识别有码", () => {
    const r = classifyFromPath("library/有码/IPX-177.mp4", "IPX-177.mp4", "IPX-177");
    assert.equal(r.mosaic, "有码");
  });

  it("FC2 番号建议 fc2 kind", () => {
    const r = classifyFromPath("inbox/other/a.mp4", "FC2-PPV-1234567.mp4", "FC2-PPV-1234567");
    assert.equal(r.suggestedKind, "fc2");
  });

  it("麻豆路径建议 china", () => {
    const r = classifyFromPath("inbox/国产/麻豆/MD-001.mp4", "MD-001.mp4", "MD-001");
    assert.equal(r.suggestedKind, "china");
  });

  it("国产无码路径不被泛义无码判成日本无码", () => {
    const r = classifyFromPath("inbox/国产无码/MD-001.mp4", "MD-001.mp4", "MD-001");
    assert.equal(r.suggestedKind, "china");
    assert.equal(r.mosaic, "无码");
  });

  it("国产分区扫描不被无码关键词覆盖", () => {
    assert.equal(
      resolveFileKind("china", { suggestedKind: "japan_uncensored" }),
      "china",
    );
  });

  it("无关键词时 mosaic 为空", () => {
    const r = classifyFromPath("inbox/misc/foo.mp4", "foo.mp4", null);
    assert.equal(r.mosaic, "");
  });

  it("自定义番号前缀优先于路径", () => {
    const words = {
      code: { japan_censored: ["SSIS"], china: ["MD"] },
      path: { china: ["国产"] },
    };
    const r = classifyFromPath(
      "inbox/国产/foo.mp4",
      "SSIS-001.mp4",
      "SSIS-001",
      undefined,
      words,
    );
    assert.equal(r.suggestedKind, "japan_censored");
  });

  it("自定义路径识别", () => {
    const words = { code: {}, path: { china: ["麻豆"] } };
    const r = classifyFromPath("inbox/麻豆/MD-001.mp4", "MD-001.mp4", "MD-001", undefined, words);
    assert.equal(r.suggestedKind, "china");
  });

  it("自定义番号前缀忽略大小写", () => {
    const words = { code: { western: ["wlt"] }, path: {} };
    const r = classifyFromPath("inbox/foo.mp4", "WLT-001.mp4", "WLT-001", undefined, words);
    assert.equal(r.suggestedKind, "western");
  });

  it("自定义 FC2 番号前缀", () => {
    const words = { code: { fc2: ["FC2-PPV"] }, path: {} };
    const r = classifyFromPath("inbox/foo.mp4", "a.mp4", "FC2-PPV-1234567", undefined, words);
    assert.equal(r.suggestedKind, "fc2");
  });

  it("自定义写真路径识别", () => {
    const words = { code: {}, path: { japan_gravure: ["gravure"] } };
    const r = classifyFromPath("inbox/gravure/set.mp4", "set.mp4", null, undefined, words);
    assert.equal(r.suggestedKind, "japan_gravure");
  });
});

describe("resolveFileKind", () => {
  it("有 suggestedKind 时用识别结果", () => {
    assert.equal(
      resolveFileKind("japan_censored", { suggestedKind: "china" }),
      "china",
    );
  });

  it("无 suggestedKind 时保留扫描分区", () => {
    assert.equal(resolveFileKind("japan_censored", {}), "japan_censored");
  });
});
