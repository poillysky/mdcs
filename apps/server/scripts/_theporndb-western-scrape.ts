import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { theporndbProvider } from "../src/scrape/providers/theporndb.js";

initScrapeNetworkStores();
const codes = ["PURETABOO.2026.07.14", "RK.2012.02.23", "SONE-001"];
for (const code of codes) {
  console.log(`\n=== scrape ${code} ===`);
  const r = await theporndbProvider.scrape!({ code, signal: AbortSignal.timeout(45_000) });
  console.log(`ok=${!r?.error} err=${r?.error || "—"} ms=${r?.ms}`);
  console.log(`title=${r?.fields.title || "—"}`);
  console.log(`studio=${r?.fields.studio || "—"}`);
  console.log(`premiered=${r?.fields.premiered || "—"}`);
  console.log(`actors=${(r?.fields.actors || []).slice(0, 5).join(", ") || "—"}`);
  console.log(`cover=${r?.coverUrl ? "yes" : "no"}`);
}
