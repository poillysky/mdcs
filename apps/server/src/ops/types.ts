import { KIND_IDS, type JobMode, type KindId } from "../types.js";

export type MonitorMode = "compat" | "performance";

export type MonitorEntry = {
  id: string;
  path: string;
  kinds: KindId[];
  jobMode: JobMode;
};

export type WebhookHeader = { key: string; value: string };

export type WebhookEndpoint = {
  id: string;
  name: string;
  method: "POST" | "GET" | "PUT";
  url: string;
  events: Array<"finished" | "failed">;
  kinds: KindId[];
  headers: WebhookHeader[];
  bodyTemplate: string;
  timeoutSec: number;
  retries: number;
};

export type JobPreset = {
  id: string;
  name: string;
  kinds: string[];
  mode: JobMode;
  dryRun: boolean;
  options: Record<string, unknown>;
  updatedAt: number;
};

export type LastJobSnapshot = {
  kinds: string[];
  mode: JobMode;
  dryRun: boolean;
  options: Record<string, unknown>;
  savedAt: number;
};

export type OpsConfig = {
  monitor: {
    enabled: boolean;
    mode: MonitorMode;
    intervalSec: number;
    entries: MonitorEntry[];
  };
  webhook: {
    enabled: boolean;
    endpoints: WebhookEndpoint[];
  };
  /** 任务配置预设 */
  presets: JobPreset[];
  /** 最近一次手动任务（复用上次） */
  lastJob?: LastJobSnapshot;
  /** qBittorrent 完成钩子 */
  qb: {
    enabled: boolean;
    jobMode: JobMode;
    kinds: KindId[];
    /** 空=不限分类；命中任一即触发 */
    categories: string[];
  };
  /** 演员（本地聚合 + Emby 真同步） */
  actors: {
    source: "local" | "emby";
    embyUrl: string;
    embyApiKey: string;
    embyUserId: string;
    /** 空 = 全部媒体库 */
    libraryIds: string[];
    autoScrapeEnabled: boolean;
    /** 0 = 不限最近入库天数 */
    autoScrapeRecentDays: number;
    refreshLibraryAfterScrape: boolean;
    scrapeMetadata: boolean;
    scrapeImages: boolean;
    metadataOverwrite: "missing" | "all";
  };
};

const JOB_MODES = new Set<JobMode>([
  "scan_only",
  "scrape_only",
  "organize_only",
  "full",
  "rescan",
]);

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function toStr(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

function toNum(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function parseKinds(raw: unknown): KindId[] {
  if (!Array.isArray(raw)) return [];
  const set = new Set(KIND_IDS);
  return raw.filter((x): x is KindId => typeof x === "string" && set.has(x as KindId));
}

function parseJobMode(raw: unknown, fallback: JobMode): JobMode {
  const m = toStr(raw, fallback) as JobMode;
  return JOB_MODES.has(m) ? m : fallback;
}

export function newOpsId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createDefaultOpsConfig(): OpsConfig {
  return {
    monitor: {
      enabled: false,
      mode: "compat",
      intervalSec: 30,
      entries: [],
    },
    webhook: {
      enabled: false,
      endpoints: [],
    },
    presets: [],
    qb: {
      enabled: false,
      jobMode: "full",
      kinds: [],
      categories: [],
    },
    actors: {
      source: "local",
      embyUrl: "",
      embyApiKey: "",
      embyUserId: "",
      libraryIds: [],
      autoScrapeEnabled: false,
      autoScrapeRecentDays: 0,
      refreshLibraryAfterScrape: false,
      scrapeMetadata: true,
      scrapeImages: true,
      metadataOverwrite: "missing",
    },
  };
}

function normalizeEntry(raw: unknown): MonitorEntry | null {
  if (!isObject(raw)) return null;
  const p = toStr(raw.path, "").trim();
  if (!p) return null;
  return {
    id: toStr(raw.id, "") || newOpsId("mon"),
    path: p,
    kinds: parseKinds(raw.kinds),
    jobMode: parseJobMode(raw.jobMode, "full"),
  };
}

function normalizeEndpoint(raw: unknown): WebhookEndpoint | null {
  if (!isObject(raw)) return null;
  const url = toStr(raw.url, "").trim();
  if (!url) return null;
  const methodRaw = toStr(raw.method, "POST").toUpperCase();
  const method =
    methodRaw === "GET" || methodRaw === "PUT" || methodRaw === "POST" ? methodRaw : "POST";
  const eventsRaw = Array.isArray(raw.events) ? raw.events : ["finished"];
  const events = eventsRaw.filter(
    (e): e is "finished" | "failed" => e === "finished" || e === "failed",
  );
  const headers = Array.isArray(raw.headers)
    ? raw.headers
        .filter(isObject)
        .map((h) => ({ key: toStr(h.key, ""), value: toStr(h.value, "") }))
        .filter((h) => h.key)
    : [];
  return {
    id: toStr(raw.id, "") || newOpsId("wh"),
    name: toStr(raw.name, "New Endpoint") || "New Endpoint",
    method,
    url,
    events: events.length ? events : ["finished"],
    kinds: parseKinds(raw.kinds),
    headers,
    bodyTemplate: toStr(
      raw.bodyTemplate,
      '{\n  "event": "{{ event }}",\n  "data": { "title": "{{ title }}", "number": "{{ number }}" }\n}',
    ),
    timeoutSec: Math.min(120, Math.max(3, Math.floor(toNum(raw.timeoutSec, 10)))),
    retries: Math.min(5, Math.max(0, Math.floor(toNum(raw.retries, 1)))),
  };
}

function normalizePreset(raw: unknown): JobPreset | null {
  if (!isObject(raw)) return null;
  const name = toStr(raw.name, "").trim();
  if (!name) return null;
  const kinds = Array.isArray(raw.kinds)
    ? raw.kinds.filter((x): x is string => typeof x === "string")
    : ["*enabled"];
  return {
    id: toStr(raw.id, "") || newOpsId("preset"),
    name,
    kinds: kinds.length ? kinds : ["*enabled"],
    mode: parseJobMode(raw.mode, "full"),
    dryRun: toBool(raw.dryRun, false),
    options: isObject(raw.options) ? raw.options : {},
    updatedAt: Math.floor(toNum(raw.updatedAt, Date.now())),
  };
}

export function normalizeOpsConfig(raw: unknown): OpsConfig {
  const base = createDefaultOpsConfig();
  if (!isObject(raw)) return base;
  const mon = isObject(raw.monitor) ? raw.monitor : {};
  const wh = isObject(raw.webhook) ? raw.webhook : {};
  const qb = isObject(raw.qb) ? raw.qb : {};
  const actors = isObject(raw.actors) ? raw.actors : {};
  const mode = mon.mode === "performance" ? "performance" : "compat";
  const entries = Array.isArray(mon.entries)
    ? mon.entries.map(normalizeEntry).filter((e): e is MonitorEntry => Boolean(e))
    : [];
  const endpoints = Array.isArray(wh.endpoints)
    ? wh.endpoints.map(normalizeEndpoint).filter((e): e is WebhookEndpoint => Boolean(e))
    : [];
  const presets = Array.isArray(raw.presets)
    ? raw.presets.map(normalizePreset).filter((p): p is JobPreset => Boolean(p))
    : [];

  let lastJob: LastJobSnapshot | undefined;
  if (isObject(raw.lastJob)) {
    lastJob = {
      kinds: Array.isArray(raw.lastJob.kinds)
        ? raw.lastJob.kinds.filter((x): x is string => typeof x === "string")
        : ["*enabled"],
      mode: parseJobMode(raw.lastJob.mode, "scan_only"),
      dryRun: toBool(raw.lastJob.dryRun, false),
      options: isObject(raw.lastJob.options) ? raw.lastJob.options : {},
      savedAt: Math.floor(toNum(raw.lastJob.savedAt, Date.now())),
    };
  }

  const categories = Array.isArray(qb.categories)
    ? qb.categories.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean)
    : [];

  return {
    monitor: {
      enabled: toBool(mon.enabled, false),
      mode,
      intervalSec: Math.min(600, Math.max(10, Math.floor(toNum(mon.intervalSec, 30)))),
      entries,
    },
    webhook: {
      enabled: toBool(wh.enabled, false),
      endpoints,
    },
    presets,
    lastJob,
    qb: {
      enabled: toBool(qb.enabled, false),
      jobMode: parseJobMode(qb.jobMode, "full"),
      kinds: parseKinds(qb.kinds),
      categories,
    },
    actors: (() => {
      const libraryIds = Array.isArray(actors.libraryIds)
        ? actors.libraryIds.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean)
        : [];
      return {
        source: actors.source === "emby" ? "emby" : "local",
        embyUrl: toStr(actors.embyUrl, ""),
        embyApiKey: toStr(actors.embyApiKey, ""),
        embyUserId: toStr(actors.embyUserId, ""),
        libraryIds,
        autoScrapeEnabled: toBool(actors.autoScrapeEnabled, false),
        autoScrapeRecentDays: Math.min(
          3650,
          Math.max(0, Math.floor(toNum(actors.autoScrapeRecentDays, 0))),
        ),
        refreshLibraryAfterScrape: toBool(actors.refreshLibraryAfterScrape, false),
        scrapeMetadata: toBool(actors.scrapeMetadata, true),
        scrapeImages: toBool(actors.scrapeImages, true),
        metadataOverwrite: actors.metadataOverwrite === "all" ? "all" : "missing",
      };
    })(),
  };
}
