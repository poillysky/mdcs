/**
 * FlareSolverr 轻量监控（对齐色花 flareMonitor 核心）：
 * - 定时 list sessions，清孤儿 Chrome（keepOwned）
 * - 会话数超阈值时软回收
 * - 不做 docker restart（无权限时靠 recycle 即可）
 */
import {
  getFlareSolverrUrl,
  getFlareTrafficStats,
  getSharedSessionId,
  listFlareSessions,
  recycleFlareSessions,
} from "./flaresolverr.js";

type MonitorConfig = {
  intervalMs: number;
  maxSessionsWarn: number;
  maxSessionsCritical: number;
  autoEnabled: boolean;
};

function envNum(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function readConfig(): MonitorConfig {
  const autoRaw = String(process.env.FLARESOLVERR_AUTO_MANAGE || "1").trim();
  return {
    intervalMs: envNum("FLARESOLVERR_MONITOR_INTERVAL_MS", 30_000),
    maxSessionsWarn: envNum("FLARESOLVERR_MAX_SESSIONS_WARN", 1),
    maxSessionsCritical: envNum("FLARESOLVERR_MAX_SESSIONS_CRITICAL", 2),
    autoEnabled: !(autoRaw === "0" || /^false|off|no$/i.test(autoRaw)),
  };
}

let timer: ReturnType<typeof setInterval> | null = null;
let ticking = false;

async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    const cfg = readConfig();
    if (!cfg.autoEnabled) return;
    const flare = getFlareSolverrUrl();
    if (!flare) return;

    let remote: string[] = [];
    try {
      remote = await listFlareSessions();
    } catch (e) {
      console.warn(
        "[scrape] flare-monitor list failed:",
        e instanceof Error ? e.message : e,
      );
      return;
    }

    const owned = getSharedSessionId();
    const orphans = remote.filter((id) => !owned || id !== owned);
    const traffic = getFlareTrafficStats();

    if (orphans.length > 0) {
      console.log(
        `[scrape] flare-monitor orphans=${orphans.length} total=${remote.length} owned=${owned ? owned.slice(0, 8) : "-"} → recycle keepOwned`,
      );
      await recycleFlareSessions({ keepOwned: true });
      return;
    }

    if (remote.length >= cfg.maxSessionsCritical) {
      console.log(
        `[scrape] flare-monitor critical sessions=${remote.length} → recycle keepOwned=false`,
      );
      await recycleFlareSessions({ keepOwned: false });
      return;
    }

    if (remote.length > cfg.maxSessionsWarn) {
      console.log(
        `[scrape] flare-monitor warn sessions=${remote.length} → recycle keepOwned`,
      );
      await recycleFlareSessions({ keepOwned: true });
      return;
    }

    if (traffic.sample >= 5 && traffic.errorRate >= 0.55) {
      console.log(
        `[scrape] flare-monitor high errorRate=${traffic.errorRate.toFixed(2)} sample=${traffic.sample} → recycle keepOwned`,
      );
      await recycleFlareSessions({ keepOwned: true });
    }
  } catch (e) {
    console.warn(
      "[scrape] flare-monitor tick failed:",
      e instanceof Error ? e.message : e,
    );
  } finally {
    ticking = false;
  }
}

export function startFlareMonitor(): void {
  if (timer) return;
  const cfg = readConfig();
  console.log(
    `[scrape] flare-monitor started interval=${cfg.intervalMs}ms auto=${cfg.autoEnabled ? "on" : "off"}`,
  );
  setTimeout(() => void tick(), 8_000);
  timer = setInterval(() => void tick(), cfg.intervalMs);
}

export function stopFlareMonitor(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
