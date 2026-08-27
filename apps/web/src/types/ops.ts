import type { JobPreset, LastJobSnapshot } from "./jobs.js";

export type MonitorEntry = {
  id: string;
  path: string;
  kinds: string[];
  jobMode: string;
};

export type WebhookEndpoint = {
  id: string;
  name: string;
  method: "POST" | "GET" | "PUT";
  url: string;
  events: Array<"finished" | "failed">;
  kinds: string[];
  headers: Array<{ key: string; value: string }>;
  bodyTemplate: string;
  timeoutSec: number;
  retries: number;
};

export type OpsConfig = {
  monitor: {
    enabled: boolean;
    mode: "compat" | "performance";
    intervalSec: number;
    entries: MonitorEntry[];
  };
  webhook: {
    enabled: boolean;
    endpoints: WebhookEndpoint[];
  };
  presets: JobPreset[];
  lastJob?: LastJobSnapshot;
  qb: {
    enabled: boolean;
    jobMode: string;
    kinds: string[];
    categories: string[];
  };
  actors: {
    source: "local" | "emby";
    embyUrl: string;
    embyApiKey: string;
    embyUserId: string;
    libraryIds: string[];
    autoScrapeEnabled: boolean;
    autoScrapeRecentDays: number;
    refreshLibraryAfterScrape: boolean;
    scrapeMetadata: boolean;
    scrapeImages: boolean;
    metadataOverwrite: "missing" | "all";
  };
};
