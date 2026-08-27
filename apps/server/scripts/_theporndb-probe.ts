import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { probeProvider } from "../src/scrape/probe.js";

initScrapeNetworkStores();
const r = await probeProvider("theporndb");
console.log(JSON.stringify(r, null, 2));
