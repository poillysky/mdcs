import { onOpsConfigChange, loadOpsConfig } from "./loadOps.js";
import { runEmbyActorSync } from "./embyActorSync.js";

/** 定期自动刮削间隔（毫秒） */
export const EMBY_ACTOR_AUTO_INTERVAL_MS = 6 * 60 * 60 * 1000;

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;
let started = false;

async function tick() {
  if (running) return;
  const cfg = loadOpsConfig().actors;
  if (!cfg.autoScrapeEnabled) return;
  if (!cfg.embyUrl?.trim() || !cfg.embyApiKey?.trim()) return;
  running = true;
  try {
    console.log("[emby-actors] 定期同步开始");
    const result = await runEmbyActorSync({
      onProgress: (t) => console.log(`[emby-actors] ${t}`),
    });
    console.log(
      `[emby-actors] 定期同步结束 total=${result.total} meta=${result.updatedMeta} image=${result.updatedImage} fail=${result.failed}`,
    );
  } catch (err) {
    console.error("[emby-actors] 定期同步失败", err instanceof Error ? err.message : err);
  } finally {
    running = false;
  }
}

function rebuildTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  const cfg = loadOpsConfig().actors;
  if (!cfg.autoScrapeEnabled) return;
  timer = setInterval(() => void tick(), EMBY_ACTOR_AUTO_INTERVAL_MS);
  // 启动后稍延迟跑一轮（避免抢启动）
  setTimeout(() => void tick(), 15_000);
}

export function startEmbyActorScheduler() {
  if (started) return;
  started = true;
  rebuildTimer();
  onOpsConfigChange(() => rebuildTimer());
}
