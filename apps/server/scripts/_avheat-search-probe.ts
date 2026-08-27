import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { fetchText } from "../src/scrape/network/fetch.js";
import { prepareProviderFetch, siteFetchOpts } from "../src/scrape/providers/providerSite.js";

initScrapeNetworkStores();
const site = await prepareProviderFetch("avheat", "https://avheat.shop");
const base = site.baseUrl;

const queries = [
  "WeLiveTogether.12.02.23",
  "Reality Kings 2012-02-23",
  "WeLiveTogether 2012-02-23",
  "RK.2012.02.23",
];

for (const q of queries) {
  const url = `${base}/cn/search/${encodeURIComponent(q)}`;
  const html = await fetchText(
    url,
    siteFetchOpts(site, { referer: `${base}/cn`, timeoutMs: 120000, waitInSeconds: 5 }),
  );
  const empty = /没有结果|沒有結果|no results/i.test(html || "");
  const cards = (html?.match(/href=["'][^"']*\/cn\/movies\//gi) || []).length;
  const meta = html?.match(/class=["']movie-meta["'][\s\S]{0,200}/i)?.[0]?.replace(/\s+/g, " ").slice(0, 180);
  console.log(`${q}: empty=${empty} links=${cards} meta=${meta || "-"}`);
}
