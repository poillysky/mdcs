import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildScrapeQueueOrderClause } from "./pipelineState.js";
import { mergePriorityFileIds } from "../jobs/jobOptionsStore.js";

describe("pipelineState priority queue", () => {
  it("无插队时沿用默认排序", () => {
    const clause = buildScrapeQueueOrderClause();
    assert.match(clause.sql, /indexed.*pending/);
    assert.equal(clause.params.length, 0);
  });

  it("插队 id 排在 ORDER BY 最前", () => {
    const clause = buildScrapeQueueOrderClause([9, 3]);
    assert.match(clause.sql, /id IN \(\?,\?\)/);
    assert.deepEqual(clause.params, [9, 3]);
    assert.match(clause.sql, /THEN 0/);
  });
});

describe("mergePriorityFileIds", () => {
  it("新 id 排在既有优先队列之前", () => {
    assert.deepEqual(mergePriorityFileIds([5, 8], [12, 5]), [12, 5, 8]);
  });
});
