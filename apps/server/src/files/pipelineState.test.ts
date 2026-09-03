import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FILE_ORGANIZE_QUEUE_ORDER_SQL,
  FILE_SCRAPE_QUEUE_ORDER_SQL,
  isFilePipelineInflight,
  isFileTerminalStatus,
  isFileWaitingStatus,
} from "./pipelineState.js";

describe("pipelineState", () => {
  it("终态仅 done/failed/skipped", () => {
    assert.equal(isFileTerminalStatus("done"), true);
    assert.equal(isFileTerminalStatus("scraped"), false);
  });

  it("流水线中途含 scraping/scraped/planned/organizing", () => {
    assert.equal(isFilePipelineInflight("scraped"), true);
    assert.equal(isFilePipelineInflight("indexed"), false);
  });

  it("等待中仅 indexed/pending", () => {
    assert.equal(isFileWaitingStatus("indexed"), true);
    assert.equal(isFileWaitingStatus("planned"), false);
  });

  it("刮削/整理队列排序 SQL", () => {
    assert.match(FILE_SCRAPE_QUEUE_ORDER_SQL, /indexed.*pending/);
    assert.match(FILE_SCRAPE_QUEUE_ORDER_SQL, /id ASC/);
    assert.match(FILE_ORGANIZE_QUEUE_ORDER_SQL, /scraped.*planned/);
  });
});
