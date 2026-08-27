import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "../src/paths.js";
import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { fetchText } from "../src/scrape/network/fetch.js";

initScrapeNetworkStores();

/** 强制走 curl，禁止 flare 回落（分析用） */
async function curlOnly(url: string) {
  return fetchText(url, {
    access: "proxy", // 若已映射为 adaptive，再看
    referer: "https://fd2ppv.cc/",
    timeoutMs: 20000,
    sourceId: "fd2ppv",
    // @ts-expect-error internal
    noFlare: true,
  });
}

// 直接用子进程 curl 更稳
import { spawnSync } from "node:child_process";
function curl(url: string) {
  const r = spawnSync(
    "curl.exe",
    ["-sL", "-A", "Mozilla/5.0", "-H", "Referer: https://fd2ppv.cc/", "--proxy", process.env.HTTPS_PROXY || process.env.HTTP_PROXY || "", url],
    { encoding: "utf8", maxBuffer: 10_000_000 },
  );
  return r.stdout || "";
}

const id = process.argv[2] || "4962908";
const urls = [
  `https://fd2ppv.cc/?keyword=${id}`,
  `https://fd2ppv.cc/articles/?keyword=${id}`,
];

// 读代理配置
const { loadScrapeConfig } = await import("../src/config/loadScrape.js");
const cfg = loadScrapeConfig(true);
const proxy = (cfg as any)?.network?.proxyUrl || (cfg as any)?.proxyUrl || "";
console.log("proxy from cfg keys", Object.keys(cfg as object).slice(0, 20));

for (const url of urls) {
  const args = ["-sL", "-w", "\nHTTP %{http_code} %{size_download}", "-A", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "-H", "Referer: https://fd2ppv.cc/", "-H", "Accept-Language: ja,en;q=0.8"];
  // 从 scrape 网络层拿代理太绕，用 curl 不带 proxy 先试直连
  const r1 = spawnSync("curl.exe", [...args, url], { encoding: "utf8", maxBuffer: 10_000_000 });
  const out1 = r1.stdout || "";
  const lines = out1.trim().split("\n");
  const status = lines.pop();
  const html = lines.join("\n");
  console.log("\nDIRECT", url, status, "len", html.length);
  fs.writeFileSync(path.join(PROJECT_ROOT, "data/_debug", `fd2ppv-direct-${url.includes("articles") ? "articles" : "root"}-${id}.html`), html, "utf8");
  console.log("title", html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim());
  const hrefs = [...new Set([...html.matchAll(/href=["']([^"']*articles[^"']*)["']/gi)].map((m) => m[1]!))];
  console.log("article hrefs", hrefs.slice(0, 15));
  const imgs = [...html.matchAll(/https?:\/\/[^"'\\s]+\.(?:jpg|jpeg|png|webp)/gi)].map((m) => m[0]).slice(0, 5);
  console.log("imgs", imgs);
}
