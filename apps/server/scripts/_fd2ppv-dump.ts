/** Live dump fd2ppv article HTML */
import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "../src/paths.js";
import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { fetchText } from "../src/scrape/network/fetch.js";
import { prepareProviderFetch, siteFetchOpts } from "../src/scrape/providers/providerSite.js";
import { fd2ppvProvider } from "../src/scrape/providers/fd2ppv.js";

initScrapeNetworkStores();
const code = process.argv[2] || "FC2-PPV-4962908";
const id =
  code.match(/FC2[-_]?PPV[-_]?(\d+)/i)?.[1] ||
  code.match(/FC2[-_]?(\d+)/i)?.[1] ||
  code.match(/(\d{5,})/)?.[1] ||
  code;
const site = await prepareProviderFetch("fd2ppv", "https://fd2ppv.cc");
const base = site.baseUrl!;
const url = `${base}/articles/${id}`;
console.log("url", url, "access", site.access);
const html = await fetchText(url, siteFetchOpts(site, { referer: `${base}/`, timeoutMs: 60000 }));
const out = path.join(PROJECT_ROOT, `data/_debug/fd2ppv-detail-${id}.html`);
fs.writeFileSync(out, html, "utf8");
console.log("len", html.length, "out", out);
console.log("challenge", /Just a moment|cf-browser-verification/i.test(html));
console.log("has work-brief", /work-brief/i.test(html));
console.log("has inertia", /data-page=["']app["']/i.test(html));
console.log("FC2CMADB", /FC2CMADB/i.test(html));
console.log("title tag", html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.slice(0, 120));
console.log("og:image", html.match(/property=["']og:image["'][^>]*content=["']([^"']+)/i)?.[1]?.slice(0, 120));

const r = await fd2ppvProvider.scrape({
  code,
  kind: "fc2",
  metaSources: ["fd2ppv"],
  coverSources: ["fd2ppv"],
  signal: AbortSignal.timeout(120000),
});
console.log(JSON.stringify({
  error: r?.error,
  ms: r?.ms,
  title: r?.fields.title,
  studio: r?.fields.studio,
  genres: r?.fields.genres?.slice(0, 8),
  actors: r?.fields.actors?.slice(0, 5),
  premiered: r?.fields.premiered,
  runtime: r?.fields.runtime,
  cover: r?.coverUrl?.slice(0, 100),
}, null, 2));

const { releaseFlareSession, recycleFlareSessions } = await import("../src/scrape/network/flaresolverr.js");
await releaseFlareSession("fd2ppv-dump");
await recycleFlareSessions({ keepOwned: false });
