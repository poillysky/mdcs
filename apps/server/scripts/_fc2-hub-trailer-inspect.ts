import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "../src/paths.js";
import { parseFc2HubTrailerVideoId } from "../src/scrape/providers/fc2_hub.js";

const html = fs.readFileSync(path.join(PROJECT_ROOT, "data/_debug/fc2-hub-detail-3275049.html"), "utf8");
for (const n of ["player-api", "embed/", "iframe", "sample", "adult.contents.fc2"]) {
  console.log(n, (html.match(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")) || []).length);
}
console.log("trailerVideoId", parseFc2HubTrailerVideoId(html, "3275049"));
const embed = [...html.matchAll(/iframe[^>]*(?:data-src|src)=["']([^"']+)["']/gi)].map((m) => m[1]).slice(0, 8);
console.log("iframes", embed);
