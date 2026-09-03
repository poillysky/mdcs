import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { isUsableLibraryAsset, MIN_LIBRARY_ASSET_BYTES } from "./libraryAssets.js";

describe("libraryAssets usable image", () => {
  it("过小文件视为无效", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mdcs-asset-"));
    const tiny = path.join(dir, "poster.jpg");
    fs.writeFileSync(tiny, Buffer.alloc(521));
    assert.equal(isUsableLibraryAsset(tiny), false);
    fs.writeFileSync(tiny, Buffer.alloc(MIN_LIBRARY_ASSET_BYTES));
    assert.equal(isUsableLibraryAsset(tiny), true);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
