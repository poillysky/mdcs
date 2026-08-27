import { loadScrapeConfig } from "../src/config/loadScrape.js";
import { initScrapeNetworkStores } from "../src/scrape/network/init.js";

initScrapeNetworkStores();
const key = String(loadScrapeConfig(true).theporndbApiKey || "").trim();
if (!key) throw new Error("no api key");
const auth = key.toLowerCase().startsWith("bearer ") ? key : `Bearer ${key}`;

const tests: Array<{ label: string; url: string; init?: RequestInit }> = [
  {
    label: "old-rest-root",
    url: "https://api.theporndb.net/jav?q=SONE-001&per_page=1",
    init: { headers: { accept: "application/json", authorization: auth } },
  },
  {
    label: "site-graphql",
    url: "https://theporndb.net/graphql",
    init: {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: auth,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        query: `query { searchScene(term: "SONE-001", limit: 1) { id title date } }`,
      }),
    },
  },
  {
    label: "site-rest-jav",
    url: "https://theporndb.net/jav?q=SONE-001&per_page=1",
    init: { headers: { accept: "application/json", authorization: auth } },
  },
  {
    label: "meta-rest-jav",
    url: "https://metadataapi.net/api/jav?q=SONE-001&per_page=1",
    init: { headers: { accept: "application/json", authorization: auth } },
  },
];

for (const t of tests) {
  try {
    const res = await fetch(t.url, { ...t.init, signal: AbortSignal.timeout(15_000) });
    const text = await res.text();
    console.log(`${t.label}: HTTP ${res.status} len=${text.length} head=${text.slice(0, 120).replace(/\s+/g, " ")}`);
  } catch (e) {
    console.log(`${t.label}: ERR ${e instanceof Error ? e.message : e}`);
  }
}
