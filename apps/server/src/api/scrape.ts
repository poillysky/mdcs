import { Router } from "express";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { KIND_IDS } from "../types.js";
import { loadScrapeConfig, saveScrapeConfig } from "../config/loadScrape.js";
import { readScrapeCache } from "../scrape/cache.js";
import { scrapeCode } from "../scrape/orchestrator.js";
import { listLiveSiteMirrors } from "../scrape/network/siteMirror.js";
import { listProviders, listProviderCatalog } from "../scrape/providers/index.js";
import { resolveFromRoot } from "../paths.js";
import { API_CODES } from "./codes.js";
import { sendOk, sendFail } from "./respond.js";
import type { KindId } from "../types.js";
import type { ScrapeConfig } from "../scrape/types.js";

export const scrapeRouter = Router();
type CatalogRow = ReturnType<typeof listProviderCatalog>[number];

function withRuntimeMirrorUrls(config: ScrapeConfig, catalog?: CatalogRow[]) {
  const live = listLiveSiteMirrors();
  const ids = Object.keys(live);
  if (!ids.length) return { config, catalog };

  const providerSettings = { ...(config.providerSettings ?? {}) };
  for (const id of ids) {
    const baseUrl = live[id]!;
    const prev = providerSettings[id as keyof typeof providerSettings];
    providerSettings[id] = {
      baseUrl,
      cookie: prev?.cookie ?? "",
      userAgent: prev?.userAgent ?? "",
      cooldownSec: prev?.cooldownSec ?? 0,
      overrideRetry: prev?.overrideRetry ?? false,
      retry: prev?.retry ?? 0,
      proxyUrl: prev?.proxyUrl ?? "",
    };
  }

  const nextConfig: ScrapeConfig = { ...config, providerSettings };
  const nextCatalog = catalog
    ? catalog.map((row) => {
        const liveUrl = live[row.id];
        return liveUrl ? { ...row, defaultUrl: liveUrl } : row;
      })
    : catalog;

  return { config: nextConfig, catalog: nextCatalog };
}

scrapeRouter.get("/config", (_req, res) => {
  // UI 打开数据源弹窗须读到磁盘最新 providerSettings（勿只用进程内缓存）
  const config = loadScrapeConfig(true);
  const merged = withRuntimeMirrorUrls(config, listProviderCatalog(config.disabledProviders));
  sendOk(res, {
    config: merged.config,
    providers: listProviders(),
    catalog: merged.catalog,
  });
});

scrapeRouter.put("/config", (req, res) => {
  try {
    saveScrapeConfig(req.body);
    const config = loadScrapeConfig();
    const merged = withRuntimeMirrorUrls(config, listProviderCatalog(config.disabledProviders));
    sendOk(res, {
      config: merged.config,
      catalog: merged.catalog,
    });
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 400, API_CODES.config_invalid);
  }
});

scrapeRouter.post("/network/test", async (req, res) => {
  const { testNetworkConnection } = await import("../scrape/network/test.js");
  const target =
    req.body?.target === "flare"
      ? "flare"
      : req.body?.target === "proxy"
        ? "proxy"
        : "direct";
  const cfg = loadScrapeConfig();
  try {
    const result = await testNetworkConnection({
      target,
      proxyUrl: String(req.body?.proxyUrl ?? cfg.proxyUrl),
      flareSolverrUrl: String(req.body?.flareSolverrUrl ?? cfg.flareSolverrUrl),
      timeoutSec: Number(req.body?.timeoutSec ?? cfg.requestTimeoutSec),
    });
    sendOk(res, result);
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 500, API_CODES.internal_error);
  }
});

scrapeRouter.post("/providers/probe", async (req, res) => {
  try {
    const { probeAllProviders, probeProvider, getProbeCooldownIds, clearProbeCooldown } =
      await import("../scrape/probe.js");
    if (req.body?.clearCooldown) {
      clearProbeCooldown(typeof req.body?.id === "string" ? req.body.id.trim() : undefined);
    }
    const rawTimeout = Number(req.body?.timeoutSec);
    const timeoutSec =
      Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : undefined;
    const probeId = typeof req.body?.id === "string" ? req.body.id.trim() : "";
    if (probeId) {
      const result = await probeProvider(
        probeId,
        timeoutSec != null ? { timeoutSec } : {},
      );
      sendOk(res, { results: [result], cooldown: [...getProbeCooldownIds()] });
      return;
    }
    if (req.body?.clearCooldown) {
      sendOk(res, { results: [], cooldown: [...getProbeCooldownIds()] });
      return;
    }
    const results = await probeAllProviders({
      onlyImplemented: req.body?.onlyImplemented !== false,
      timeoutSec,
    });
    sendOk(res, { results, cooldown: [...getProbeCooldownIds()] });
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 500, API_CODES.internal_error);
  }
});

scrapeRouter.post("/", async (req, res) => {
  const code = String(req.body?.code ?? "").trim();
  const kind = String(req.body?.kind ?? "japan_censored") as KindId;
  const force = Boolean(req.body?.force);
  const channelRaw = String(req.body?.channel ?? "auto").trim().toLowerCase();
  const channel =
    channelRaw === "fast" || channelRaw === "slow" || channelRaw === "auto" ? channelRaw : "auto";
  const cfg = loadScrapeConfig();

  if (!cfg.enabled) {
    sendFail(res, "刮削已禁用", 400, API_CODES.scrape_disabled);
    return;
  }
  if (!code) {
    sendFail(res, "缺少 code", 400, API_CODES.missing_code);
    return;
  }
  if (!KIND_IDS.includes(kind)) {
    sendFail(res, `无效 kind: ${kind}`, 400, API_CODES.invalid_kind);
    return;
  }

  try {
    const meta = await scrapeCode(code, kind, { force, channel });
    sendOk(res, { meta });
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 500, API_CODES.internal_error);
  }
});

scrapeRouter.get("/watermark/styles", (_req, res) => {
  try {
    const root = resolveFromRoot("assets/watermarks");
    const styles: string[] = [];
    try {
      for (const name of readdirSync(root)) {
        if (name.startsWith("_") || name.startsWith(".")) continue;
        try {
          if (statSync(join(root, name)).isDirectory()) styles.push(name);
        } catch {
          /* skip */
        }
      }
    } catch {
      /* missing dir */
    }
    if (!styles.includes("default")) styles.unshift("default");
    styles.sort((a, b) => (a === "default" ? -1 : b === "default" ? 1 : a.localeCompare(b)));
    sendOk(res, { styles });
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 500, API_CODES.internal_error);
  }
});

scrapeRouter.get("/cache/:kind/:code", (req, res) => {
  const kind = req.params.kind as KindId;
  const code = req.params.code;
  if (!KIND_IDS.includes(kind)) {
    sendFail(res, "无效 kind", 400, API_CODES.invalid_kind);
    return;
  }
  const meta = readScrapeCache(code, kind);
  if (!meta) {
    sendFail(res, "无缓存", 404, API_CODES.no_cache);
    return;
  }
  sendOk(res, { meta });
});
