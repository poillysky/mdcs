import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { PROJECT_ROOT } from "../paths.js";
import { resolveNfoAbsBesideVideo, resolveStoredTargetAbs, expandLibraryTargetRel } from "./libraryPaths.js";
import type { ResolvedKind } from "../types.js";

const kind: ResolvedKind = {
  id: "japan_censored",
  label: "日本有码",
  enabled: true,
  sourceRoot: "media/本地索引/日本有码",
  libraryRoot: "media/片商目录/日本有码",
  sourceAbs: path.join(PROJECT_ROOT, "media/本地索引/日本有码"),
  libraryAbs: path.join(PROJECT_ROOT, "media/片商目录/日本有码"),
  organizeMode: "hardlink",
  organizeFallback: "copy",
};

describe("libraryPaths", () => {
  it("resolveStoredTargetAbs joins library root for plan targetRel", () => {
    const abs = resolveStoredTargetAbs(kind, "HMN/HMN-456/HMN-456.strm");
    assert.equal(
      abs,
      path.join(PROJECT_ROOT, "media/片商目录/日本有码/HMN/HMN-456/HMN-456.strm"),
    );
  });

  it("resolveNfoAbsBesideVideo places nfo next to video", () => {
    const video = path.join(PROJECT_ROOT, "media/片商目录/日本有码/HMN/HMN-347/HMN-347.strm");
    const nfo = resolveNfoAbsBesideVideo(video, "", PROJECT_ROOT);
    assert.equal(nfo, path.join(PROJECT_ROOT, "media/片商目录/日本有码/HMN/HMN-347/HMN-347.nfo"));
  });

  it("expandLibraryTargetRel prefixes library root for display", () => {
    const rel = expandLibraryTargetRel("HMN/HMN-467/HMN-467.strm", "media/片商目录/日本有码");
    assert.equal(rel, "media/片商目录/日本有码/HMN/HMN-467/HMN-467.strm");
  });

  it("resolveStoredTargetAbs normalizes absolute target_path to library relative", () => {
    const abs = path.join(PROJECT_ROOT, "media/片商目录/日本有码/HMN/HMN-456/HMN-456.strm");
    const resolved = resolveStoredTargetAbs(kind, abs);
    assert.equal(resolved, abs);
  });
});
