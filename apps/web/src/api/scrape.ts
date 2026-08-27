import type { ProviderCatalogRow, ScrapeConfig } from "../types/index.js";
import { api } from "./client.js";

export function scrapeCode(body: {
  code: string;
  kind: string;
  force?: boolean;
  channel?: string;
}) {
  return api<{ meta: Record<string, unknown> }>("/api/scrape", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function fetchScrapeConfig() {
  return api<{ config: ScrapeConfig; providers: string[]; catalog: ProviderCatalogRow[] }>(
    "/api/scrape/config",
  );
}

export function saveScrapeConfig(config: ScrapeConfig) {
  return api<{ config: ScrapeConfig; catalog: ProviderCatalogRow[] }>("/api/scrape/config", {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

export function probeProviders(body?: {
  id?: string;
  onlyImplemented?: boolean;
  timeoutSec?: number;
  clearCooldown?: boolean;
}) {
  return api<{
    results: Array<{
      id: string;
      label: string;
      ok: boolean;
      ms: number;
      message: string;
      status?: number;
    }>;
    cooldown: string[];
  }>("/api/scrape/providers/probe", {
    method: "POST",
    body: JSON.stringify(body ?? { onlyImplemented: true }),
  });
}

export function testNetworkConnection(body: {
  target: "direct" | "proxy" | "flare";
  proxyUrl?: string;
  flareSolverrUrl?: string;
  timeoutSec?: number;
}) {
  return api<{ ok: boolean; target: string; message: string; ms: number }>(
    "/api/scrape/network/test",
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function fetchWatermarkStyles() {
  return api<{ styles: string[] }>("/api/scrape/watermark/styles");
}
