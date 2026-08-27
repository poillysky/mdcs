import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dmmCoverUrls, guessDmmCids } from "./dmmCid.js";

describe("guessDmmCids", () => {
  it("SONE-001 首个候选 sone00001", () => {
    const cids = guessDmmCids("SONE-001");
    assert.equal(cids[0], "sone00001");
    assert.ok(cids.includes("sone00001"));
  });

  it("FC2 不猜 CID", () => {
    assert.deepEqual(guessDmmCids("FC2-1234567"), []);
  });

  /** 移植 MDCX test_dmm_direct.py 核心用例（当前实现已覆盖部分） */
  it("IPX-535 首个候选 ipx00535", () => {
    const cids = guessDmmCids("IPX-535");
    assert.equal(cids[0], "ipx00535");
    assert.ok(cids.includes("ipx00535"));
  });

  it("SSIS-001 / MIDV-100 五位数补零", () => {
    assert.ok(guessDmmCids("SSIS-001").includes("ssis00001"));
    assert.ok(guessDmmCids("MIDV-100").includes("midv00100"));
  });

  it("AVOP 系列含阈值候选", () => {
    assert.ok(guessDmmCids("AVOP-100").includes("avop00100"));
    assert.ok(guessDmmCids("AVOP-1").includes("avop00001"));
  });

  it("前缀系列 DISM / HODV", () => {
    assert.ok(guessDmmCids("DISM-123").includes("1dism00123"));
    assert.ok(guessDmmCids("HODV-001").includes("5642hodv00001"));
  });

  it("T28 数字系列", () => {
    assert.ok(guessDmmCids("T28-123").includes("55t2800123"));
    assert.ok(guessDmmCids("T28-123").includes("t2800123"));
  });

  it("无效番号返回空", () => {
    assert.deepEqual(guessDmmCids(""), []);
    assert.deepEqual(guessDmmCids("abc"), []);
    assert.deepEqual(guessDmmCids("12345"), []);
  });

  it("候选无重复", () => {
    const cids = guessDmmCids("IPX-535");
    assert.equal(cids.length, new Set(cids).size);
  });
});

describe("dmmCoverUrls", () => {
  it("生成 pl/ps CDN URL", () => {
    const u = dmmCoverUrls("sone00001");
    assert.match(u.pl, /sone00001pl\.jpg$/);
    assert.match(u.awsPl, /awsimgsrc\.dmm/);
  });
});
