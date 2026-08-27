import fs from "node:fs";
import path from "node:path";
import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { fetchText } from "../src/scrape/network/fetch.js";
import { prepareProviderFetch, siteFetchOpts } from "../src/scrape/providers/providerSite.js";
import { PROJECT_ROOT } from "../src/paths.js";

initScrapeNetworkStores();
const site = await prepareProviderFetch("fc2");
const url = `${site.baseUrl}/article/1545500/`;
const html = await fetchText(
  url,
  siteFetchOpts(site, { referer: `${site.baseUrl}/`, timeoutMs: 45000 }),
);
const out = path.join(PROJECT_ROOT, "data/_debug/fc2-detail-1545500.html");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html, "utf8");
console.log("len", html.length, "->", out);
