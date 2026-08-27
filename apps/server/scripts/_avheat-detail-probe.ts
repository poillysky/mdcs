import fs from "node:fs";
import path from "node:path";
import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { fetchText } from "../src/scrape/network/fetch.js";
import { prepareProviderFetch, siteFetchOpts } from "../src/scrape/providers/providerSite.js";

initScrapeNetworkStores();
const site = await prepareProviderFetch("avheat", "https://avheat.shop");
const base = site.baseUrl;
const q = "Office Play";
const searchUrl = `${base}/cn/search/${encodeURIComponent(q)}`;
const searchHtml = await fetchText(
  searchUrl,
  siteFetchOpts(site, { referer: `${base}/cn`, timeoutMs: 120000, waitInSeconds: 5 }),
);
const m = searchHtml.match(/href=["']([^"']*\/cn\/movies\/[^"'#]+)["']/i);
if (!m) {
  console.log("no movie link");
  process.exit(1);
}
const detailUrl = new URL(m[1], base).href;
console.log("detail", detailUrl);
const detailHtml = await fetchText(
  detailUrl,
  siteFetchOpts(site, { referer: searchUrl, timeoutMs: 120000, waitInSeconds: 5 }),
);
const outDir = path.join(import.meta.dirname, "_avheat-dump");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "detail_office_play.html"), detailHtml);
console.log("len", detailHtml.length);
