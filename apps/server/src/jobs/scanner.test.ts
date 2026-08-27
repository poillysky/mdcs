import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldSkipScanEntry } from "./scanner.js";

describe("shouldSkipScanEntry", () => {
  it("无记录时不跳过", () => {
    assert.equal(shouldSkipScanEntry(undefined, 1000, 100), false);
  });

  it("mtime 与 size 相同则跳过", () => {
    assert.equal(
      shouldSkipScanEntry({ file_mtime: 1000, file_size: 100 }, 1000, 100),
      true,
    );
  });

  it("mtime 变化则不跳过", () => {
    assert.equal(
      shouldSkipScanEntry({ file_mtime: 1000, file_size: 100 }, 2000, 100),
      false,
    );
  });

  it("size 变化则不跳过", () => {
    assert.equal(
      shouldSkipScanEntry({ file_mtime: 1000, file_size: 100 }, 1000, 200),
      false,
    );
  });

  it("force 时不跳过", () => {
    assert.equal(
      shouldSkipScanEntry({ file_mtime: 1000, file_size: 100 }, 1000, 100, true),
      false,
    );
  });
});
