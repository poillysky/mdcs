import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getMasterSource,
  listMasterSourceIds,
  SOURCE_CATALOG,
} from "./sourceMaster.js";

describe("SOURCE_MASTER_LIST", () => {
  it("精简后 31 源（综合+品类枢纽）", () => {
    assert.equal(SOURCE_CATALOG.length, 31);
    assert.equal(listMasterSourceIds().length, 31);
  });

  it("id 无重复", () => {
    const ids = SOURCE_CATALOG.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("已清除单厂与冗余通道", () => {
    for (const id of [
      "cnmdb",
      "love6",
      "mdtv",
      "dahlia",
      "faleno",
      "prestige",
      "fantastica",
      "giga",
      "xcity",
      "getchu",
      "heyzo",
      "1pondo",
      "dmm_api",
      "javdb_api",
      "fanza",
      "official",
      "fc2fan",
    ]) {
      assert.equal(getMasterSource(id), undefined, id);
    }
  });

  it("灰区与综合站仍在", () => {
    for (const id of ["carib", "mgstage", "avsex", "javday", "njav", "miss_av", "javbus"]) {
      assert.ok(getMasterSource(id), id);
    }
  });
});
