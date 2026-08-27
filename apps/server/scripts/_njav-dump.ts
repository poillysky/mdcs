import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "../src/paths.js";
import { absUrl } from "../src/scrape/providers/htmlUtils.js";
import { fetchPageForSite, prepareProviderFetch } from "../src/scrape/providers/providerSite.js";

const code = process.argv[2] || "SONE-001";
const baseArg = process.argv[3] || "https://123av.com/ja";
const outDir = path.join(PROJECT_ROOT, "data/_debug");

async function main() {
  const site = await prepareProviderFetch("njav", baseArg);
  site.baseUrl = baseArg.replace(/\/$/, "");
  const base = site.baseUrl.replace(/\/$/, "");
  const referer = `${base}/`;

  const searchUrl = `${base}/search?keyword=${encodeURIComponent(code)}`;
  console.log("search", searchUrl);
  const searchPage = await fetchPageForSite(searchUrl, site, {
    referer,
    timeoutMs: 60000,
    strictTimeout: true,
  });
  const searchHtml = searchPage?.html || "";
  console.log("search len", searchHtml.length, "final", searchPage?.finalUrl);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "njav-search-SONE-001.html"), searchHtml);

  const $re = /href=["']([^"']*(?:\/v\/|\/videos\/)[^"']+)["']/gi;
  const hrefs = [...searchHtml.matchAll($re)].map((m) => m[1]!);
  console.log("video hrefs", hrefs.slice(0, 8));

  const std = code.toLowerCase();
  const compact = std.replace(/-/g, "");
  const pick =
    hrefs.find((h) => h.toLowerCase().includes(compact) && !/uncensored-leak/i.test(h)) ||
    hrefs.find((h) => h.toLowerCase().includes(std)) ||
    hrefs[0];
  if (!pick) {
    console.error("no detail");
    process.exit(1);
  }
  const detailUrl = absUrl(pick, `${base}/`) || pick;
  console.log("detail", detailUrl);
  const detailPage = await fetchPageForSite(detailUrl, site, {
    referer: searchUrl,
    timeoutMs: 60000,
    strictTimeout: true,
  });
  const detailHtml = detailPage?.html || "";
  console.log("detail len", detailHtml.length, "final", detailPage?.finalUrl);
  fs.writeFileSync(path.join(outDir, "njav-detail-sone001.html"), detailHtml);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
