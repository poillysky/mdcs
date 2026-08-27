import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { fetchViaFlareSolverrFull } from "../src/scrape/network/flaresolverr.js";
import { fetchBinaryViaCurl } from "../src/scrape/network/download.js";

initScrapeNetworkStores();
const img = "https://image.lulubar.co/films/2023/12/10/1968049/SONE-001-2.jpg";
const ref = "https://lulubar.co/video/detail?id=364579";

console.log("flare image CDN...");
const hit = await fetchViaFlareSolverrFull(img, { timeoutMs: 60_000 });
console.log("status", hit.status, "html len", hit.html?.length, "cookies", hit.cookieHeader?.slice(0, 80));

const raw = hit.html || "";
const buf = Buffer.from(raw, "latin1");
console.log("buf len", buf.length, "head", buf.subarray(0, 4).toString("hex"));

if (buf.length > 1024 && buf[0] === 0xff && buf[1] === 0xd8) {
  console.log("OK jpeg from flare");
} else {
  console.log("not jpeg, preview:", raw.slice(0, 200));
}

console.log("curl with flare cookies...");
const curlBuf = await fetchBinaryViaCurl(img, {
  timeoutMs: 20_000,
  referer: ref,
  cookie: hit.cookieHeader,
  userAgent: hit.userAgent,
  secFetchImage: true,
});
console.log("curl result", curlBuf?.length ?? "null");
