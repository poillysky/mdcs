import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listCatalogIds, SOURCE_CATALOG } from "./catalog.js";
import {
  compareProviderCatalogEntries,
  PROVIDER_GROUP_ORDER,
  sortProviderCatalogEntries,
} from "./catalogTypes.js";

describe("SOURCE_CATALOG", () => {
  it("精简后 31 个 Provider（无 forum）", () => {
    assert.equal(SOURCE_CATALOG.length, 31);
    assert.equal(listCatalogIds().length, 31);
    assert.ok(!listCatalogIds().includes("forum"));
  });

  it("javbus 标记为已实现", () => {
    const javbus = SOURCE_CATALOG.find((e) => e.id === "javbus");
    assert.ok(javbus?.implemented);
    assert.equal(javbus?.access, "proxy_adaptive");
  });

  it("批次 A 含 dmm，javdb 为 proxy_flare", () => {
    for (const id of ["javbus", "dmm", "jav321", "libredmm", "javdb"]) {
      assert.ok(SOURCE_CATALOG.find((e) => e.id === id)?.implemented, id);
    }
    assert.equal(SOURCE_CATALOG.find((e) => e.id === "javdb")?.access, "proxy_flare");
  });

  it("已实现 Provider 31 个", () => {
    for (const id of [
      "airav",
      "airav_io",
      "iqqtv",
      "freejavbt",
      "carib",
      "avsox",
      "avmoo",
      "avsex",
      "avbase",
      "mgstage",
      "fc2",
      "fc2_hub",
      "fd2ppv",
      "madou",
      "madouqu",
      "hscangku",
      "xiao_huang_shu",
      "lulubar",
      "r18dev",
      "sevenmmtv",
      "theporndb",
      "avheat",
      "javday",
      "javlibrary",
      "miss_av",
      "njav",
    ]) {
      assert.ok(SOURCE_CATALOG.find((e) => e.id === id)?.implemented, id);
    }
    const implementedCount = SOURCE_CATALOG.filter((e) => e.implemented).length;
    assert.equal(implementedCount, 31);
  });

  it("含六类 UI 分组", () => {
    for (const g of ["av", "uncensored", "fc2", "chinese", "western", "general"] as const) {
      assert.ok(SOURCE_CATALOG.some((e) => e.group === g), g);
    }
    assert.ok(!SOURCE_CATALOG.some((e) => e.group === "other" as never));
    assert.equal(SOURCE_CATALOG.find((e) => e.id === "javday")?.group, "general");
    assert.equal(SOURCE_CATALOG.find((e) => e.id === "lulubar")?.group, "general");
    assert.equal(PROVIDER_GROUP_ORDER.at(-1), "general");
  });

  it("javdb 默认冷却 10s", () => {
    assert.equal(SOURCE_CATALOG.find((e) => e.id === "javdb")?.defaultCooldownSec, 10);
  });

  it("不再使用 direct/proxy：已并入 proxy_adaptive", () => {
    for (const e of SOURCE_CATALOG) {
      assert.notEqual(e.access, "direct", e.id);
      assert.notEqual(e.access, "proxy", e.id);
    }
  });

  it("id 唯一", () => {
    const ids = new Set(listCatalogIds());
    assert.equal(ids.size, SOURCE_CATALOG.length);
  });

  it("同组内按 access 排序：自适应 → 过盾", () => {
    const av = sortProviderCatalogEntries(SOURCE_CATALOG.filter((e) => e.group === "av"));
    const accessOrder = av.map((e) => e.access);
    const ranks = accessOrder.map((a) => (a === "proxy_flare" ? 1 : 0));
    for (let i = 1; i < ranks.length; i++) {
      assert.ok(ranks[i]! >= ranks[i - 1]!, `${av[i - 1]?.id} → ${av[i]?.id}`);
    }
    assert.equal(
      compareProviderCatalogEntries(
        { access: "proxy", implemented: true, label: "A" },
        { access: "proxy_adaptive", implemented: true, label: "B" },
      ),
      "A".localeCompare("B", "zh-CN"),
    );
    assert.ok(compareProviderCatalogEntries(
      { access: "proxy_adaptive", implemented: true, label: "A" },
      { access: "proxy_flare", implemented: true, label: "B" },
    ) < 0);
  });
});
