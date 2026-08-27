/** 探测 fd2ppv 详情/搜索真实路径 */
import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "../src/paths.js";
import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { fetchText } from "../src/scrape/network/fetch.js";

initScrapeNetworkStores();
const id = process.argv[2] || "4962908";
const base = "https://fd2ppv.cc";
const candidates = [
  `${base}/`,
  `${base}/?q=${id}`,
  `${base}/?keyword=${id}`,
  `${base}/articles/?q=${id}`,
  `${base}/articles/?keyword=${id}`,
  `${base}/articles/${id}`,
  `${base}/articles/${id}/`,
  `${base}/w/${id}`,
  `${base}/works/${id}`,
  `${base}/item/${id}`,
];

for (const url of candidates) {
  const t0 = Date.now();
  try {
    const html = await fetchText(url, {
      access: "proxy_adaptive",
      referer: `${base}/`,
      timeoutMs: 20000,
      sourceId: "fd2ppv",
    });
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim().slice(0, 60);
    const is404 = /404 Page Not Found/i.test(html);
    const hasId = html.includes(id);
    console.log(
      (is404 ? "404" : "OK "),
      String(Date.now() - t0).padStart(5),
      "ms",
      String(html.length).padStart(7),
      "B  hasId=",
      hasId,
      title,
      url,
    );
    if (!is404 && (hasId || url.endsWith("/"))) {
      const name = url.includes("?")
        ? `fd2ppv-q-${id}.html`
        : url.replace(/https?:\/\/[^/]+\/?/, "fd2ppv-").replace(/\//g, "_") + `${id ? "" : "home"}.html`;
      const safe = name.replace(/[^\w.-]+/g, "_").slice(0, 80);
      fs.writeFileSync(path.join(PROJECT_ROOT, "data/_debug", safe.includes(id) || url.endsWith("/") ? (url.endsWith("/") && !url.includes("?") ? "fd2ppv-home.html" : `fd2ppv-q-${id}.html`) : safe), html, "utf8");
    }
  } catch (e) {
    console.log("ERR", Date.now() - t0, "ms", url, e instanceof Error ? e.message : e);
  }
}
