import { applyProxy } from "../src/scrape/network/proxy.js";
import { loadScrapeConfig } from "../src/config/loadScrape.js";
import { probeProvider, clearProbeCooldown } from "../src/scrape/probe.js";

const cfg = loadScrapeConfig();
applyProxy(cfg.proxyUrl);
clearProbeCooldown("airav");
const r = await probeProvider("airav");
console.log(JSON.stringify(r));
