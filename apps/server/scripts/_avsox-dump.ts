import fs from "node:fs";
import path from "node:path";
import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { fetchText } from "../src/scrape/network/fetch.js";
import { prepareProviderFetch, siteFetchOpts } from "../src/scrape/providers/providerSite.js";
import { PROJECT_ROOT } from "../src/paths.js";

initScrapeNetworkStores();

const codes = ["SONE-001", "CARIB-010117-339", "010117-339", "HEYZO-1234"];
const site = await prepareProviderFetch("avsox", "https://avsox.click");
const base = site.baseUrl!;
const lang = "cn";
const outDir = path.join(PROJECT_ROOT, "data/_debug");
fs.mkdirSync(outDir, { recursive: true });

for (const code of codes) {
  const searchUrl = `${base}/${lang}/search/${encodeURIComponent(code)}`;
  console.log("search", code, searchUrl);
  const html = await fetchText(
    searchUrl,
    siteFetchOpts(site, { referer: `${base}/${lang}`, timeoutMs: 120000, waitInSeconds: 3 }),
  );
  const file = path.join(outDir, `avsox-search-${code.replace(/[^\w-]+/g, "_")}.html`);
  fs.writeFileSync(file, html, "utf8");
  console.log("  len", html.length, "->", file);
  const movie = html.match(/href=["']([^"']*\/movies\/[^"']+)["']/i)?.[1];
  if (movie) {
    const detailUrl = movie.startsWith("http") ? movie : `${base}${movie.startsWith("/") ? "" : "/"}${movie}`;
    console.log("  detail", detailUrl);
    const detail = await fetchText(
      detailUrl,
      siteFetchOpts(site, { referer: searchUrl, timeoutMs: 120000, waitInSeconds: 3 }),
    );
    const dfile = path.join(outDir, `avsox-detail-${code.replace(/[^\w-]+/g, "_")}.html`);
    fs.writeFileSync(dfile, detail, "utf8");
    console.log("  detail len", detail.length, "->", dfile);
  }
}
