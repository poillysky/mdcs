import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { findSubtitlesForCode } from "./subtitles.js";

describe("findSubtitlesForCode", () => {
  it("按番号匹配字幕文件名", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scrap-sub-"));
    try {
      fs.writeFileSync(path.join(dir, "SSIS-001.chs.srt"), "1");
      fs.writeFileSync(path.join(dir, "other.srt"), "2");
      const hits = findSubtitlesForCode(dir, "SSIS-001");
      assert.equal(hits.length, 1);
      assert.ok(hits[0]!.includes("SSIS-001"));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
