import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDefaultScrapeConfig } from "./schema.js";
import { resolveEffectiveDownload } from "./loadScrape.js";
import type { JobOptions } from "../jobs/options.js";

describe("resolveEffectiveDownload", () => {
  it("任务级覆盖 poster/thumb 独立生效", () => {
    const cfg = createDefaultScrapeConfig();
    cfg.download.downloadPoster = true;
    cfg.download.downloadThumb = true;

    const thumbOnly: JobOptions = {
      useGlobal: { download: false },
      download: { downloadPoster: false, downloadThumb: true },
    };
    const dl = resolveEffectiveDownload("japan_censored", cfg, thumbOnly);
    assert.equal(dl.downloadPoster, false);
    assert.equal(dl.downloadThumb, true);

    const posterOnly: JobOptions = {
      useGlobal: { download: false },
      download: { downloadPoster: true, downloadThumb: false },
    };
    const dl2 = resolveEffectiveDownload("japan_censored", cfg, posterOnly);
    assert.equal(dl2.downloadPoster, true);
    assert.equal(dl2.downloadThumb, false);
  });

  it("amazonHdPoster 任务覆盖时同步 skipAmazon", () => {
    const cfg = createDefaultScrapeConfig();
    const dl = resolveEffectiveDownload("japan_censored", cfg, {
      useGlobal: { download: false },
      download: { amazonHdPoster: true },
    });
    assert.equal(dl.amazonHdPoster, true);
    assert.equal(dl.skipAmazon, false);
  });
});
