import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { snapshotHasChanges } from "./monitor.js";

describe("snapshotHasChanges", () => {
  it("无基线时不触发", () => {
    const next = new Map([["/a.mp4", { mtime: 1, size: 100 }]]);
    assert.equal(snapshotHasChanges(undefined, next), false);
  });

  it("检测新增文件", () => {
    const prev = new Map([["/a.mp4", { mtime: 1, size: 100 }]]);
    const next = new Map([
      ["/a.mp4", { mtime: 1, size: 100 }],
      ["/b.mp4", { mtime: 2, size: 200 }],
    ]);
    assert.equal(snapshotHasChanges(prev, next), true);
  });

  it("检测同路径 mtime/size 变更", () => {
    const prev = new Map([["/a.mp4", { mtime: 1, size: 100 }]]);
    const next = new Map([["/a.mp4", { mtime: 9, size: 100 }]]);
    assert.equal(snapshotHasChanges(prev, next), true);
  });

  it("未变更时不触发", () => {
    const prev = new Map([["/a.mp4", { mtime: 1, size: 100 }]]);
    const next = new Map([["/a.mp4", { mtime: 1, size: 100 }]]);
    assert.equal(snapshotHasChanges(prev, next), false);
  });
});
