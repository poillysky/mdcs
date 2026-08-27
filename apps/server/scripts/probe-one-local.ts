import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { loadScrapeConfig } from "../src/config/loadScrape.js";
import { probeProvider, clearProbeCooldown } from "../src/scrape/probe.js";

initScrapeNetworkStores();
loadScrapeConfig(true);

const id = String(process.argv[2] || "dmm").trim();
clearProbeCooldown(id);
const r = await probeProvider(id);
console.log(JSON.stringify(r, null, 2));
