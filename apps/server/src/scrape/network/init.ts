/**
 * 启动时注入色花网络层磁盘路径 + 同步 Flare/代理配置。
 */
import path from "node:path";
import { ensureDir, META_DIR } from "../../paths.js";
import { getNetworkConfig } from "../../config/loadScrape.js";
import { setAiravMirrorStorePath } from "./airavMirror.js";
import { setIqqtvMirrorStorePath } from "./iqqtvMirror.js";
import { setSiteMirrorStorePath } from "./siteMirror.js";
import { applyFlareSolverr, installFlareExitHook, setClearanceStorePath } from "./flaresolverr.js";
import { startFlareMonitor } from "./flareMonitor.js";
import { applyProxy } from "./proxy.js";

let inited = false;

export function initScrapeNetworkStores(): void {
  if (inited) return;
  ensureDir(META_DIR);
  setSiteMirrorStorePath(path.join(META_DIR, "site-mirrors.json"));
  setAiravMirrorStorePath(path.join(META_DIR, "airav-mirror.json"));
  setIqqtvMirrorStorePath(path.join(META_DIR, "iqqtv-mirror.json"));
  setClearanceStorePath(path.join(META_DIR, "cf-clearance.json"));
  installFlareExitHook();
  inited = true;
  syncScrapeNetworkFromConfig();
}

/** 长驻进程：启动定时清孤儿（脚本/单测不要调，避免后台 interval） */
export function startScrapeNetworkRuntime(): void {
  initScrapeNetworkStores();
  startFlareMonitor();
}

export function syncScrapeNetworkFromConfig(): void {
  const cfg = getNetworkConfig();
  applyProxy(cfg.proxyUrl);
  applyFlareSolverr(cfg.flareSolverrUrl);
}
