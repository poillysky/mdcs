import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
initScrapeNetworkStores();
const urls = [
  "https://contents-thumbnail2.fc2.com/w1280/storage201000.contents.fc2.com/file/383/38273024/1786948445.16.jpg",
  "https://storage201000.contents.fc2.com/file/383/38273024/1786948445.16.jpg",
];
for (const url of urls) {
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(20000),
      headers: { Referer: "https://javten.com/", "User-Agent": "Mozilla/5.0" },
    });
    const buf = await res.arrayBuffer();
    console.log(res.status, res.headers.get("content-type"), buf.byteLength, url.slice(0, 100));
  } catch (e) {
    console.log("ERR", e instanceof Error ? e.message : e, url.slice(0, 100));
  }
}
