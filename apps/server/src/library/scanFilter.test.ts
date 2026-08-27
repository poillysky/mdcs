import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { isMinSizeExempt, passesMinSize } from "./scanFilter.js";

describe("passesMinSize strm 豁免", () => {
  it("识别 .strm 为体积豁免", () => {
    assert.equal(isMinSizeExempt("a/b/SONE-001.strm"), true);
    assert.equal(isMinSizeExempt("a/b/SONE-001.STRM"), true);
    assert.equal(isMinSizeExempt("a/b/SONE-001.mp4"), false);
  });

  it("minBytes>0 时小体积 strm 仍通过，小 mp4 不通过", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scrap-minsize-"));
    try {
      const strm = path.join(dir, "SONE-001.strm");
      const mp4 = path.join(dir, "SONE-001.mp4");
      fs.writeFileSync(strm, "SONE-001\n");
      fs.writeFileSync(mp4, Buffer.alloc(1024));
      const minBytes = 100 * 1024 * 1024;
      assert.equal(passesMinSize(strm, minBytes), true);
      assert.equal(passesMinSize(mp4, minBytes), false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
