import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildFanzaTrailerUrl,
  buildFreepvTrailerFromCid,
  pickBestTrailer,
  trailerQualityRank,
} from "./dmmTrailer.js";

describe("dmmTrailer", () => {
  it("buildFanzaTrailerUrl 从 playlist 转 mp4", () => {
    const url =
      "https://cc3001.dmm.co.jp/hlsvideo/freepv/s/s/sone00001/playlist.m3u8";
    assert.match(buildFanzaTrailerUrl(url), /sone00001_sm_w\.mp4$/);
  });

  it("buildFanzaTrailerUrl 保留直链 mp4", () => {
    const url = "https://cc3001.dmm.co.jp/pv/temporary/asfb00192_mhb_w.mp4";
    assert.equal(buildFanzaTrailerUrl(url), url);
  });

  it("buildFreepvTrailerFromCid", () => {
    assert.equal(
      buildFreepvTrailerFromCid("sone00001", "_hhb_w"),
      "https://cc3001.dmm.co.jp/litevideo/freepv/s/son/sone00001/sone00001_hhb_w.mp4",
    );
  });

  it("pickBestTrailer 优先 hhb", () => {
    const best = pickBestTrailer([
      buildFreepvTrailerFromCid("sone00001", "_sm_w"),
      buildFreepvTrailerFromCid("sone00001", "_hhb_w"),
    ]);
    assert.match(best || "", /hhb/);
    assert.ok(trailerQualityRank(best || "") > trailerQualityRank("_sm_w.mp4"));
  });
});
