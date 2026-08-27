import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTheporndbSearchPaths, buildTheporndbSearchQueries } from "./theporndb.js";

describe("theporndb provider", () => {
  it("JAV 走 /jav?q=", () => {
    const paths = buildTheporndbSearchPaths("SONE-001");
    assert.ok(paths.some((p) => p.path.includes("/jav?q=SONE-001")));
    assert.equal(paths[0]?.kind, "jav");
  });

  it("欧美走 /scenes?parse= 再 /movies?parse=", () => {
    const paths = buildTheporndbSearchPaths("PURETABOO.2026.07.14");
    assert.ok(paths.some((p) => p.path.includes("/scenes?parse=PURETABOO.2026.07.14")));
    assert.ok(paths.some((p) => p.path.includes("/movies?parse=")));
    assert.ok(!paths.some((p) => p.path.includes("/scenes?q=")));
  });

  it("STUDIO.YYYY.MM.DD 展开站点+日期", () => {
    const q = buildTheporndbSearchQueries("PURETABOO.2026.07.14");
    assert.ok(q.includes("Pure Taboo 2026-07-14"));
  });
});
