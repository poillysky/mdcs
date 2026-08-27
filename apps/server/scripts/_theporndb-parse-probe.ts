import { loadScrapeConfig } from "../src/config/loadScrape.js";
import { resolveTheporndbApiBase } from "../src/scrape/providers/theporndb.js";

const key = String(loadScrapeConfig(true).theporndbApiKey || "").trim();
const auth = key.toLowerCase().startsWith("bearer ") ? key : `Bearer ${key}`;
const base = resolveTheporndbApiBase();

const tests = [
  { path: "/scenes", q: "PURETABOO.2026.07.14", parse: "PURETABOO.2026.07.14" },
  { path: "/scenes", q: "Pure Taboo 2026-07-14", parse: "Pure Taboo 2026-07-14" },
  { path: "/scenes", q: "Entitled", parse: "Entitled" },
];

for (const t of tests) {
  for (const mode of ["q", "parse"] as const) {
    const term = mode === "q" ? t.q : t.parse;
    const url = `${base}${t.path}?${mode}=${encodeURIComponent(term)}&per_page=3`;
    const res = await fetch(url, { headers: { accept: "application/json", authorization: auth } });
    const json = (await res.json()) as { data?: Array<{ title?: string; date?: string; site?: { name?: string } }> };
    console.log(`${t.path}?${mode}=${term} -> ${json.data?.length ?? 0}`);
    for (const item of json.data || []) {
      console.log(`  ${item.date} | ${item.site?.name} | ${item.title}`);
    }
  }
}
