import { readFileSync } from "node:fs";
import * as cheerio from "cheerio";
import path from "node:path";
import { PROJECT_ROOT } from "../src/paths.js";

const html = readFileSync(path.join(PROJECT_ROOT, "data/_debug/njav-detail-sone001.html"), "utf8");
const $ = cheerio.load(html);
$("div.watch__info-row").each((_, el) => {
  const key = $(el).find("dt").first().text().trim();
  const chips = $(el)
    .find("dd a.chip")
    .map((__, a) => $(a).text().trim())
    .get();
  const plain = $(el).find("dd").first().clone().children().remove().end().text().trim();
  console.log(key, "|", chips.length ? chips : plain);
});
const cover = html.match(/icdn\.123av\.me[^"'\\]+cover\.jpg[^"'\\]*/i)?.[0];
console.log("cover", cover?.replace(/\\u002F/g, "/"));
