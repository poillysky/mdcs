import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appendFileListStatusFilter, resolveFileListOrderBy, shouldExcludeIndexed } from "./listFilters.js";

describe("appendFileListStatusFilter", () => {
  it("processing 含刮削+整理流水线", () => {
    const where: string[] = [];
    const params: (string | number)[] = [];
    appendFileListStatusFilter("processing", where, params);
    const sql = where[0]!;
    assert.match(sql, /scraping/);
    assert.match(sql, /scraped/);
    assert.match(sql, /planned/);
    assert.match(sql, /organizing/);
  });

  it("waiting 仅 indexed / pending", () => {
    const where: string[] = [];
    const params: (string | number)[] = [];
    appendFileListStatusFilter("waiting", where, params);
    assert.equal(where[0], `(f.status IN ('indexed', 'pending'))`);
  });

  it("skipped 等精确状态走等值匹配", () => {
    const where: string[] = [];
    const params: (string | number)[] = [];
    appendFileListStatusFilter("skipped", where, params);
    assert.deepEqual(where, ["f.status = ?"]);
    assert.deepEqual(params, ["skipped"]);
  });
});

describe("shouldExcludeIndexed", () => {
  it("任务范围内列表保留 indexed", () => {
    assert.equal(shouldExcludeIndexed(true, "failed", "job_x"), false);
  });

  it("processing 筛选不叠加 excludeIndexed", () => {
    assert.equal(shouldExcludeIndexed(true, "processing", ""), false);
  });
});

describe("resolveFileListOrderBy", () => {
  it("id 按索引升序", () => {
    assert.equal(resolveFileListOrderBy("id"), "f.id ASC");
    assert.equal(resolveFileListOrderBy("index"), "f.id ASC");
  });

  it("code 按番号升序", () => {
    const sql = resolveFileListOrderBy("code");
    assert.match(sql, /f\.code COLLATE NOCASE ASC/);
    assert.match(sql, /f\.id ASC/);
  });

  it("默认按活动时间降序", () => {
    const sql = resolveFileListOrderBy();
    assert.match(sql, /DESC/);
  });
});
