import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { loadScrapeConfig } from "../src/config/loadScrape.js";
import { fetchViaFlareSolverrFull, looksBlockedHtml } from "../src/scrape/network/flaresolverr.js";

initScrapeNetworkStores();
loadScrapeConfig(true);

const hit = await fetchViaFlareSolverrFull("https://www.mgstage.com/", {
  timeoutMs: 45000,
  cookie: "adc=1",
  noSessionRetry: true,
});
console.log(
  JSON.stringify({
    len: hit.html.length,
    blocked: looksBlockedHtml(hit.html),
    finalUrl: hit.finalUrl,
    head: hit.html.slice(0, 300).replace(/\s+/g, " "),
  }),
);
