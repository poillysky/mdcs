import { fetchPageForSite, prepareProviderFetch } from "../src/scrape/providers/providerSite.js";

const code = process.argv[2] || "SONE-001";
const urlArg = process.argv[3];

async function main() {
  const site = await prepareProviderFetch("njav", "https://njav.tv/ja");
  const base = site.baseUrl.replace(/\/$/, "");
  const compact = code.replace(/-/g, "").toLowerCase();
  const url = urlArg || `${base}/ja/${compact}`;
  console.log("probe", url);
  const t0 = Date.now();
  const page = await fetchPageForSite(url, site, {
    referer: `${base}/ja/`,
    timeoutMs: 45000,
    strictTimeout: true,
  });
  const html = page?.html || "";
  console.log("ms", Date.now() - t0);
  console.log("final", page?.finalUrl);
  console.log("len", html.length);
  if (html.length > 0) {
    const ogType = html.match(/property=["']og:type["']\s+content=["']([^"']+)["']/i)?.[1];
    const ogTitle = html.match(/property=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1];
    const siteName = html.match(/property=["']og:site_name["']\s+content=["']([^"']+)["']/i)?.[1];
    console.log("og:type", ogType, "site", siteName);
    console.log("og:title", ogTitle?.slice(0, 80));
    console.log("snippet", html.slice(0, 500).replace(/\s+/g, " "));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
