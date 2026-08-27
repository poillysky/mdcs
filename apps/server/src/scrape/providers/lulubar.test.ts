import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  lulubarProvider,
  lulubarSearchUrl,
  parseLulubarDetailHtml,
  pickLulubarDetailHref,
} from "./lulubar.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dumpDir = path.join(here, "../../../scripts/_lulubar-dump");

function readDump(name: string): string {
  return fs.readFileSync(path.join(dumpDir, name), "utf8");
}

describe("lulubar provider", () => {
  it("search url", () => {
    assert.equal(
      lulubarSearchUrl("https://lulubar.co", "SONE-001"),
      "https://lulubar.co/video/bysearch?search=SONE-001&page=1",
    );
  });

  it("pick detail href from search", () => {
    const html = readDump("lulubar.co_video_bysearch_search_SONE-001_page_1.html");
    assert.equal(pickLulubarDetailHref(html, "SONE-001"), "/video/detail?id=364579");
    assert.equal(pickLulubarDetailHref(html, "MDX-0006"), "");
  });

  it("parse SONE-001 detail", () => {
    const html = readDump("lulubar.co_video_detail_id_364579.html");
    const parsed = parseLulubarDetailHtml(html, "https://lulubar.co/video/detail?id=364579", "SONE-001");
    assert.ok(parsed);
    assert.match(parsed!.fields.title || "", /三田真铃/);
    assert.doesNotMatch(parsed!.fields.title || "", /^SONE\b/);
    assert.equal(parsed!.fields.premiered, "2023-12-11");
    assert.deepEqual(parsed!.fields.actors, ["三田真鈴"]);
    assert.equal(parsed!.fields.studio, "エスワン ナンバーワンスタイル");
    assert.ok(parsed!.fields.plot && parsed!.fields.plot.length > 20);
    assert.ok(parsed!.coverUrl?.includes("image.lulubar.co"));
  });

  it("provider id", () => {
    assert.equal(lulubarProvider.id, "lulubar");
  });
});
