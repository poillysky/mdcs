import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { applyTemplate, buildTemplateContext } from "./template.js";
import { buildMovieNfo, mergeMetaForNfo, writeMovieNfo } from "./nfo.js";
import { defaultNfoConfig } from "./nfoConfig.js";
import { defaultNamingConfig } from "./namingConfig.js";
import type { ScrapeMeta } from "../scrape/types.js";

describe("applyTemplate", () => {
  it("替换字段并省略空路径段", () => {
    const ctx = {
      category: "日本有码",
      studio: "",
      series_name: "系列A",
      number: "SSIS-001",
    };
    assert.equal(
      applyTemplate("{category}/{studio}/{series_name}/{number}", ctx),
      "日本有码/系列A/SSIS-001",
    );
  });

  it("清理非法路径字符", () => {
    assert.equal(applyTemplate("{title}", { title: 'a<>:"/b' }), "a_____b");
  });

  it("支持 Jinja2 条件与 filter", () => {
    const out = applyTemplate(
      "{{ number }}{% if studio %} ({{ studio | upper }}){% endif %}",
      { number: "ABC-1", studio: "s1" },
      { forPath: false },
    );
    assert.equal(out, "ABC-1 (S1)");
  });

  it("混写兼容：基础 {field} 与 Jinja 同模板", () => {
    const out = applyTemplate(
      "{category}/{{ number | upper }}{% if studio %}/{{ studio }}{% endif %}",
      { category: "日本有码", number: "abc-1", studio: "S1" },
    );
    assert.equal(out, "日本有码/ABC-1/S1");
  });

  it("混写时基础缺字段仍为未知，Jinja 缺字段为空", () => {
    const out = applyTemplate(
      "{title}-{{ studio | default('') }}",
      { title: "", studio: "" },
      { forPath: false },
    );
    assert.equal(out, "未知-");
  });
});

describe("buildTemplateContext", () => {
  it("从 meta 映射演员与年份", () => {
    const ctx = buildTemplateContext({
      kind: "japan_censored",
      code: "ABC-123",
      fileName: "ABC-123.mp4",
      sourcePath: "inbox/a.mp4",
      mosaic: "有码",
      meta: {
        code: "ABC-123",
        kind: "japan_censored",
        title: "测试",
        actors: ["A", "B"],
        genres: [],
        premiered: "2024-01-02",
        studio: "StudioX",
        source: "javbus",
        sourcesTried: [],
        fieldSources: {},
        scrapedAt: "",
        ok: true,
      },
    });
    assert.equal(ctx.first_actor, "A");
    assert.equal(ctx.year, "2024");
    assert.equal(ctx.category, "日本有码");
    assert.equal(ctx.mosaic, "有码");
  });
});

describe("buildMovieNfo", () => {
  it("生成含 uniqueid 与演员的 XML", () => {
    const meta: ScrapeMeta = {
      code: "SSIS-001",
      kind: "japan_censored",
      title: "Hello",
      titleZh: "你好",
      actors: ["女優"],
      genres: ["劇情"],
      plot: "简介 & 测试",
      premiered: "2023-05-01",
      studio: "S1",
      source: "javbus",
      sourcesTried: ["javbus"],
      fieldSources: { title: "javbus" },
      scrapedAt: new Date().toISOString(),
      ok: true,
    };
    const xml = buildMovieNfo(meta);
    assert.match(xml, /<movie>/);
    assert.match(xml, /uniqueid type="num"/);
    assert.match(xml, /SSIS-001/);
    assert.match(xml, /<name>女優<\/name>/);
    assert.match(xml, /CDATA/);
    assert.match(xml, /<title>你好<\/title>/);
  });

  it("mediaTitle 写入 <title>，originaltitle 仍用原标题", () => {
    const meta: ScrapeMeta = {
      code: "SSIS-001",
      kind: "japan_censored",
      title: "Hello",
      titleZh: "你好",
      actors: [],
      genres: [],
      source: "javbus",
      sourcesTried: [],
      fieldSources: {},
      scrapedAt: "",
      ok: true,
    };
    const xml = buildMovieNfo(meta, { mediaTitle: "SSIS-001 你好" });
    assert.match(xml, /<title>SSIS-001 你好<\/title>/);
    assert.match(xml, /<originaltitle>SSIS-001 Hello<\/originaltitle>/);
  });

  it("include 关闭 originaltitle 时不写", () => {
    const meta: ScrapeMeta = {
      code: "ABC-1",
      kind: "japan_censored",
      title: "T",
      actors: [],
      genres: [],
      source: "javbus",
      sourcesTried: [],
      fieldSources: {},
      scrapedAt: "",
      ok: true,
    };
    const nfo = defaultNfoConfig();
    nfo.include.originaltitle = false;
    nfo.tagExtras = {
      letters: false,
      actor: false,
      definition: false,
      cnword: false,
      mosaic: false,
      series: false,
      studio: false,
      publisher: false,
    };
    const xml = buildMovieNfo(meta, { nfo });
    assert.doesNotMatch(xml, /<originaltitle>/);
  });

  it("enabled=false 时 writeMovieNfo 不落盘", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scrap-nfo-"));
    const nfoAbs = path.join(dir, "x.nfo");
    const meta: ScrapeMeta = {
      code: "ABC-1",
      kind: "japan_censored",
      title: "T",
      actors: [],
      genres: [],
      source: "javbus",
      sourcesTried: [],
      fieldSources: {},
      scrapedAt: "",
      ok: true,
    };
    const nfo = defaultNfoConfig();
    nfo.enabled = false;
    writeMovieNfo(nfoAbs, meta, { nfo });
    assert.equal(fs.existsSync(nfoAbs), false);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("写入 thumb/fanart 与 javdb ratings", () => {
    const meta: ScrapeMeta = {
      code: "SONE-001",
      kind: "japan_censored",
      title: "Original",
      titleZh: "中文",
      actors: ["演员"],
      genres: ["标签"],
      directors: ["导演"],
      website: "https://example.test/detail",
      ratingValue: 4.42,
      ratingMax: 5,
      ratingSource: "javdb",
      score: 8.8,
      source: "javdb",
      sourcesTried: ["javdb"],
      fieldSources: {},
      scrapedAt: "",
      ok: true,
    };
    const xml = buildMovieNfo(meta, {
      ctx: {
        posterPath: "poster.jpg",
        thumbPath: "thumb.jpg",
        ratingSource: "javdb",
        ratingValue: 4.42,
        ratingMax: 5,
        score: 8.8,
        website: meta.website,
        directors: meta.directors,
      },
    });
    assert.match(xml, /<thumb>thumb\.jpg<\/thumb>/);
    assert.match(xml, /<fanart\/>/);
    assert.match(xml, /<ratings>/);
    assert.match(xml, /name="javdb"/);
    assert.match(xml, /<value>4\.42<\/value>/);
    assert.match(xml, /<director>导演<\/director>/);
    assert.match(xml, /<website>https:\/\/example\.test\/detail<\/website>/);
  });
});

describe("buildTemplateContext 字幕与分辨率", () => {
  it("hasSubtitle 时填充 subtitle 字段与可配置后缀", () => {
    const ctx = buildTemplateContext({
      kind: "japan_censored",
      code: "ABC-1",
      fileName: "ABC-1.mp4",
      sourcePath: "inbox/ABC-1.mp4",
      hasSubtitle: true,
      naming: {
        ...defaultNamingConfig(),
        subtitleLabel: "中字",
        subtitleSuffixLabel: "-C",
      },
    });
    assert.equal(ctx.subtitle, "中字");
    assert.equal(ctx.subtitle_suffix, "-C");
  });

  it("分辨率走 textMap 与路径探测", () => {
    const ctx = buildTemplateContext({
      kind: "japan_censored",
      code: "ABC-1",
      fileName: "ABC-1-1080p.mp4",
      sourcePath: "inbox/ABC-1-1080p.mp4",
      resolution: "1080P",
      naming: {
        ...defaultNamingConfig(),
        resolutionTextMap: "标清, 高清, 超清, 八K",
        resolutionSuffixTemplate: "-{resolution}",
        resolutionSuffixEnabled: { "720P": true, "1080P": true, "4K": true, "8K": true },
      },
    });
    assert.equal(ctx.resolution_text, "高清");
    assert.equal(ctx.resolution_suffix, "-高清");
  });
});

describe("mergeMetaForNfo", () => {
  it("prefer_nfo 保留本地标题", () => {
    const scraped: ScrapeMeta = {
      code: "X",
      kind: "japan_censored",
      title: "scraped",
      actors: [],
      genres: [],
      source: "javbus",
      sourcesTried: [],
      fieldSources: {},
      scrapedAt: "",
      ok: true,
    };
    const existing = `<?xml version="1.0"?><movie><title>本地标题</title><originaltitle>local-orig</originaltitle></movie>`;
    const merged = mergeMetaForNfo(scraped, existing, "prefer_nfo");
    assert.equal(merged.title, "local-orig");
    assert.equal(merged.titleZh, "本地标题");
  });
});
