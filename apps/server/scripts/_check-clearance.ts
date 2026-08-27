import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { getCachedClearance } from "../src/scrape/network/flaresolverr.js";

initScrapeNetworkStores();
const url = "https://fd2ppv.cc/articles/3275049";
const hit = getCachedClearance(url);
console.log("hit", hit ? { ua: hit.userAgent?.slice(0, 60), cookieLen: hit.cookieHeader?.length } : null);
