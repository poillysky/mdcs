import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { probeProvider } from "../src/scrape/probe.js";
import type { SourceId } from "../src/scrape/types.js";

const id = (process.argv[2] || "javbus") as SourceId;
initScrapeNetworkStores();
const r = await probeProvider(id);
console.log(JSON.stringify(r, null, 2));
