import { loadScrapeConfig } from "../src/config/loadScrape.js";
import { fetchText } from "../src/scrape/network/fetch.js";
import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { prepareProviderFetch, siteFetchOpts } from "../src/scrape/providers/providerSite.js";

const CODE = process.argv[2] || "SONE-001";

initScrapeNetworkStores();
const site = await prepareProviderFetch("airav_io", "https://airav.io");
const cnBase = /\/cn$/i.test(site.baseUrl) ? site.baseUrl : `${site.baseUrl}/cn`;
const searchUrl = `${cnBase}/search_result?kw=${encodeURIComponent(CODE.toUpperCase())}`;
console.log("baseUrl=", site.baseUrl);
console.log("searchUrl=", searchUrl);

const searchHtml = await fetchText(
  searchUrl,
  siteFetchOpts(site, { referer: `${cnBase}/`, timeoutMs: 60000 }),
);
console.log("search len=", searchHtml.length);

const codeRe = new RegExp(CODE.replace(/-/g, "[-_]?"), "i");
for (const m of searchHtml.matchAll(
  /class=["'][^"']*oneVideo[^"']*["'][\s\S]{0,2000}?href=["']([^"']*\/video\?hid=[^"'#]+)["']([\s\S]{0,1200})/gi,
)) {
  const href = m[1];
  const h5 = (m[2] || "").match(/<h5[^>]*>([\s\S]*?)<\/h5>/i)?.[1]?.replace(/<[^>]+>/g, "") || "";
  console.log("hit:", { href, h5, match: codeRe.test(h5) });
}

const firstHid = searchHtml.match(/href=["']([^"']*\/video\?hid=[^"'#]+)["']/i)?.[1];
if (firstHid) {
  const detailUrl = firstHid.startsWith("http") ? firstHid : `${cnBase}${firstHid.startsWith("/") ? "" : "/"}${firstHid}`;
  console.log("try detail=", detailUrl);
  try {
    const detailHtml = await fetchText(
      detailUrl,
      siteFetchOpts(site, { referer: searchUrl, timeoutMs: 60000 }),
    );
    console.log("detail len=", detailHtml.length);
    const title = detailHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "").trim();
    const num = detailHtml.match(/番[号號]\s*[：:]\s*<span[^>]*>([^<]+)<\/span>/i)?.[1];
    console.log("title=", title);
    console.log("num=", num);
  } catch (e) {
    console.log("detail error:", e instanceof Error ? e.message : e);
  }
}
