import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { avsoxProvider } from "../src/scrape/providers/avsox.js";

initScrapeNetworkStores();
const r = await avsoxProvider.scrape({
  code: "CARIB-010117-339",
  kind: "japan_uncensored",
  metaSources: ["avsox"],
  coverSources: ["avsox"],
});
console.log(JSON.stringify(r, null, 2));
