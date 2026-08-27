import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { loadScrapeConfig } from "../src/config/loadScrape.js";
import { fetchPage } from "../src/scrape/network/download.js";
import { looksBlockedHtml } from "../src/scrape/network/flaresolverr.js";

initScrapeNetworkStores();
loadScrapeConfig(true);

const page = await fetchPage("https://www.mgstage.com/", {
  timeoutMs: 45000,
  strictTimeout: true,
  viaFlare: false,
  sourceId: "mgstage",
  cookie: "adc=1",
  referer: "https://www.mgstage.com/",
});
console.log(
  JSON.stringify({
    via: page?.via,
    len: page?.html?.length ?? 0,
    blocked: looksBlockedHtml(page?.html),
    head: (page?.html || "").slice(0, 200).replace(/\s+/g, " "),
    finalUrl: page?.finalUrl,
  }),
);
