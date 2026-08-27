/** Live dump fc2_hub search+detail HTML for FC2-PPV-3275049 */
import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "../src/paths.js";
import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { prepareProviderFetch, fetchPageForSite, siteFetchOpts } from "../src/scrape/providers/providerSite.js";
import {
  parseFc2HubCover,
  parseFc2HubDetailHtml,
  parseFc2HubExtrafanart,
  parseFc2HubTags,
  parseFc2Id,
} from "../src/scrape/providers/fc2_hub.js";

initScrapeNetworkStores();
const outDir = path.join(PROJECT_ROOT, "data/_debug");
fs.mkdirSync(outDir, { recursive: true });

const code = process.argv[2] || "FC2-PPV-3275049";
const parsed = parseFc2Id(code)!;
const id = parsed.id;
const site = await prepareProviderFetch("fc2_hub", "https://javten.com");
const base = site.baseUrl!;
const searchUrl = `${base}/search?kw=${encodeURIComponent(id)}`;
const fetchOpts = siteFetchOpts(site, { referer: `${base}/`, timeoutMs: 60000 });

console.log("search", searchUrl);
const searchPage = await fetchPageForSite(searchUrl, site, fetchOpts);
const searchHtml = searchPage?.html || "";
fs.writeFileSync(path.join(outDir, `fc2-hub-search-${id}.html`), searchHtml, "utf8");
console.log("search len", searchHtml.length);

const detailHref =
  searchHtml.match(new RegExp(`https?://[^"'\\s]+/video/\\d+/id${id}\\b`, "i"))?.[0] ||
  [...searchHtml.matchAll(new RegExp(`(?:href|content)=["']([^"']*id${id}[^"']*)["']`, "gi"))]
    .map((x) => x[1]!)
    .find((h) => /\/video\/\d+\/id/i.test(h) && !/\/tw\/|\/ko\/|\/en\//i.test(h));

let detailUrl = detailHref
  ? detailHref.startsWith("http")
    ? detailHref
    : new URL(detailHref, base).href
  : null;
console.log("detailUrl", detailUrl);

let html = searchHtml;
if (detailUrl && !/data-fancybox=["']gallery["']/i.test(searchHtml)) {
  const detailPage = await fetchPageForSite(
    detailUrl,
    site,
    siteFetchOpts(site, { referer: searchUrl, timeoutMs: 45000 }),
  );
  html = detailPage?.html || "";
}
fs.writeFileSync(path.join(outDir, `fc2-hub-detail-${id}.html`), html, "utf8");
console.log("detail len", html.length);
console.log("fancybox", (html.match(/data-fancybox/gi) || []).length);
console.log("/tag/", (html.match(/\/tag\//gi) || []).length);
console.log("padding0", (html.match(/padding:\s*0/gi) || []).length);
const hrefs = [
  ...html.matchAll(/data-fancybox=["']gallery["'][^>]*href=["']([^"']+)["']/gi),
  ...html.matchAll(/href=["']([^"']+)["'][^>]*data-fancybox=["']gallery["']/gi),
].map((m) => m[1]);
console.log("fancy hrefs", [...new Set(hrefs)].slice(0, 10));
console.log("cover", parseFc2HubCover(html, detailUrl || base));
console.log("tags", parseFc2HubTags(html));
console.log("extra", parseFc2HubExtrafanart(html, detailUrl || base).slice(0, 8));
const hit = parseFc2HubDetailHtml(html, detailUrl || `${base}/video/x/id${id}`, code);
console.log(
  JSON.stringify(
    {
      title: hit?.fields.title,
      genres: hit?.fields.genres,
      cover: hit?.coverUrl,
      studio: hit?.fields.studio,
      series: hit?.fields.series,
      mosaic: hit?.fields.mosaic,
      extraN: hit?.extrafanartUrls?.length,
      plotLen: hit?.fields.plot?.length,
    },
    null,
    2,
  ),
);

const { releaseFlareSession, recycleFlareSessions } = await import(
  "../src/scrape/network/flaresolverr.js"
);
await releaseFlareSession("dump-done");
await recycleFlareSessions({ keepOwned: false });
