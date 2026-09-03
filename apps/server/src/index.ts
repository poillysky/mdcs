import http from "node:http";
import { WebSocketServer } from "ws";
import { createApp } from "./api/app.js";
import { loadScrapeConfig } from "./config/loadScrape.js";
import { loadOpsConfig } from "./ops/loadOps.js";
import { startMonitorService } from "./ops/monitor.js";
import { startEmbyActorScheduler } from "./ops/embyActorScheduler.js";
import { onJobEvent, onJobUpdate } from "./jobs/scheduler.js";
import { onFileChange } from "./files/events.js";
import { onIndexAllUpdate } from "./jobs/indexAll.js";
import { openDatabase } from "./db/init.js";
import { PROJECT_ROOT } from "./paths.js";
import { syncMetaDirFromDisk } from "./scrape/cache.js";
import { initScrapeNetworkStores, startScrapeNetworkRuntime } from "./scrape/network/init.js";
import { releaseFlareSession, recycleFlareSessions } from "./scrape/network/flaresolverr.js";
import { stopFlareMonitor } from "./scrape/network/flareMonitor.js";

const PORT = parseInt(process.env.PORT ?? "9210", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

const app = createApp();
const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: "/api/events" });

wss.on("connection", (ws, req) => {
  const url = req.url ?? "";
  if (!url.startsWith("/api/events")) {
    ws.close();
    return;
  }
  ws.send(JSON.stringify({ ok: true, type: "connected", ts: new Date().toISOString() }));
});

onJobEvent((event) => {
  const payload = JSON.stringify({ ok: true, type: "job_event", event });
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(payload);
  }
});

onJobUpdate((job) => {
  const payload = JSON.stringify({ ok: true, type: "job_update", job });
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(payload);
  }
});

onFileChange((change) => {
  const payload = JSON.stringify({ ok: true, type: "file_change", change });
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(payload);
  }
});

onIndexAllUpdate((index) => {
  const payload = JSON.stringify({ ok: true, type: "index_update", index });
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(payload);
  }
});

openDatabase();
const syncedMeta = syncMetaDirFromDisk();
if (syncedMeta > 0) {
  console.log(`[mdcs] 已从 data/meta 同步 ${syncedMeta} 条刮削缓存`);
}
startScrapeNetworkRuntime();
loadScrapeConfig(true);
loadOpsConfig(true);
startMonitorService();
startEmbyActorScheduler();

server.listen(PORT, HOST, () => {
  console.log(`[mdcs] 服务已启动 http://${HOST}:${PORT}`);
  console.log(`[mdcs] 项目根目录 ${PROJECT_ROOT}`);
  console.log(`[mdcs] 健康检查 GET /health`);
  console.log(`[mdcs] 七区配置 GET /api/kinds`);
});

process.on("SIGINT", () => {
  void (async () => {
    try {
      stopFlareMonitor();
      await releaseFlareSession("SIGINT");
      await recycleFlareSessions({ keepOwned: false });
    } catch {
      /* ignore */
    }
    server.close(() => process.exit(0));
  })();
});

process.on("SIGTERM", () => {
  void (async () => {
    try {
      stopFlareMonitor();
      await releaseFlareSession("SIGTERM");
      await recycleFlareSessions({ keepOwned: false });
    } catch {
      /* ignore */
    }
    server.close(() => process.exit(0));
  })();
});
