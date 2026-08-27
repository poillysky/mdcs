import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { defaultOrganizeConfig } from "../config/organizeDefaults.js";
import { cleanupSourceDirectory } from "./cleanup.js";
import { copySubtitlesBesideVideo } from "./subtitles.js";

describe("cleanupSourceDirectory", () => {
  it("白名单保护下不删视频，可删小杂项", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scrap-clean-"));
    try {
      fs.writeFileSync(path.join(dir, "SSIS-001.mp4"), Buffer.alloc(200 * 1024 * 1024));
      fs.writeFileSync(path.join(dir, "readme.txt"), "x");
      fs.writeFileSync(path.join(dir, "sample.mp4"), Buffer.alloc(1024));
      const org = defaultOrganizeConfig();
      org.minFileSizeMb = 100;
      org.cleanup.enabled = true;
      org.cleanup.whitelistProtect = true;
      org.cleanup.deleteSmallFiles = true;
      org.cleanup.deleteNonWhitelist = true;
      org.cleanup.deleteBlacklist = false;
      const r = cleanupSourceDirectory(dir, org);
      assert.ok(r.deleted.some((p) => p.endsWith("readme.txt")));
      assert.ok(fs.existsSync(path.join(dir, "SSIS-001.mp4")));
      assert.ok(fs.existsSync(path.join(dir, "sample.mp4"))); // 视频受白名单保护
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("copySubtitlesBesideVideo overwrite", () => {
  it("onConflict=skip 时不覆盖已有字幕，且保留原后缀", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "scrap-sub2-"));
    const lib = path.join(root, "lib");
    const out = path.join(root, "out");
    fs.mkdirSync(lib);
    fs.mkdirSync(out);
    try {
      fs.writeFileSync(path.join(lib, "ABC-123.srt"), "new");
      const video = path.join(out, "ABC-123.mp4");
      fs.writeFileSync(video, "v");
      const dest = path.join(out, "ABC-123.srt");
      fs.writeFileSync(dest, "old");
      copySubtitlesBesideVideo({
        libraryAbs: lib,
        code: "ABC-123",
        videoAbs: video,
        onConflict: "skip",
      });
      assert.equal(fs.readFileSync(dest, "utf8"), "old");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
