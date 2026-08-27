import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildR18CombinedUrl,
  generateR18ContentIdVariations,
  normalizeR18Id,
  parseR18MovieJson,
  parseR18SeriesNumber,
  resolveR18DetailUrl,
} from "./r18dev.js";

describe("normalizeR18Id", () => {
  it("pads like MDCX test_normalize_id", () => {
    assert.equal(normalizeR18Id("IPX-535"), "ipx00535");
    assert.equal(normalizeR18Id("SSIS-001"), "ssis00001");
    assert.equal(normalizeR18Id("SONE-001"), "sone00001");
    assert.equal(normalizeR18Id("SSIS-1"), "ssis00001");
  });
});

describe("generateR18ContentIdVariations", () => {
  it("includes 118 prefix for abf", () => {
    const vars = generateR18ContentIdVariations("ABF-030");
    assert.ok(vars.includes("118abf00030"));
    assert.ok(vars.includes("118abf030"));
  });
});

describe("parseR18SeriesNumber", () => {
  it("splits series and number", () => {
    assert.deepEqual(parseR18SeriesNumber("IPX-535"), ["ipx", "535"]);
    assert.deepEqual(parseR18SeriesNumber("SSIS-001"), ["ssis", "001"]);
  });
});

describe("resolveR18DetailUrl", () => {
  it("uses combined url when dvd_id matches", () => {
    const url = resolveR18DetailUrl(
      { dvd_id: "ipx00535", content_id: "118ipx00535", title_ja: "x" },
      "IPX-535",
    );
    assert.equal(url, buildR18CombinedUrl("118ipx00535"));
  });
});

describe("parseR18MovieJson", () => {
  it("maps full payload like MDCX test_parse_json_full_data", () => {
    const parsed = parseR18MovieJson({
      dvd_id: "ipx00535",
      content_id: "118ipx00535",
      title_ja: "タイトル",
      title_en: "Title English",
      release_date: "2024-01-15",
      runtime_mins: 120,
      directors: [{ name_kanji: "監督A", name_romaji: "Director A" }],
      maker_name_ja: "メーカー",
      label_name_ja: "レーベル",
      series_name_ja: "シリーズ",
      actresses: [
        { name_kanji: "女優A", name_romaji: "Actress A" },
        { name_kanji: "", name_romaji: "Actress B" },
      ],
      categories: [
        { name_ja: "カテゴリA", name_en: "Category A" },
        { name_ja: "", name_en: "Category B" },
      ],
      jacket_full_url: "https://pics.dmm.co.jp/mono/abc/abcpl.jpg",
      gallery: [{ image_full: "https://pics.dmm.co.jp/mono/abc/abcjp-1.jpg" }],
      sample_url: "https://cc3001.dmm.co.jp/pv/abc.mp4",
    });

    assert.ok(parsed);
    assert.equal(parsed!.fields.title, "タイトル");
    assert.deepEqual(parsed!.fields.actors, ["女優A", "Actress B"]);
    assert.equal(parsed!.fields.studio, "メーカー");
    assert.equal(parsed!.fields.series, "シリーズ");
    assert.equal(parsed!.fields.runtime, 120);
    assert.equal(parsed!.fields.trailerUrl, "https://cc3001.dmm.co.jp/pv/abc.mp4");
    assert.equal(parsed!.extrafanartUrls?.length, 1);
  });

  it("formats ssis001 number like MDCX minimal", () => {
    const parsed = parseR18MovieJson({
      dvd_id: "ssis001",
      content_id: "118ssis001",
      title_ja: "テスト",
      release_date: "2023-06-01",
      runtime_mins: 90,
    });
    assert.ok(parsed);
    assert.match(parsed!.fields.title || "", /テスト/);
    assert.equal(parsed!.fields.premiered, "2023-06-01");
    assert.equal(parsed!.fields.runtime, 90);
  });
});
