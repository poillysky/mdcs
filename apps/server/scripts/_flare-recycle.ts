/** 紧急回收 FlareSolverr 全部会话 */
import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import {
  getFlareSolverrUrl,
  listFlareSessions,
  recycleFlareSessions,
} from "../src/scrape/network/flaresolverr.js";

initScrapeNetworkStores();
const flare = getFlareSolverrUrl();
console.log("flare=", flare || "(none)");
try {
  const before = await listFlareSessions();
  console.log("before count=", before.length, before.map((s) => s.slice(0, 8)));
} catch (e) {
  console.log("list failed", e instanceof Error ? e.message : e);
}
const r = await recycleFlareSessions({ keepOwned: false });
console.log("recycle", r);
try {
  const after = await listFlareSessions();
  console.log("after count=", after.length, after);
} catch (e) {
  console.log("list after failed", e instanceof Error ? e.message : e);
}
