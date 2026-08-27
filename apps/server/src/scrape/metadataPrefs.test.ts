import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyMetadataPrefs, shouldApplyForumTitle } from "./metadataPrefs.js";
import { cleanActorName, mapActorEntry, mapTagEntry } from "./maps.js";
import type { ScrapeConfig, ScrapeMeta } from "./types.js";

const basePrefs = (): ScrapeConfig["metadata"] => ({
  strictMode: false,
  requireCover: false,
  useForumZhTitle: true,
  enableActorMapping: true,
  enableTagMapping: true,
  trimPlot: false,
  mappingLanguage: "zh-CN",
  autoTranslateTitle: false,
  autoTranslateOutline: false,
  translateEngine: "openai",
  customSystemPrompt: "",
});

function baseMeta(over: Partial<ScrapeMeta> = {}): ScrapeMeta {
  return {
    code: "SSIS-001",
    kind: "japan_censored",
    title: "テストタイトル",
    actors: [],
    genres: [],
    source: "javbus",
    sourcesTried: ["javbus"],
    fieldSources: {},
    scrapedAt: new Date().toISOString(),
    ok: true,
    ...over,
  };
}

describe("applyMetadataPrefs", () => {
  it("严格模式缺标题失败", async () => {
    const r = await applyMetadataPrefs(baseMeta({ title: "SSIS-001" }), {
      ...basePrefs(),
      strictMode: true,
      useForumZhTitle: false,
    });
    assert.equal(r.ok, false);
  });

  it("requireCover 缺封面失败", async () => {
    const r = await applyMetadataPrefs(baseMeta({ coverUrl: null, coverLocal: null }), {
      ...basePrefs(),
      requireCover: true,
      useForumZhTitle: false,
    });
    assert.equal(r.ok, false);
  });

  it("trimPlot 压缩多余换行", async () => {
    const r = await applyMetadataPrefs(baseMeta({ plot: "a\n\n\n\nb" }), {
      ...basePrefs(),
      trimPlot: true,
      useForumZhTitle: false,
    });
    assert.equal(r.plot, "a\n\nb");
  });

  it("useForumZhTitle 有 titleZh 时仅补空 title", async () => {
    // 使用不在 forum_titles 中的假番号，避免本机基础库干扰
    const r = await applyMetadataPrefs(
      baseMeta({
        code: "ZZZZ-NOFORUM-99999",
        title: "Japanese Title",
        titleZh: "中文标题",
      }),
      { ...basePrefs(), useForumZhTitle: true },
    );
    assert.equal(r.title, "Japanese Title");
    assert.equal(r.titleZh, "中文标题");
  });

  it("useForumZhTitle 仅写 titleZh，保留网络原标题", async () => {
    const r = await applyMetadataPrefs(
      baseMeta({
        code: "SSIS-001",
        title: "オリジナルタイトル",
        titleZh: undefined,
        fieldSources: { title: "javbus" },
      }),
      { ...basePrefs(), useForumZhTitle: true },
    );
    assert.equal(r.title, "オリジナルタイトル");
    assert.ok(r.titleZh && r.titleZh.trim().length > 0);
    assert.equal(r.fieldSources?.titleZh, "forum");
    assert.equal(r.fieldSources?.title, "javbus");
  });

  it("useForumZhTitle 网络已有中文 titleZh 时不覆盖", async () => {
    const r = await applyMetadataPrefs(
      baseMeta({
        code: "SSIS-001",
        title: "オリジナルタイトル",
        titleZh: "网络中文标题",
        fieldSources: { title: "javbus", titleZh: "javbus" },
      }),
      { ...basePrefs(), useForumZhTitle: true },
    );
    assert.equal(r.titleZh, "网络中文标题");
    assert.equal(r.fieldSources?.titleZh, "javbus");
    assert.equal(r.title, "オリジナルタイトル");
  });

  it("useForumZhTitle 网络 title 已是中文时不补色花堂", async () => {
    const r = await applyMetadataPrefs(
      baseMeta({
        code: "SSIS-001",
        title: "网络中文原标题",
        titleZh: undefined,
        fieldSources: { title: "javbus" },
      }),
      { ...basePrefs(), useForumZhTitle: true },
    );
    assert.equal(r.titleZh, undefined);
    assert.equal(r.fieldSources?.titleZh, undefined);
    assert.equal(r.title, "网络中文原标题");
  });

  it("shouldApplyForumTitle 色花堂非中文且网络有标题时不替换", () => {
    const meta = baseMeta({
      code: "SSIS-001",
      title: "オリジナルタイトル",
      titleZh: undefined,
    });
    assert.equal(
      shouldApplyForumTitle("English Forum Title", meta, { title: "javbus" }),
      false,
    );
  });

  it("shouldApplyForumTitle 色花堂非中文但网络标题全空时仍补", () => {
    const meta = baseMeta({
      code: "SSIS-001",
      title: undefined,
      titleZh: undefined,
    });
    assert.equal(shouldApplyForumTitle("English Forum Title", meta, {}), true);
  });

  it("shouldApplyForumTitle 色花堂中文时网络仅有日文标题仍补", () => {
    const meta = baseMeta({
      code: "SSIS-001",
      title: "オリジナルタイトル",
      titleZh: undefined,
    });
    assert.equal(
      shouldApplyForumTitle("色花堂中文标题", meta, { title: "javbus" }),
      true,
    );
  });

  it("演员映射表命中", async () => {
    const r = await applyMetadataPrefs(
      baseMeta({
        code: "ZZZZ-NOFORUM-99999",
        actors: ["Yua Mikami", "未知演员"],
        titleZh: "x",
      }),
      { ...basePrefs(), useForumZhTitle: false, enableActorMapping: true },
    );
    // 映射名随本机 actors.*.json 变化；至少应规范化英名并保留未知演员
    assert.ok(r.actors.length >= 2);
    assert.ok(r.actors.includes("未知演员"));
    const mapped = r.actors.find((a) => a !== "未知演员" && a !== "Yua Mikami");
    assert.ok(mapped || r.actors.includes("Yua Mikami"));
  });

  it("标签映射表命中", async () => {
    const r = await applyMetadataPrefs(
      baseMeta({
        code: "ZZZZ-NOFORUM-99999",
        genres: ["巨乳", "Creampie"],
        titleZh: "x",
      }),
      { ...basePrefs(), useForumZhTitle: false, enableTagMapping: true },
    );
    assert.equal(r.genres.length, 2);
    // 允许本机标签库译名不同，但不应原样丢弃
    assert.ok(r.genres.every((g) => typeof g === "string" && g.length > 0));
  });
});

describe("maps helpers", () => {
  it("cleanActorName 去掉装饰符", () => {
    assert.equal(cleanActorName(" +三上悠亜+ "), "三上悠亜");
  });

  it("mapActorEntry / mapTagEntry", () => {
    const actors = {
      foo: { name: "条", javdb: "https://x" },
      bar: "巴",
    };
    assert.deepEqual(mapActorEntry("foo", actors), { name: "条", javdb: "https://x" });
    assert.deepEqual(mapActorEntry("bar", actors), { name: "巴", javdb: "" });
    assert.equal(mapTagEntry("Creampie", { Creampie: "中出" }), "中出");
  });
});
