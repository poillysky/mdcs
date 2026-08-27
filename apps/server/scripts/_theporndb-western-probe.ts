import { loadScrapeConfig } from "../src/config/loadScrape.js";
import { resolveTheporndbApiBase } from "../src/scrape/providers/theporndb.js";

const key = String(loadScrapeConfig(true).theporndbApiKey || "").trim();
const auth = key.toLowerCase().startsWith("bearer ") ? key : `Bearer ${key}`;
const base = resolveTheporndbApiBase();

const queries = [
  "PURETABOO 2026.07.14",
  "PURETABOO",
  "Pure Taboo 2026-07-14",
  "RK 2012.02.23",
  "Reality Kings 2012-02-23",
  "SEXMEX 2026.07.14",
];

for (const q of queries) {
  for (const path of [`/scenes?q=${encodeURIComponent(q)}&per_page=3`, `/movies?q=${encodeURIComponent(q)}&per_page=3`]) {
    const res = await fetch(`${base}${path}`, {
      headers: { accept: "application/json", authorization: auth },
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json()) as { data?: Array<{ title?: string; date?: string; site?: { name?: string } }> };
    console.log(`${path.split("?")[0]} q=${q} -> ${json.data?.length ?? 0}`);
    for (const item of json.data || []) {
      console.log(`  ${item.date || "?"} | ${item.site?.name || "?"} | ${item.title?.slice(0, 70)}`);
    }
  }
}
