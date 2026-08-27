import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "../src/paths.js";
import { fetchPageForSite, prepareProviderFetch } from "../src/scrape/providers/providerSite.js";

const code = process.argv[2] || "SONE-001";
const outDir = path.join(PROJECT_ROOT, "data/_debug");

async function main() {
  const site = await prepareProviderFetch("miss_av", "https://missav123.com");
  const base = site.baseUrl.replace(/\/$/, "");
  const compact = code.replace(/-/g, "").toLowerCase();

  for (const url of [
    `${base}/cn/${encodeURIComponent(compact)}`,
    `${base}/cn/search/${encodeURIComponent(code)}`,
  ]) {
    console.log("fetch", url);
    const page = await fetchPageForSite(url, site, {
      referer: `${base}/cn/`,
      timeoutMs: 90000,
      viaFlare: true,
      strictTimeout: true,
    });
    const html = page?.html || "";
    console.log("final", page?.finalUrl, "len", html.length);
    if (html.length < 500) continue;
    const name = url.includes("/search/")
      ? `missav-search-${code}.html`
      : `missav-detail-${compact}.html`;
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, name), html);
    console.log("saved", name);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
