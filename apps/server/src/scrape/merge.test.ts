import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  collectScrapeSourceIds,
  mergeResultsForKind,
  mergeScrapeResults,
  pickCoverStrict,
  pickFieldStrict,
  resolveCoverSourceOrder,
  resolveFieldSourceOrder,
} from "./merge.js";
import type { ProviderResult, SourceId } from "./types.js";

function result(source: SourceId, fields: Record<string, unknown>, coverUrl?: string): ProviderResult {
  return { source, fields, coverUrl, ms: 10 };
}

describe("resolveFieldSourceOrder", () => {
  const global = { title: ["javbus", "jav321"], plot: [] as SourceId[] };
  const kind = { title: ["libredmm"], plot: [] as SourceId[] };
  const meta = ["javbus", "jav321", "libredmm"] as SourceId[];

  it("非空 kind 列表优先，再回退 metaSources", () => {
    assert.deepEqual(resolveFieldSourceOrder("title", kind, global, meta), [
      "libredmm",
      "javbus",
      "jav321",
    ]);
  });

  it("空 kind 列表继承 global 字段链后再回退 meta", () => {
    assert.deepEqual(resolveFieldSourceOrder("plot", kind, global, meta), meta);
  });

  it("空 global 字段链回退 metaSources", () => {
    assert.deepEqual(resolveFieldSourceOrder("plot", undefined, global, meta), meta);
  });

  it("未配置字段回退 metaSources", () => {
    assert.deepEqual(resolveFieldSourceOrder("studio", kind, global, meta), meta);
  });

  it("字段链优先于 meta，字段 miss 时由 meta 补充", () => {
    const bySource = new Map<SourceId, ProviderResult>([
      ["dmm", result("dmm", {})],
      ["javbus", result("javbus", { score: 8.5 })],
    ]);
    const order = resolveFieldSourceOrder("score", undefined, { score: ["dmm", "jav321"] }, [
      "javbus",
      "jav321",
    ]);
    const pick = pickFieldStrict<number>("score", order, bySource);
    assert.equal(pick.value, 8.5);
    assert.equal(pick.source, "javbus");
  });
});

describe("collectScrapeSourceIds", () => {
  it("合并 meta、cover 与字段优先级源", () => {
    const ids = collectScrapeSourceIds(
      { score: ["dmm", "jav321"], titleZh: ["iqqtv"] },
      undefined,
      ["javbus", "jav321"],
      ["libredmm"],
    );
    assert.deepEqual(ids, ["javbus", "jav321", "libredmm", "dmm", "iqqtv"]);
  });
});

describe("pickFieldStrict", () => {
  it("只按 order 取，不扫描其他源", () => {
    const bySource = new Map<SourceId, ProviderResult>([
      ["javbus", result("javbus", { title: "from javbus" })],
      ["jav321", result("jav321", { title: "from jav321" })],
    ]);
    const pick = pickFieldStrict<string>("title", ["libredmm"], bySource);
    assert.equal(pick.value, undefined);
    assert.equal(pick.source, undefined);
  });

  it("plot 可从 outline 别名读取", () => {
    const bySource = new Map<SourceId, ProviderResult>([
      ["jav321", result("jav321", { outline: "story" })],
    ]);
    const meta = mergeScrapeResults(
      "ABC-123",
      "japan_censored",
      bySource,
      ["jav321"],
      { plot: ["jav321"] },
      undefined,
    );
    assert.equal(meta.plot, "story");
    assert.equal(meta.fieldSources.plot, "jav321");
  });
});

describe("pickCoverStrict", () => {
  it("按 cover 优先级，不回退全源", () => {
    const bySource = new Map<SourceId, ProviderResult>([
      ["javbus", result("javbus", {}, "http://a/cover.jpg")],
      ["javdb", result("javdb", {}, "http://b/cover.jpg")],
    ]);
    assert.deepEqual(pickCoverStrict(["javdb"], bySource), {
      url: "http://b/cover.jpg",
      source: "javdb",
      ms: 10,
    });
    assert.deepEqual(pickCoverStrict(["libredmm"], bySource), {});
  });
});

describe("mergeScrapeResults", () => {
  it("genres 从 tags 别名合并", () => {
    const bySource = new Map<SourceId, ProviderResult>([
      ["javbus", result("javbus", { title: "T", tags: ["Drama"] })],
    ]);
    const meta = mergeScrapeResults(
      "X",
      "japan_censored",
      bySource,
      ["javbus"],
      { title: ["javbus"], genres: ["javbus"] },
      undefined,
    );
    assert.deepEqual(meta.genres, ["Drama"]);
  });

  it("publishNumber 按字段优先级取 dmm（即使不在 metaSources）", () => {
    const bySource = new Map<SourceId, ProviderResult>([
      ["javbus", result("javbus", { title: "T" })],
      ["dmm", result("dmm", { publishNumber: "sone00999", title: "JP" })],
    ]);
    const meta = mergeScrapeResults(
      "SONE-999",
      "japan_censored",
      bySource,
      ["javbus", "dmm"],
      { publishNumber: ["dmm", "jav321"], title: ["javbus"] },
      undefined,
    );
    assert.equal(meta.publishNumber, "sone00999");
    assert.equal(meta.fieldSources.publishNumber, "dmm");
  });

  it("ratingValue 继承 score 字段优先级（dmm 不在 metaSources 也能取原生分）", () => {
    const bySource = new Map<SourceId, ProviderResult>([
      ["javbus", result("javbus", { title: "T" })],
      [
        "dmm",
        result("dmm", {
          score: 9.42,
          ratingValue: 4.71,
          ratingMax: 5,
          ratingSource: "dmm",
        }),
      ],
    ]);
    const meta = mergeScrapeResults(
      "SONE-999",
      "japan_censored",
      bySource,
      ["javbus"],
      { score: ["dmm", "jav321"], title: ["javbus"] },
      undefined,
    );
    assert.equal(meta.score, 9.42);
    assert.equal(meta.ratingValue, 4.71);
    assert.equal(meta.ratingMax, 5);
    assert.equal(meta.fieldSources.score, "dmm");
    assert.equal(meta.fieldSources.ratingValue, "dmm");
  });

  it("写入 fieldTimings", () => {
    const bySource = new Map<SourceId, ProviderResult>([
      ["javbus", result("javbus", { title: "T" })],
    ]);
    const meta = mergeScrapeResults(
      "X",
      "japan_censored",
      bySource,
      ["javbus"],
      { title: ["javbus"] },
      undefined,
    );
    assert.ok(meta.fieldTimings?.some((t) => t.field === "title" && t.source === "javbus"));
  });
});

describe("resolveCoverSourceOrder", () => {
  it("cover 字段链优先，再回退 coverSources", () => {
    const coverSources = ["javbus", "jav321"] as SourceId[];
    assert.deepEqual(
      resolveCoverSourceOrder({ cover: [] }, { cover: ["javdb"] }, coverSources),
      ["javdb", "javbus", "jav321"],
    );
    assert.deepEqual(resolveCoverSourceOrder({ cover: [] }, { cover: [] }, coverSources), coverSources);
  });
});

describe("mergeResultsForKind", () => {
  it("字段链优先、全局 meta 补充 originalPlot 与 titleZh", () => {
    const bySource = new Map<SourceId, ProviderResult>([
      ["dmm", result("dmm", { title: "日文标题", originalPlot: "日文简介" })],
      ["airav_io", result("airav_io", { titleZh: "中文标题", plot: "中文简介" })],
      ["javbus", result("javbus", { originalPlot: "bus简介" })],
    ]);
    const meta = mergeScrapeResults(
      "SONE-001",
      "japan_censored",
      bySource,
      ["dmm", "airav_io", "javbus"],
      {
        titleZh: ["airav_io"],
        originalPlot: ["dmm"],
      },
      undefined,
    );
    assert.equal(meta.titleZh, "中文标题");
    assert.equal(meta.fieldSources?.titleZh, "airav_io");
    assert.equal(meta.originalPlot, "日文简介");
    assert.equal(meta.fieldSources?.originalPlot, "dmm");
  });
});
