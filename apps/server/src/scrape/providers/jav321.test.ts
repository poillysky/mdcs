import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterDmmExtrafanart,
  normalizeExtrafanartUrls,
  removeCoverFromExtrafanart,
  resolveDmmPosterUrl,
  validateDmmImageIfNeeded,
  type Jav321CheckUrlFn,
} from "./jav321DmmImages.js";
import { parseJav321Rating } from "./jav321.js";

describe("parseJav321Rating", () => {
  it("parses gif star image (MDCX /10)", () => {
    const html = '<b>平均評価</b>: <img data-original="/img/42.gif" /><br>';
    assert.deepEqual(parseJav321Rating(html), {
      ratingValue: 4.2,
      ratingMax: 5,
      score: 8.4,
    });
  });

  it("parses plain number on lite page (5-point scale)", () => {
    const html = "<b>平均評価</b>: 4<br>";
    assert.deepEqual(parseJav321Rating(html), {
      ratingValue: 4,
      ratingMax: 5,
      score: 8,
    });
  });

  it("uses metaAfterBold label value when provided", () => {
    assert.deepEqual(parseJav321Rating("", "4.5"), {
      ratingValue: 4.5,
      ratingMax: 5,
      score: 9,
    });
  });

  it("returns null when no rating", () => {
    assert.equal(parseJav321Rating("<b>品番</b>: abc-123<br>"), null);
  });
});

describe("validateDmmImageIfNeeded", () => {
  it("skips non-dmm URLs (MDCX test_validate_dmm_image_if_needed_skips_non_dmm)", async () => {
    let called = false;
    const checkUrl: Jav321CheckUrlFn = async (url) => {
      called = true;
      return url;
    };
    const result = await validateDmmImageIfNeeded("https://example.com/poster.jpg", "poster", checkUrl);
    assert.equal(result, "https://example.com/poster.jpg");
    assert.equal(called, false);
  });

  it("returns empty for invalid dmm (MDCX test_validate_dmm_image_if_needed_returns_empty_for_invalid_dmm)", async () => {
    const checkUrl: Jav321CheckUrlFn = async () => null;
    const result = await validateDmmImageIfNeeded(
      "https://pics.dmm.co.jp/digital/video/knld00010/knld00010pl.jpg",
      "thumb",
      checkUrl,
    );
    assert.equal(result, "");
  });

  it("prefers aws for dmm pics (MDCX test_validate_dmm_image_if_needed_prefers_aws_for_dmm_pics)", async () => {
    const calledUrls: string[] = [];
    const checkUrl: Jav321CheckUrlFn = async (url) => {
      calledUrls.push(url);
      return url.includes("awsimgsrc.dmm.co.jp") ? url : null;
    };
    const result = await validateDmmImageIfNeeded(
      "https://pics.dmm.co.jp/digital/video/knld00010/knld00010pl.jpg",
      "thumb",
      checkUrl,
    );
    assert.equal(result, "https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/knld00010/knld00010pl.jpg");
    assert.deepEqual(calledUrls, [
      "https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/knld00010/knld00010pl.jpg",
    ]);
  });
});

describe("filterDmmExtrafanart", () => {
  it("filters invalid dmm and keeps non-dmm (MDCX test_filter_dmm_extrafanart_filters_invalid_dmm_and_keeps_non_dmm)", async () => {
    const calledUrls: string[] = [];
    const checkUrl: Jav321CheckUrlFn = async (url) => {
      calledUrls.push(url);
      return url.includes("badextra") ? null : url;
    };
    const result = await filterDmmExtrafanart(
      [
        "https://pics.dmm.co.jp/digital/video/knld00010/sample1.jpg",
        "https://pics.dmm.co.jp/digital/video/knld00010/badextra.jpg",
        "https://cdn.example.com/sample2.jpg",
        "https://pics.dmm.co.jp/digital/video/knld00010/sample1.jpg",
      ],
      checkUrl,
      () => [0, 1, 2],
    );
    assert.deepEqual(result, [
      "https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/knld00010/sample1.jpg",
      "https://cdn.example.com/sample2.jpg",
    ]);
    assert.deepEqual(calledUrls, [
      "https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/knld00010/sample1.jpg",
      "https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/knld00010/badextra.jpg",
      "https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/knld00010/badextra.jpg",
      "https://pics.dmm.co.jp/digital/video/knld00010/badextra.jpg",
    ]);
  });

  it("prefers aws for dmm pics (MDCX test_filter_dmm_extrafanart_prefers_aws_for_dmm_pics)", async () => {
    const calledUrls: string[] = [];
    const checkUrl: Jav321CheckUrlFn = async (url) => {
      calledUrls.push(url);
      return url.includes("awsimgsrc.dmm.co.jp") ? url : null;
    };
    const result = await filterDmmExtrafanart(
      ["https://pics.dmm.co.jp/digital/video/knld00010/sample1.jpg"],
      checkUrl,
    );
    assert.deepEqual(result, [
      "https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/knld00010/sample1.jpg",
    ]);
    assert.deepEqual(calledUrls, [
      "https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/knld00010/sample1.jpg",
    ]);
  });

  it("upgrades unsampled dmm images to aws when sample passes (MDCX test_filter_dmm_extrafanart_upgrades_unsampled_dmm_images_to_aws)", async () => {
    const calledUrls: string[] = [];
    const checkUrl: Jav321CheckUrlFn = async (url) => {
      calledUrls.push(url);
      if (url.endsWith("unchecked.jpg")) {
        throw new Error("抽检通过后不应继续校验未抽中的剧照");
      }
      return url;
    };
    const result = await filterDmmExtrafanart(
      [
        "https://pics.dmm.co.jp/digital/video/knld00010/sample1.jpg",
        "https://pics.dmm.co.jp/digital/video/knld00010/sample2.jpg",
        "https://pics.dmm.co.jp/digital/video/knld00010/sample3.jpg",
        "https://pics.dmm.co.jp/digital/video/knld00010/unchecked.jpg",
      ],
      checkUrl,
      () => [0, 1, 2],
    );
    assert.deepEqual(result, [
      "https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/knld00010/sample1.jpg",
      "https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/knld00010/sample2.jpg",
      "https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/knld00010/sample3.jpg",
      "https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/knld00010/unchecked.jpg",
    ]);
    assert.deepEqual(calledUrls, [
      "https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/knld00010/sample1.jpg",
      "https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/knld00010/sample2.jpg",
      "https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/knld00010/sample3.jpg",
    ]);
  });
});

describe("resolveDmmPosterUrl", () => {
  it("uses thumb ps candidate (MDCX test_resolve_dmm_poster_url_uses_thumb_ps_candidate)", async () => {
    const calledUrls: string[] = [];
    const checkUrl: Jav321CheckUrlFn = async (url) => {
      calledUrls.push(url);
      return url.endsWith("ps.jpg") ? url : null;
    };
    const result = await resolveDmmPosterUrl(
      "https://pics.dmm.co.jp/digital/video/knld00010/knld00010pl.jpg",
      "",
      checkUrl,
    );
    assert.equal(result, "https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/knld00010/knld00010ps.jpg");
    assert.deepEqual(calledUrls, [
      "https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/knld00010/knld00010ps.jpg",
    ]);
  });
});

describe("normalizeExtrafanartUrls", () => {
  it("dedupes without validation (MDCX test_normalize_extrafanart_urls_dedupes_without_validation)", () => {
    assert.deepEqual(
      normalizeExtrafanartUrls([
        "https://cdn.example.com/sample2.jpg",
        "https://cdn.example.com/sample2.jpg",
        "https://pics.dmm.co.jp/digital/video/knld00010/sample1.jpg",
        "",
      ]),
      [
        "https://cdn.example.com/sample2.jpg",
        "https://pics.dmm.co.jp/digital/video/knld00010/sample1.jpg",
      ],
    );
  });
});

describe("removeCoverFromExtrafanart", () => {
  it("handles equivalent dmm hosts (MDCX test_remove_cover_from_extrafanart_handles_equivalent_dmm_hosts)", () => {
    assert.deepEqual(
      removeCoverFromExtrafanart("https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/knld00010/knld00010pl.jpg", [
        "https://pics.dmm.co.jp/digital/video/knld00010/knld00010pl.jpg",
        "https://pics.dmm.co.jp/digital/video/knld00010/sample1.jpg",
      ]),
      ["https://pics.dmm.co.jp/digital/video/knld00010/sample1.jpg"],
    );
  });
});
