/**
 * One-off: dump airav probe response via MDCS network stack.
 * Usage: npx tsx scripts/diag-airav.ts
 */
import { loadScrapeConfig } from "../src/config/loadScrape.js";
import { applyProxy } from "../src/scrape/network/proxy.js";
import { fetchText } from "../src/scrape/network/fetch.js";
import { undiciGet } from "../src/scrape/network/proxy.js";

const cfg = loadScrapeConfig();
console.log("proxyUrl=", cfg.proxyUrl);
applyProxy(cfg.proxyUrl);

const urls = [
  "https://www.airav.wiki/",
  "https://airav.wiki/",
  "https://airav.io/cn/",
  "https://airav.io/",
];

for (const url of urls) {
  const started = Date.now();
  try {
    const res = await undiciGet(url, {
      signal: AbortSignal.timeout(20_000),
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "zh-TW,zh;q=0.9,en;q=0.8",
        referer: "https://www.google.com/",
      },
    });
    const text = await res.text();
    const head = text.slice(0, 280).replace(/\s+/g, " ");
    console.log(
      JSON.stringify({
        url,
        status: res.status,
        ms: Date.now() - started,
        len: text.length,
        head,
      }),
    );
  } catch (e) {
    console.log(
      JSON.stringify({
        url,
        ms: Date.now() - started,
        error: e instanceof Error ? e.message : String(e),
      }),
    );
  }
}

// also try fetchText adaptive
try {
  const html = await fetchText("https://www.airav.wiki/", {
    access: "proxy_adaptive",
    timeoutMs: 45_000,
  });
  console.log("fetchText adaptive ok len=", html.length);
} catch (e) {
  console.log("fetchText adaptive fail:", e instanceof Error ? e.message : e);
}
