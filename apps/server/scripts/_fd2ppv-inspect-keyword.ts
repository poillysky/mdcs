import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "../src/paths.js";
import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { fetchText } from "../src/scrape/network/fetch.js";

initScrapeNetworkStores();
const id = process.argv[2] || "4962908";
const url = `https://fd2ppv.cc/articles/?keyword=${id}`;
const html = await fetchText(url, {
  access: "proxy_adaptive",
  referer: "https://fd2ppv.cc/",
  timeoutMs: 20000,
  sourceId: "fd2ppv",
});
fs.writeFileSync(path.join(PROJECT_ROOT, `data/_debug/fd2ppv-keyword-${id}.html`), html, "utf8");
console.log("len", html.length, "title", html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim());

const hrefs = [...new Set([...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]!))];
console.log(
  "hrefs with id or articles",
  hrefs.filter((h) => h.includes(id) || /\/articles\/\d+/i.test(h)).slice(0, 30),
);

const idx = html.indexOf(id);
console.log("\n--- context around id ---");
console.log(html.slice(Math.max(0, idx - 500), idx + 800));

// class names near cards
for (const c of ["work-card", "article-card", "card", "work-brief", "work-title", "thumbnail", "xximgs"]) {
  console.log(c, (html.match(new RegExp(c, "gi")) || []).length);
}
