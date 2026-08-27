import fs from "node:fs";
import path from "node:path";
import { fetchText } from "../src/scrape/network/fetch.js";
import { prepareProviderFetch, siteFetchOpts } from "../src/scrape/providers/providerSite.js";

const outDir = path.resolve(process.cwd(), "../../data/_debug");
fs.mkdirSync(outDir, { recursive: true });

async function tryFetch(label: string, url: string, access: "proxy" | "proxy_flare" | "proxy_adaptive") {
  const site = await prepareProviderFetch("avsex", "https://avsex.cc");
  const opts = siteFetchOpts({ ...site, access }, { timeoutMs: 60000, referer: "https://avsex.cc/" });
  try {
    const html = await fetchText(url, opts);
    const file = path.join(outDir, `avsex-${label}-${access}.html`);
    fs.writeFileSync(file, html, "utf8");
    console.log("OK", label, access, "len=", html.length, "file=", file);
    console.log("title=", html.match(/<title[^>]*>([^<]+)/i)?.[1]?.slice(0, 80));
    return html;
  } catch (e) {
    console.log("FAIL", label, access, e instanceof Error ? e.message : e);
    return null;
  }
}

const base = "https://avsex.cc";
const detail = "https://avsex.cc/tw/video/detail/364579";
await tryFetch("detail-364579", detail, "proxy_flare");
