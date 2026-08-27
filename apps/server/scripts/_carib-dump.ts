import fs from "node:fs";
import path from "node:path";
import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { fetchText } from "../src/scrape/network/fetch.js";
import { PROJECT_ROOT } from "../src/paths.js";

initScrapeNetworkStores();
const url = "https://www.caribbeancom.com/moviepages/010117-339/index.html";
const html = await fetchText(url, { timeoutMs: 45000 });
const out = path.join(PROJECT_ROOT, "data/_debug/carib-detail-010117-339.html");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html, "utf8");
console.log("len", html.length, "->", out);
