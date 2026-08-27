import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { fetchText } from "../src/scrape/network/fetch.js";
import { airavIoProvider } from "../src/scrape/providers/airav_io.js";
import { prepareProviderFetch, siteFetchOpts } from "../src/scrape/providers/providerSite.js";

const code = process.argv[2] || "SONE-001";
initScrapeNetworkStores();

const site = await prepareProviderFetch("airav_io", "https://airav.io");
const cnBase = /\/cn$/i.test(site.baseUrl) ? site.baseUrl : `${site.baseUrl}/cn`;
const searchUrl = `${cnBase}/search_result?kw=${encodeURIComponent(code.toUpperCase())}`;
console.log("searchUrl=", searchUrl);

const searchHtml = await fetchText(searchUrl, siteFetchOpts(site, { timeoutMs: 30000, referer: `${cnBase}/` }));
console.log("search len=", searchHtml.length);
const hits = [...searchHtml.matchAll(/oneVideo[\s\S]{0,500}?<h5[^>]*>([\s\S]*?)<\/h5>/gi)].slice(0, 5);
for (const h of hits) console.log("hit h5:", h[1]?.replace(/<[^>]+>/g, "").trim());

const r = await airavIoProvider.scrape({
  code,
  kind: "japan_censored",
  signal: AbortSignal.timeout(90000),
});
console.log(JSON.stringify(r, null, 2));
