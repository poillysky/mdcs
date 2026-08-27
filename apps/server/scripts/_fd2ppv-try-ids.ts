import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "../src/paths.js";
import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { fetchText } from "../src/scrape/network/fetch.js";

initScrapeNetworkStores();

const ids = process.argv.slice(2);
const list = ids.length ? ids : ["4965833", "4962908", "3275049"];

for (const id of list) {
  for (const url of [`https://fd2ppv.cc/articles/?keyword=${id}`, `https://fd2ppv.cc/articles/${id}`]) {
    try {
      const html = await fetchText(url, {
        access: "proxy_adaptive",
        referer: "https://fd2ppv.cc/",
        timeoutMs: 25000,
        sourceId: "fd2ppv",
      });
      const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim().slice(0, 70);
      const is404 = /404 Page Not Found/i.test(html);
      const out = path.join(
        PROJECT_ROOT,
        "data/_debug",
        `fd2-${url.includes("keyword") ? "kw" : "art"}-${id}.html`,
      );
      fs.writeFileSync(out, html, "utf8");
      // extract possible detail links & img
      const links = [...new Set([...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]!))]
        .filter((h) => /articles|xximgs|webp|jpg/i.test(h))
        .slice(0, 12);
      console.log(is404 ? "404" : "OK ", id, html.length, title);
      console.log("   links", links);
      if (!is404 && html.length > 40000) {
        const i = html.search(new RegExp(id));
        if (i >= 0) console.log("   ctx", html.slice(i, i + 350).replace(/\s+/g, " "));
      }
    } catch (e) {
      console.log("ERR", id, url, e instanceof Error ? e.message : e);
    }
  }
}
