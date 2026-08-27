import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  isNjavDetailHtml,
  njavSearchUrl,
  parseNjavDetailHtml,
  pickNjavDetailHref,
} from "./njav.js";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "../../../../../data/_debug");
const DETAIL = readFileSync(join(FIX, "njav-detail-sone001.html"), "utf8");
const PAGE_URL = "https://123av.com/ja/v/sone-001";

/** 搜索页挑链逻辑单测：内联 HTML，避免活站 fixture 过期 */
const SEARCH_PICK_FIXTURE = `<!DOCTYPE html><html><body>
<a class="box-item" href="/ja/v/sone-001-uncensored-leak">leak</a>
<a class="box-item" href="/ja/v/sone-001">main</a>
</body></html>`;

describe("njavSearchUrl", () => {
  it("builds JavSP-style keyword search", () => {
    assert.match(njavSearchUrl("https://123av.com/ja", "SONE-001"), /search\?keyword=SONE-001/);
  });
});

describe("pickNjavDetailHref", () => {
  it("prefers censored main over uncensored leak", () => {
    const href = pickNjavDetailHref(SEARCH_PICK_FIXTURE, "SONE-001");
    assert.match(href, /\/v\/sone-001$/i);
    assert.doesNotMatch(href, /uncensored-leak/i);
  });
});

describe("isNjavDetailHtml", () => {
  it("accepts SONE-001 detail fixture", () => {
    assert.equal(isNjavDetailHtml(DETAIL, "SONE-001"), true);
  });

  it("rejects migration shell", () => {
    assert.equal(
      isNjavDetailHtml("<html><section class='moved'>123av.com に移転</section></html>", "SONE-001"),
      false,
    );
  });
});

describe("parseNjavDetailHtml", () => {
  it("parses title, actors, genres, cover from SONE-001", () => {
    const r = parseNjavDetailHtml(DETAIL, PAGE_URL, "SONE-001");
    assert.ok(r);
    assert.match(r!.fields.title || "", /三田真鈴/);
    assert.ok((r!.fields.actors || []).includes("三田真鈴"));
    assert.ok((r!.fields.genres || []).includes("巨乳"));
    assert.equal(r!.fields.premiered, "2023-12-08");
    assert.ok((r!.fields.runtime || 0) >= 150);
    assert.match(r!.coverUrl || "", /icdn\.123av\.me.*cover\.jpg/i);
    assert.equal(r!.fields.mosaic, "有码");
  });
});
