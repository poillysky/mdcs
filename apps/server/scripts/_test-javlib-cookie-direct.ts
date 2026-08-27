/** 验证浏览器 Cookie 能否让官方 javlibrary 走直链 */
import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { fetchPage } from "../src/scrape/network/download.js";
import { loadScrapeConfig } from "../src/config/loadScrape.js";
import { resolveProviderSite } from "../src/scrape/providers/providerSite.js";

initScrapeNetworkStores();

const site = resolveProviderSite("javlibrary");
const cookie = site.cookie?.trim() || "";
const URL =
  "https://www.javlibrary.com/cn/vl_searchbyid.php?keyword=SONE-001";

if (!cookie) {
  console.log("ERROR: providerSettings.javlibrary.cookie 为空");
  process.exit(1);
}

async function hit(label: string, opts: Parameters<typeof fetchPage>[1]) {
  const t = Date.now();
  const p = await fetchPage(URL, {
    ...opts,
    cookie: opts?.cookie ?? cookie,
    referer: "https://www.javlibrary.com/cn/",
  });
  console.log(
    JSON.stringify({
      label,
      ms: Date.now() - t,
      via: p?.via ?? null,
      ok: Boolean(p?.html && /class=["']video["']|video_title|识别码搜寻/i.test(p.html)),
      len: p?.html?.length ?? 0,
    }),
  );
}

console.log("baseUrl:", site.baseUrl);
await hit("official-cookie-direct-1", { timeoutMs: 15000, viaFlare: false });
await hit("official-cookie-direct-2", { timeoutMs: 15000, viaFlare: false });
