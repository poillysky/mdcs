import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { applyFileTransfer } from "./fsops.js";

describe("applyFileTransfer", () => {
  it("hardlink 成功或 fallback copy", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scrap-org-"));
    const src = path.join(dir, "a.mp4");
    const dest = path.join(dir, "lib", "a.mp4");
    fs.writeFileSync(src, "video");
    const r = applyFileTransfer({
      sourceAbs: src,
      targetAbs: dest,
      mode: "hardlink",
      fallback: "copy",
      onConflict: "skip",
    });
    assert.equal(r.ok, true);
    assert.ok(fs.existsSync(r.targetAbs));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("冲突 skip 不覆盖", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scrap-org-"));
    const src = path.join(dir, "a.mp4");
    const dest = path.join(dir, "b.mp4");
    fs.writeFileSync(src, "src");
    fs.writeFileSync(dest, "dest");
    const r = applyFileTransfer({
      sourceAbs: src,
      targetAbs: dest,
      mode: "copy",
      fallback: "copy",
      onConflict: "skip",
    });
    assert.equal(r.ok, true);
    assert.equal(r.action, "skip");
    assert.equal(fs.readFileSync(dest, "utf8"), "dest");
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("dry-run 不写文件", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scrap-org-"));
    const src = path.join(dir, "a.mp4");
    const dest = path.join(dir, "out", "a.mp4");
    fs.writeFileSync(src, "src");
    const r = applyFileTransfer({
      sourceAbs: src,
      targetAbs: dest,
      mode: "copy",
      fallback: "copy",
      onConflict: "skip",
      dryRun: true,
    });
    assert.equal(r.ok, true);
    assert.equal(fs.existsSync(dest), false);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
