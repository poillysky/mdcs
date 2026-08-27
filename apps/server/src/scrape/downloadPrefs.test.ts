import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAmazonCoverUrl,
  isJunkCoverUrl,
  orderCoverDownloadCandidates,
  pickCoverUrlForDownload,
  preferHighResCoverUrl,
} from "./downloadPrefs.js";

describe("isAmazonCoverUrl", () => {
  it("识别常见 Amazon CDN", () => {
    assert.equal(
      isAmazonCoverUrl("https://m.media-amazon.com/images/I/xxx.jpg"),
      true,
    );
    assert.equal(
      isAmazonCoverUrl("https://images-na.ssl-images-amazon.com/images/I/xx.jpg"),
      true,
    );
    assert.equal(isAmazonCoverUrl("https://pics.dmm.co.jp/digital/video/xxx/xxxpl.jpg"), false);
  });
});

describe("preferHighResCoverUrl", () => {
  it("ps.jpg 升级为 pl.jpg", () => {
    assert.equal(
      preferHighResCoverUrl("https://pics.dmm.co.jp/digital/video/ssis001/ssis001ps.jpg"),
      "https://pics.dmm.co.jp/digital/video/ssis001/ssis001pl.jpg",
    );
  });

  it("已有 pl 或非 ps 不改", () => {
    const pl = "https://example.com/a/pl.jpg";
    assert.equal(preferHighResCoverUrl(pl), pl);
    assert.equal(preferHighResCoverUrl("https://example.com/cover.png"), "https://example.com/cover.png");
  });
});

describe("pickCoverUrlForDownload", () => {
  const base = {
    downloadPoster: true,
    downloadThumb: true,
    preferHighResPoster: false,
    skipAmazon: false,
    amazonHdPoster: false,
    tenhowHdPoster: false,
    amazonStrictMode: false,
  };

  it("双关则不下", () => {
    assert.equal(
      pickCoverUrlForDownload(["https://a.test/c.jpg"], {
        ...base,
        downloadPoster: false,
        downloadThumb: false,
      }),
      null,
    );
  });

  it("skipAmazon 过滤后无候选则 null", () => {
    assert.equal(
      pickCoverUrlForDownload(["https://m.media-amazon.com/images/I/x.jpg"], {
        ...base,
        skipAmazon: true,
      }),
      null,
    );
  });

  it("skipAmazon 后取下一候选并可选升清", () => {
    const url = pickCoverUrlForDownload(
      [
        "https://m.media-amazon.com/images/I/x.jpg",
        "https://pics.dmm.co.jp/digital/video/a/aps.jpg",
      ],
      { ...base, skipAmazon: true, preferHighResPoster: true },
    );
    assert.equal(url, "https://pics.dmm.co.jp/digital/video/a/apl.jpg");
  });

  it("跳过垃圾流媒体预览，优先正常封面", () => {
    const url = pickCoverUrlForDownload(
      [
        "https://tukaka.space/video/m3u8/2025/11/01/88439477/vod.jpg",
        "https://www.javbus.com/pics/cover/bquf_b.jpg",
      ],
      base,
    );
    assert.equal(url, "https://www.javbus.com/pics/cover/bquf_b.jpg");
  });
});

describe("isJunkCoverUrl", () => {
  it("识别 tukaka 流媒体预览", () => {
    assert.equal(
      isJunkCoverUrl("https://tukaka.space/video/m3u8/2025/11/01/88439477/vod.jpg"),
      true,
    );
    assert.equal(
      isJunkCoverUrl("https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/sone00999/sone00999pl.jpg"),
      false,
    );
  });
});

describe("orderCoverDownloadCandidates", () => {
  it("合并封面优先，垃圾 URL 置后", () => {
    const ordered = orderCoverDownloadCandidates(
      "https://www.javbus.com/pics/cover/bquf_b.jpg",
      [
        "https://tukaka.space/video/m3u8/x/vod.jpg",
        "https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/sone00999/sone00999pl.jpg",
      ],
    );
    assert.equal(ordered[0], "https://www.javbus.com/pics/cover/bquf_b.jpg");
    assert.equal(
      ordered[ordered.length - 1],
      "https://tukaka.space/video/m3u8/x/vod.jpg",
    );
  });
});
