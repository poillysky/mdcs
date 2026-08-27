import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import {
  fetchViaFlareSolverrFull,
  registerFlareHost,
} from "../src/scrape/network/flaresolverr.js";

initScrapeNetworkStores();
const pageUrl = "https://avsex.cc/tw/video/detail/364579";
const imageUrl = "https://image.avsex.cc/films/2023/12/10/1968049/SONE-001-2.jpg";

registerFlareHost(imageUrl);
const warm = await fetchViaFlareSolverrFull(pageUrl, { timeoutMs: 50_000 });
console.log("warm cookies:", warm.cookieHeader.length);

const hit = await fetchViaFlareSolverrFull(imageUrl, {
  timeoutMs: 50_000,
  cookie: warm.cookieHeader,
});
const raw = hit.html || "";
const buf = Buffer.from(raw, "latin1");
const head = buf.subarray(0, 16);
console.log("flare body len:", raw.length);
console.log("head hex:", head.toString("hex"));
console.log("starts:", raw.slice(0, 40));
console.log("jpeg?", head[0] === 0xff && head[1] === 0xd8);
