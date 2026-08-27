import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ScrapeMeta } from "./types.js";
import { applyMetaFieldPatches } from "./metaPatch.js";

describe("applyMetaFieldPatches", () => {
  it("persists field values and sources without dropping snapshots", () => {
    const base: ScrapeMeta = {
      code: "SONE-001",
      kind: "japan_censored",
      title: "原标题",
      titleZh: "旧标题",
      actors: [],
      genres: [],
      source: "javbus",
      sourcesTried: ["javbus", "jav321"],
      fieldSources: { title: "javbus" },
      scrapedAt: new Date().toISOString(),
      ok: true,
      sourceSnapshots: {
        javbus: { fields: { title: "原标题" } },
        jav321: { fields: { title: "Jav321 标题" } },
      },
    };
    const next = applyMetaFieldPatches(base, {
      title: { value: "新标题", source: "jav321" },
      studio: { value: "厂商A", source: "custom" },
    });
    assert.equal(next.titleZh, "新标题");
    assert.equal(next.fieldSources.titleZh, "jav321");
    assert.equal(next.studio, "厂商A");
    assert.equal(next.fieldSources.studio, "custom");
    assert.ok(next.sourceSnapshots?.jav321);
  });
});
