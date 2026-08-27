/** Parse existing fc2_hub HTML dump */
import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "../src/paths.js";
import {
  parseFc2HubCover,
  parseFc2HubDetailHtml,
  parseFc2HubExtrafanart,
  parseFc2HubTags,
} from "../src/scrape/providers/fc2_hub.js";

const file = process.argv[2] || path.join(PROJECT_ROOT, "data/_debug/fc2-hub-search-2.html");
const html = fs.readFileSync(file, "utf8");
console.log("file", file, "len", html.length);
console.log("fancybox", (html.match(/data-fancybox/gi) || []).length);
console.log("card-text", (html.match(/card-text/gi) || []).length);
console.log("/tag/", (html.match(/\/tag\//gi) || []).length);
console.log("padding0", (html.match(/padding:\s*0/gi) || []).length);
console.log("storage", (html.match(/storage\d*\.contents\.fc2/gi) || []).length);
console.log("challenge", /Just a moment|cf-browser-verification/i.test(html));
const hrefs = [
  ...html.matchAll(/data-fancybox=["']gallery["'][^>]*href=["']([^"']+)["']/gi),
  ...html.matchAll(/href=["']([^"']+)["'][^>]*data-fancybox=["']gallery["']/gi),
].map((m) => m[1]);
console.log("fancy hrefs", [...new Set(hrefs)].slice(0, 10));
console.log("parseCover", parseFc2HubCover(html, "https://javten.com/"));
console.log("tags", parseFc2HubTags(html));
console.log("extra", parseFc2HubExtrafanart(html, "https://javten.com/").slice(0, 8));
const hit = parseFc2HubDetailHtml(html, "https://javten.com/video/1/id3275049", "FC2-PPV-3275049");
console.log(
  "hit",
  hit && {
    title: hit.fields.title,
    genres: hit.fields.genres,
    cover: hit.coverUrl,
    studio: hit.fields.studio,
    mosaic: hit.fields.mosaic,
    series: hit.fields.series,
    extra: hit.extrafanartUrls?.length,
  },
);
