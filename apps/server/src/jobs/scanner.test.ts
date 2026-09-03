import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasLocalScrapeSuccess,
  resolveKindScanAbs,
  scanUpdateShouldReindex,
  shouldSkipScanEntry,
} from "./scanner.js";
import type { ResolvedKind } from "../types.js";

describe("resolveKindScanAbs", () => {
  const kind = {
    id: "japan_censored",
    sourceRoot: "media/source",
    sourceAbs: "/proj/media/source",
  } as ResolvedKind;

  it("未指定路径时回退来源根", () => {
    assert.equal(resolveKindScanAbs(kind), kind.sourceAbs);
  });

  it("子路径合法时解析为绝对路径", () => {
    // 无真实目录时跳过；仅测校验逻辑
    assert.throws(
      () => resolveKindScanAbs(kind, "media/other"),
      /必须在分区来源目录下/,
    );
  });
});

const indexed = {
  file_mtime: 1000,
  file_size: 100,
  status: "indexed",
  scraped_at: null,
} as const;

const scraped = {
  file_mtime: 1000,
  file_size: 100,
  status: "scraped",
  scraped_at: 1,
} as const;

const ctx = { code: "ABC-123", kind: "japan_censored" as const };

describe("shouldSkipScanEntry", () => {
  it("无记录时不跳过", () => {
    assert.equal(shouldSkipScanEntry(undefined, 1000, 100, false, ctx), false);
  });

  it("已索引且磁盘未变时不跳过", () => {
    assert.equal(shouldSkipScanEntry(indexed, 1000, 100, false, ctx), false);
  });

  it("已刮削成功且磁盘未变时跳过", () => {
    assert.equal(shouldSkipScanEntry(scraped, 1000, 100, false, ctx), true);
  });

  it("mtime 变化则不跳过", () => {
    assert.equal(shouldSkipScanEntry(scraped, 2000, 100, false, ctx), false);
  });

  it("size 变化则不跳过", () => {
    assert.equal(shouldSkipScanEntry(scraped, 1000, 200, false, ctx), false);
  });

  it("force 时不跳过", () => {
    assert.equal(shouldSkipScanEntry(scraped, 1000, 100, true, ctx), false);
  });
});

describe("hasLocalScrapeSuccess", () => {
  it("scraped 终态视为成功", () => {
    assert.equal(hasLocalScrapeSuccess(scraped, null, "japan_censored"), true);
  });

  it("indexed 无缓存视为未成功", () => {
    assert.equal(hasLocalScrapeSuccess(indexed, "NOPE-999", "japan_censored"), false);
  });
});

describe("scanUpdateShouldReindex", () => {
  it("终态应回到 indexed", () => {
    assert.equal(scanUpdateShouldReindex("done"), true);
    assert.equal(scanUpdateShouldReindex("scraped"), true);
    assert.equal(scanUpdateShouldReindex("failed"), true);
    assert.equal(scanUpdateShouldReindex("planned"), true);
    assert.equal(scanUpdateShouldReindex("organizing"), true);
  });

  it("排队中不强制改状态", () => {
    assert.equal(scanUpdateShouldReindex("indexed"), false);
    assert.equal(scanUpdateShouldReindex("pending"), false);
    assert.equal(scanUpdateShouldReindex("scraping"), false);
  });
});
