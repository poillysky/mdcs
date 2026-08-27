import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "../../paths.js";
import { fd2ppvProvider } from "./fd2ppv.js";

// 用离线 dump 测解析：通过临时 mock 太重；此处直接再导内部逻辑不便。
// 以 cheerio 选择器契约 + 文件存在做轻量回归（与 scrape 同选择器）。
import * as cheerio from "cheerio";
import { stripTags } from "./htmlUtils.js";

function parseActorsGenres(html: string) {
  const $ = cheerio.load(html);
  const genres: string[] = [];
  $(".work-tags a").each((_, el) => {
    const n = stripTags($(el).text());
    if (n && n.length <= 40 && !genres.includes(n)) genres.push(n);
  });
  $('a[href*="/tags/actresses/"]').each((_, el) => {
    const n = stripTags($(el).text());
    if (n && n.length <= 40 && !/AV女優|女優/i.test(n) && !genres.includes(n)) genres.push(n);
  });
  const actors: string[] = [];
  $('a[href*="/actresses/"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    if (/\/tags\/actresses\//i.test(href) || !/\/actresses\/\d+/i.test(href)) return;
    const n = stripTags($(el).text());
    if (n && n.length <= 40 && !actors.includes(n)) actors.push(n);
  });
  return { actors, genres };
}

describe("fd2ppv parse (dump)", () => {
  it("separates actress vs actress-tags on 3275049 dump", () => {
    const dump = path.join(PROJECT_ROOT, "data/_debug/fd2-art-3275049.html");
    if (!fs.existsSync(dump)) return;
    const { actors, genres } = parseActorsGenres(fs.readFileSync(dump, "utf8"));
    assert.deepEqual(actors, ["えりか"]);
    assert.ok(genres.includes("素人"));
    assert.ok(!actors.includes("素人"));
  });

  it("provider id", () => {
    assert.equal(fd2ppvProvider.id, "fd2ppv");
  });
});
