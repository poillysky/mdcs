import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "../src/paths.js";

const html = fs.readFileSync(path.join(PROJECT_ROOT, "data/_debug/fc2-hub-detail-3275049.html"), "utf8");

const needles = ["card-text", "/tag/", "badge", "genre", "キーワード", "タグ", "Tags", "col des", "col-8", "player-api"];
for (const n of needles) {
  console.log(n, (html.match(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")) || []).length);
}

function snippet(label: string, re: RegExp) {
  const m = html.match(re);
  if (!m || m.index == null) {
    console.log(`\n=== ${label}: NOT FOUND ===`);
    return;
  }
  console.log(`\n=== ${label} @${m.index} ===`);
  console.log(html.slice(Math.max(0, m.index - 120), m.index + 600));
}

snippet("col-8", /class=["']col-8["']/i);
snippet("col des", /class=["'][^"']*col[^"']*des[^"']*["']/i);
snippet("fancybox", /data-fancybox=["']gallery["']/i);
snippet("h1 second area", /<h1[\s\S]*?<h1/i);
snippet("badge", /class=["'][^"']*badge[^"']*["']/i);
snippet("keyword link", /href=["'][^"']*(?:keyword|tag|genre)[^"']*["']/i);

// nearby after studio
const col8 = html.indexOf('class="col-8"');
if (col8 >= 0) {
  console.log("\n=== 2k after col-8 ===");
  console.log(html.slice(col8, col8 + 2000));
}
