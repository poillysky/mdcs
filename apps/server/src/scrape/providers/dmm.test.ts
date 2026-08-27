import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseGraphqlHit } from "./dmm.js";

/** 移植 MDCX tests/crawlers/test_dmm_trailer_url.py test_fetch_digital_uses_graphql_response */
const MDCX_IPZZ_GQL = {
  ppvContent: {
    id: "ipzz00841",
    title: "FIRST IMPRESSION 191 辻みいな",
    description: "福岡県出身 22歳<br>趣味:推し活",
    packageImage: {
      largeUrl: "https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/ipzz00841/ipzz00841pl.jpg",
      mediumUrl: "https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/ipzz00841/ipzz00841ps.jpg",
    },
    sample2DMovie: {
      highestMovieUrl: "https://cc3001.dmm.co.jp/pv/TOKEN/ipzz00841hhb.mp4",
      hlsMovieUrl: "https://cc3001.dmm.co.jp/pv/TOKEN/playlist.m3u8",
    },
    sampleVRMovie: { highestMovieUrl: "" },
    deliveryStartDate: "2026-03-05T15:00:00Z",
    makerReleasedAt: "2026-03-09T15:00:00Z",
    duration: 11288,
    actresses: [{ name: "辻みいな" }],
    directors: [{ name: "豆沢豆太郎" }],
    series: { name: "First Impression" },
    maker: { name: "アイデアポケット" },
    label: { name: "ティッシュ" },
    genres: [{ name: "独占配信" }, { name: "4K" }],
  },
  reviewSummary: { average: 3.8824 },
};

/** 移植 MDCX test_fetch_digital_tolerates_nullable_graphql_fields */
const MDCX_MIDA_GQL = {
  ppvContent: {
    id: "mida00557",
    title: "内気な性格で嫌と言えずエロ整体師の媚薬マッサージにイカされ続けた部活少女 七沢みあ",
    description: null,
    packageImage: null,
    sample2DMovie: null,
    sampleVRMovie: null,
    deliveryStartDate: null,
    makerReleasedAt: "2026-03-16T15:00:00Z",
    duration: null,
    actresses: [null, { name: null }, { name: "七沢みあ" }],
    directors: null,
    series: null,
    maker: null,
    label: { name: null },
    genres: [null, { name: null }, { name: "4K" }],
  },
  reviewSummary: null,
};

/** 移植 MDCX tests/crawlers/test_dmm_api.py test_to_crawler_data_maps_api_response */
const MDCX_SSIS_GQL = {
  ppvContent: {
    id: "ssis00001",
    title: "Title",
    description: "Line 1<br>Line 2",
    packageImage: {
      largeUrl: "https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/ssis00001/ssis00001pl.jpg",
      mediumUrl: "https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/ssis00001/ssis00001ps.jpg",
    },
    sample2DMovie: {
      highestMovieUrl: "https://cc3001.dmm.co.jp/pv/TOKEN/ssis00001_mhb_w.mp4",
    },
    deliveryStartDate: "2021-02-18",
    duration: 147 * 60,
    actresses: [{ name: "葵つかさ" }, { name: "葵つかさ" }, { name: "乙白さやか" }],
    directors: [{ name: "苺原" }],
    series: null,
    maker: { name: "エスワン ナンバーワンスタイル" },
    label: { name: "S1 NO.1 STYLE" },
    genres: [{ name: "ドラマ" }, { name: "ギリモザ" }],
  },
  reviewSummary: null,
};

describe("parseGraphqlHit", () => {
  it("maps full GraphQL payload like MDCX test_fetch_digital_uses_graphql_response", () => {
    const r = parseGraphqlHit(MDCX_IPZZ_GQL, "IPZZ-841");
    assert.equal(r.title, "FIRST IMPRESSION 191 辻みいな");
    assert.equal(r.plot, "福岡県出身 22歳 趣味:推し活");
    assert.equal(r.premiered, "2026-03-05");
    assert.equal(r.runtime, 188);
    assert.deepEqual(r.actors, ["辻みいな"]);
    assert.deepEqual(r.directors, ["豆沢豆太郎"]);
    assert.equal(r.series, "First Impression");
    assert.equal(r.studio, "アイデアポケット");
    assert.equal(r.publisher, "ティッシュ");
    assert.deepEqual(r.genres, ["独占配信", "4K"]);
    assert.equal(r.ratingValue, 3.8824);
    assert.equal(r.ratingMax, 5);
    assert.equal(r.ratingSource, "dmm");
    assert.equal(r.coverUrl, "https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/ipzz00841/ipzz00841pl.jpg");
    assert.equal(r.publishNumber, "ipzz00841");
    assert.equal(r.trailerUrl, "https://cc3001.dmm.co.jp/pv/TOKEN/ipzz00841hhb.mp4");
    assert.match(r.website || "", /cid=ipzz00841/);
  });

  it("tolerates nullable GraphQL fields like MDCX test_fetch_digital_tolerates_nullable_graphql_fields", () => {
    const r = parseGraphqlHit(
      MDCX_MIDA_GQL as unknown as Parameters<typeof parseGraphqlHit>[0],
      "MIDA-557",
    );
    assert.equal(
      r.title,
      "内気な性格で嫌と言えずエロ整体師の媚薬マッサージにイカされ続けた部活少女 七沢みあ",
    );
    assert.equal(r.plot, undefined);
    assert.equal(r.premiered, "2026-03-16");
    assert.equal(r.runtime, null);
    assert.deepEqual(r.actors, ["七沢みあ"]);
    assert.equal(r.directors, undefined);
    assert.equal(r.series, undefined);
    assert.equal(r.studio, undefined);
    assert.equal(r.publisher, undefined);
    assert.deepEqual(r.genres, ["4K"]);
    assert.equal(r.ratingValue, undefined);
    assert.equal(r.coverUrl, null);
    assert.equal(r.trailerUrl, undefined);
  });

  it("maps SSIS-001 API fields like MDCX test_to_crawler_data_maps_api_response", () => {
    const r = parseGraphqlHit(MDCX_SSIS_GQL, "SSIS-001");
    assert.equal(r.title, "Title");
    assert.equal(r.plot, "Line 1 Line 2");
    assert.equal(r.premiered, "2021-02-18");
    assert.equal(r.runtime, 147);
    assert.deepEqual(r.actors, ["葵つかさ", "乙白さやか"]);
    assert.deepEqual(r.directors, ["苺原"]);
    assert.deepEqual(r.genres, ["ドラマ", "ギリモザ"]);
    assert.equal(r.studio, "エスワン ナンバーワンスタイル");
    assert.equal(r.publisher, "S1 NO.1 STYLE");
    assert.equal(r.series, undefined);
    assert.equal(
      r.coverUrl,
      "https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/ssis00001/ssis00001pl.jpg",
    );
    assert.equal(r.trailerUrl, "https://cc3001.dmm.co.jp/pv/TOKEN/ssis00001_mhb_w.mp4");
  });

  it("maps sampleImages → extrafanartUrls and reviewSummary.total → votes", () => {
    const r = parseGraphqlHit(
      {
        ppvContent: {
          id: "sone00001",
          title: "SONE title",
          description: "plot long enough here",
          packageImage: {
            largeUrl: "https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/sone00001/sone00001pl.jpg",
          },
          sampleImages: [
            { number: 2, imageUrl: "https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/sone00001/sone00001-2.jpg" },
            { number: 1, imageUrl: "https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/sone00001/sone00001-1.jpg" },
          ],
          deliveryStartDate: "2023-12-08T01:00:00Z",
          duration: 9209,
          actresses: [{ name: "三田真鈴" }],
          genres: [{ name: "4K" }],
        },
        reviewSummary: { average: 4.42, total: 36 },
      },
      "SONE-001",
    );
    assert.equal(r.votes, "36");
    assert.deepEqual(r.extrafanartUrls, [
      "https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/sone00001/sone00001-1.jpg",
      "https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/sone00001/sone00001-2.jpg",
    ]);
  });
});
