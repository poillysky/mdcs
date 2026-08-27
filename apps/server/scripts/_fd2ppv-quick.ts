/** fd2ppv 直连取页（不走 Flare） */
import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "../src/paths.js";
import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { fetchText } from "../src/scrape/network/fetch.js";
import { prepareProviderFetch, siteFetchOpts } from "../src/scrape/providers/providerSite.js";
import { fd2ppvProvider } from "../src/scrape/providers/fd2ppv.js";

initScrapeNetworkStores();
const code = process.argv[2] || "FC2-PPV-4962908";
const id = code.match(/FC2[-_]?PPV[-_]?(\d+)/i)?.[1] || code.match(/FC2[-_]?(\d+)/i)?.[1] || "";
const site = await prepareProviderFetch("fd2ppv", "https://fd2ppv.cc");
console.log("access=", site.access, "base=", site.baseUrl);
const urls = [
  `${site.baseUrl}/articles/${id}`,
  `${site.baseUrl}/?q=${id}`,
  `${site.baseUrl}/search?q=${id}`,
];
for (const url of urls) {
  const t0 = Date.now();
  try {
    const html = await fetchText(
      url,
      siteFetchOpts(site, { referer: `${site.baseUrl}/`, timeoutMs: 25000, access: "proxy_adaptive" }),
    );
    const out = path.join(PROJECT_ROOT, "data/_debug", `fd2ppv-${url.includes("articles") ? "detail" : "search"}-${id}.html`);
    fs.writeFileSync(out, html, "utf8");
    console.log("OK", Date.now() - t0, "ms", html.length, "B", url);
    console.log("  title=", html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim().slice(0, 80));
    console.log("  markers work-brief=", /work-brief/i.test(html), "work-meta=", /work-meta/i.test(html), "og:image=", /og:image/i.test(html), "404=", /404 Page Not Found/i.test(html));
  } catch (e) {
    console.log("FAIL", Date.now() - t0, "ms", url, e instanceof Error ? e.message : e);
  }
}
const r = await fd2ppvProvider.scrape({
  code,
  kind: "fc2",
  metaSources: ["fd2ppv"],
  coverSources: ["fd2ppv"],
  signal: AbortSignal.timeout(60000),
});
console.log("scrape", JSON.stringify({
  error: r?.error,
  ms: r?.ms,
  title: r?.fields.title?.slice(0, 50),
  studio: r?.fields.studio,
  cover: r?.coverUrl?.slice(0, 90),
  genresN: r?.fields.genres?.length,
}, null, 2));
