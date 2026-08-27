import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { PROJECT_ROOT } from "../src/paths.js";
import { stripTags } from "../src/scrape/providers/htmlUtils.js";

const html = fs.readFileSync(path.join(PROJECT_ROOT, "data/_debug/fd2-art-3275049.html"), "utf8");
const $ = cheerio.load(html);
console.log("--- work-brief ---");
console.log($(".work-brief").first().text().slice(0, 200));
console.log("--- meta ---");
$(".work-meta-label").each((_, el) => {
  console.log("L:", stripTags($(el).text()), "=>", stripTags($(el).nextAll(".work-meta-value").first().text()).slice(0, 80));
});
console.log("--- work-tags ---");
$(".work-tags a").each((_, el) => console.log("tag:", stripTags($(el).text())));
console.log("--- artists ---");
$('.artist-info-card a.artistUrl, a[href*="/actresses/"]').each((_, el) => {
  console.log("actor:", stripTags($(el).text()), $(el).attr("href"));
});
console.log("--- photos ---");
const block =
  html.match(/class=["'][^"']*work-original-photos[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || "";
console.log([...block.matchAll(/(https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|avif))/gi)].map((x) => x[1]).slice(0, 5));
