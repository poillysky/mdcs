import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  matchTenhowActorPage,
  normalizeAmazonImageUrl,
  parseAmazonProductPoster,
  parseAmazonSearchPoster,
  parseTenhowActorLinks,
  parseTenhowActorPoster,
} from "./hdPoster.js";

describe("normalizeAmazonImageUrl", () => {
  it("升清到 SL1500", () => {
    const raw =
      "https://m.media-amazon.com/images/I/91YtxesnfgL._AC_UL320_.jpg";
    assert.match(normalizeAmazonImageUrl(raw), /SL1500/);
  });
});

describe("parseTenhowActorLinks", () => {
  it("解析五十音索引中的演员链接", () => {
    const html = `
      <div id="um_article">
        <a href="aizawa_minami.html">相沢みなみ</a> (あいざわみなみ)
        <a href="other.html">Other</a>
      </div>`;
    const links = parseTenhowActorLinks(html);
    assert.equal(links.length, 2);
    assert.equal(links[0]?.href, "aizawa_minami.html");
  });
});

describe("matchTenhowActorPage", () => {
  it("按读音匹配演员页", () => {
    const href = matchTenhowActorPage(
      [{ href: "aizawa_minami.html", label: "相沢みなみ", reading: "あいざわみなみ" }],
      "相沢みなみ",
    );
    assert.equal(href, "aizawa_minami.html");
  });
});

describe("parseTenhowActorPoster", () => {
  it("从演员页 DMM 区块提取 ASIN 图", () => {
    const html = `
      <h3>SSIS-001</h3>
      <a href="images/B0FS11P2F5.jpg"><img /></a>
      cid=ssis00001`;
    const hit = parseTenhowActorPoster(html, "SSIS-001");
    assert.ok(hit);
    assert.equal(hit!.asin, "B0FS11P2F5");
    assert.match(hit!.url, /tenhow\.net\/images\/B0FS11P2F5\.jpg/);
  });
});

describe("parseAmazonSearchPoster", () => {
  it("从搜索结果页提取封面", () => {
    const html = `<img src="https://m.media-amazon.com/images/I/abc._AC_UL320_.jpg" />`;
    const url = parseAmazonSearchPoster(html);
    assert.ok(url?.includes("SL1500"));
  });
});

describe("parseAmazonProductPoster", () => {
  it("从商品页 og:image 提取", () => {
    const html = `<meta property="og:image" content="https://m.media-amazon.com/images/I/xyz.jpg" />`;
    const url = parseAmazonProductPoster(html);
    assert.ok(url?.includes("m.media-amazon.com"));
  });
});
