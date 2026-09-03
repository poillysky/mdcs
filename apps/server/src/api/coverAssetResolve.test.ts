import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  pickRemotePosterUrl,
  pickRemoteThumbUrl,
} from "./coverAssetResolve.js";
import type { ScrapeMeta } from "../scrape/types.js";

function baseMeta(overrides: Partial<ScrapeMeta> = {}): ScrapeMeta {
  return {
    code: "HMN-003",
    kind: "japan_censored",
    title: "t",
    actors: [],
    genres: [],
    ok: true,
    ...overrides,
  };
}

describe("coverAssetResolve", () => {
  it("pickRemotePosterUrl 优先 pl.jpg", () => {
    const meta = baseMeta({
      coverUrl: "https://example.com/ps.jpg",
      sourceSnapshots: {
        dmm: {
          fields: {},
          coverUrl: "https://example.com/pl.jpg",
        },
      },
      fieldSources: { cover: "dmm" },
    });
    assert.equal(pickRemotePosterUrl(meta), "https://example.com/pl.jpg");
  });

  it("pickRemoteThumbUrl 优先 ps.jpg", () => {
    const meta = baseMeta({
      coverUrl: "https://example.com/pl.jpg",
      sourceSnapshots: {
        dmm: {
          fields: {},
          coverUrl: "https://example.com/ps.jpg",
        },
      },
      fieldSources: { cover: "dmm" },
    });
    assert.equal(pickRemoteThumbUrl(meta), "https://example.com/ps.jpg");
  });
});
