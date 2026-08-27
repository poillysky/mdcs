import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { fetchPage } from "../src/scrape/network/download.js";
import {
  listAiravSearchCards,
  pickAiravHidFromSearch,
  airavDetailCodeOk,
} from "../src/scrape/providers/airav_io.js";
import { absUrl } from "../src/scrape/providers/htmlUtils.js";
import { prepareProviderFetch } from "../src/scrape/providers/providerSite.js";

const code = process.argv[2] || "SONE-001";
initScrapeNetworkStores();
const site = await prepareProviderFetch("airav_io", "https://airav.io/cn");
const cnBase = /\/cn$/i.test(site.baseUrl) ? site.baseUrl : `${site.baseUrl}/cn`;
const searchUrl = `${cnBase}/search_result?kw=${encodeURIComponent(code.toUpperCase())}`;
console.log("searchUrl=", searchUrl);

const searchPage = await fetchPage(searchUrl, {
  referer: `${cnBase}/`,
  sourceId: "airav_io",
  cookie: site.cookie,
  timeoutMs: 30000,
  viaFlare: false,
  strictTimeout: true,
});
console.log("search len=", searchPage?.html?.length, "final=", searchPage?.finalUrl);
const cards = listAiravSearchCards(searchPage?.html || "");
console.log("cards=", cards.slice(0, 3));
const hid = pickAiravHidFromSearch(searchPage?.html || "", code.toUpperCase());
console.log("hid=", hid);
const detailUrl = absUrl(hid || "", searchPage?.finalUrl || cnBase);
console.log("detailUrl=", detailUrl);

if (detailUrl) {
  const detailPage = await fetchPage(detailUrl, {
    referer: searchUrl,
    sourceId: "airav_io",
    cookie: site.cookie,
    timeoutMs: 30000,
    viaFlare: false,
    strictTimeout: true,
  });
  console.log("detail status len=", detailPage?.html?.length, "final=", detailPage?.finalUrl);
  console.log("detailCodeOk=", airavDetailCodeOk(detailPage?.html || "", code.toUpperCase()));
  console.log("head=", detailPage?.html?.slice(0, 200).replace(/\s+/g, " "));
}
