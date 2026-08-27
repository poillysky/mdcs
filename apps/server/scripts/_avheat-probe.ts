import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { fetchText } from "../src/scrape/network/fetch.js";
import { prepareProviderFetch, siteFetchOpts } from "../src/scrape/providers/providerSite.js";

initScrapeNetworkStores();
const site = await prepareProviderFetch("avheat", "https://avheat.shop");
const base = site.baseUrl;

const queries = [
  "Cheating Trophy Wives",
  "Office Play",
  "Black Ambush",
  "Pure Taboo Entitled",
  "RK 2012",
];

for (const q of queries) {
  const url = `${base}/cn/search/${encodeURIComponent(q)}`;
  const html = await fetchText(
    url,
    siteFetchOpts(site, { referer: `${base}/cn`, timeoutMs: 120000, waitInSeconds: 5 }),
  );
  const empty = /没有结果|沒有結果|no results/i.test(html || "");
  const cards = (html?.match(/href=["'][^"']*\/cn\/movies\//gi) || []).length;
  console.log(`${q}: len=${html?.length ?? 0} empty=${empty} movieLinks=${cards}`);
  if (cards > 0) {
    const m = html!.match(/href=["']([^"']*\/cn\/movies\/[^"'#]+)["']/i);
    console.log("  first", m?.[1]);
  }
}
