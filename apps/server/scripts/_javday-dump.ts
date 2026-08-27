import fs from "node:fs";
import path from "node:path";
import { fetchText } from "../src/scrape/network/fetch.js";
import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { prepareProviderFetch, siteFetchOpts } from "../src/scrape/providers/providerSite.js";

initScrapeNetworkStores();
const site = await prepareProviderFetch("javday", "https://javday.app");
const base = site.baseUrl!;
const home = await fetchText(base + "/", siteFetchOpts(site, { timeoutMs: 90000 }));
fs.writeFileSync(path.join(import.meta.dirname, "_javday-dump/home.html"), home);
const hrefs = [...home.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);
const videoLinks = hrefs.filter((h) => /snos|sone|cjod|video|watch|archives|post/i.test(h));
console.log("video-like links", [...new Set(videoLinks)].slice(0, 30));
for (const code of ["SNOS371", "SONE001", "SONE-001"]) {
  const url = `${base}/videos/${code}/`;
  try {
    const h = await fetchText(url, siteFetchOpts(site, { timeoutMs: 60000 }));
    console.log(url, "len", h.length, "ok", /id=["']videoInfo["']|videoInfo/.test(h));
    if (/videoInfo/.test(h)) {
      fs.writeFileSync(path.join(import.meta.dirname, "_javday-dump", `${code}.html`), h);
    }
  } catch (e) {
    console.log(url, "ERR", e instanceof Error ? e.message : e);
  }
}
