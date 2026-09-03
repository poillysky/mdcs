import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeJobOptions } from "./options.js";

describe("normalizeJobOptions", () => {
  it("fileIds 升序排序", () => {
    const opts = normalizeJobOptions({ fileIds: [30, 5, 12] });
    assert.deepEqual(opts.fileIds, [5, 12, 30]);
  });

  it("priorityFileIds 保留插队顺序", () => {
    const opts = normalizeJobOptions({ priorityFileIds: [30, 5, 12] });
    assert.deepEqual(opts.priorityFileIds, [30, 5, 12]);
  });
});
