/**
 * Flare + proxy injection check (align sehua).
 * npx tsx scripts/diag-flare-airav.ts
 */
import { loadScrapeConfig } from "../src/config/loadScrape.js";
import { applyProxy } from "../src/scrape/network/proxy.js";
import { flareGet, normalizeFlareUrl } from "../src/scrape/network/flare.js";

const cfg = loadScrapeConfig();
applyProxy(cfg.proxyUrl);
console.log("flare=", normalizeFlareUrl(cfg.flareSolverrUrl));
console.log("proxy=", cfg.proxyUrl);

const r = await flareGet("https://www.airav.wiki/", { timeoutMs: 60_000 });
console.log(
  JSON.stringify({
    ok: r.ok,
    status: r.status,
    ms: r.ms,
    error: r.error,
    len: r.html?.length ?? 0,
    blocked: /just a moment/i.test(r.html || ""),
    head: (r.html || "").slice(0, 120).replace(/\s+/g, " "),
  }),
);
