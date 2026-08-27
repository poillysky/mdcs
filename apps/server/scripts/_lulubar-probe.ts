import fs from "node:fs";
import path from "node:path";
import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { fetchText } from "../src/scrape/network/fetch.js";
import { prepareProviderFetch, siteFetchOpts } from "../src/scrape/providers/providerSite.js";

initScrapeNetworkStores();
const site = await prepareProviderFetch("lulubar", "https://lulubar.co");
const outDir = path.join(import.meta.dirname, "_lulubar-dump");
fs.mkdirSync(outDir, { recursive: true });

const urls = [
  "https://lulubar.co/",
  "https://lulubar.co/?s=MDX-0006",
  "https://lulubar.co/?s=SONE-001",
  "https://lulubar.co/video/bysearch?search=SONE-001&page=1",
  "https://lulubar.co/video/detail?id=364579",
];

for (const u of urls) {
  try {
    const html = await fetchText(u, siteFetchOpts(site, { timeoutMs: 90000 }));
    const name = u.replace(/https?:\/\//, "").replace(/[/?=&]/g, "_") + ".html";
    fs.writeFileSync(path.join(outDir, name), html, "utf8");
    const title = html.match(/<title[^>]*>([^<]+)/i)?.[1]?.trim() || "";
    console.log("OK", u, "bytes=", html.length, "title=", title.slice(0, 60));
  } catch (e) {
    console.log("ERR", u, e instanceof Error ? e.message : e);
  }
}
