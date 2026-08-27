import fs from "node:fs";
import {
  CONFIG_DIR,
  ensureDir,
  pathExists,
  SCRAPE_CONFIG_PATH,
} from "../paths.js";
import type { KindId } from "../types.js";
import type { FieldPriority, KindScrapeProfile, ScrapeConfig } from "../scrape/types.js";
import { applyProxy } from "../scrape/network/proxy.js";
import { applyFlareSolverr } from "../scrape/network/flaresolverr.js";
import { createDefaultKindScrapeProfile, createDefaultScrapeConfig, normalizeScrapeConfig } from "./schema.js";

let cached: ScrapeConfig | null = null;

function syncNetworkFromConfig(config: ScrapeConfig) {
  applyProxy(config.proxyUrl || process.env.PROXY_URL || "");
  applyFlareSolverr(config.flareSolverrUrl || process.env.FLARESOLVERR_URL || "");
}

export function loadScrapeConfig(force = false): ScrapeConfig {
  if (cached && !force) return cached;
  ensureDir(CONFIG_DIR);
  if (!pathExists(SCRAPE_CONFIG_PATH)) {
    cached = createDefaultScrapeConfig();
    syncNetworkFromConfig(cached);
    return cached;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(SCRAPE_CONFIG_PATH, "utf8"));
  } catch (err) {
    throw new Error(
      `配置文件解析失败: scrape.json 不是有效 JSON（${err instanceof Error ? err.message : String(err)}）`,
    );
  }
  cached = normalizeScrapeConfig(raw);
  syncNetworkFromConfig(cached);
  return cached;
}

export function saveScrapeConfig(config: ScrapeConfig): void {
  ensureDir(CONFIG_DIR);
  const normalized = normalizeScrapeConfig(config);
  fs.writeFileSync(SCRAPE_CONFIG_PATH, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  cached = normalized;
  syncNetworkFromConfig(normalized);
}

export function getKindScrapeProfile(kind: KindId): KindScrapeProfile {
  const cfg = loadScrapeConfig();
  return cfg.kindProfiles[kind] ?? createDefaultKindScrapeProfile();
}

/**
 * 分区生效的命名+源链视图：
 * - naming 全局 → scrape.naming；专属 → kindProfiles 模板
 * - sources 全局 → 仍用本分区 kindProfiles 源链（源链无「全站一份」），字段优先级用全局；
 *   专属时可用 profile.fieldPriority
 */
export function resolveEffectiveKindProfile(
  kind: KindId,
  cfg = loadScrapeConfig(),
): KindScrapeProfile {
  const stored = cfg.kindProfiles[kind] ?? createDefaultKindScrapeProfile();
  const ug = stored.useGlobal ?? {};
  const naming =
    ug.naming === false
      ? {
          directoryTemplate: stored.directoryTemplate,
          fileNameTemplate: stored.fileNameTemplate,
          nameSuffixTemplate: stored.nameSuffixTemplate,
        }
      : {
          directoryTemplate: cfg.naming.directoryTemplate,
          fileNameTemplate: cfg.naming.fileNameTemplate,
          nameSuffixTemplate: cfg.naming.nameSuffixTemplate,
        };

  return {
    ...stored,
    ...naming,
    // 裁剪按分区 kindProfiles，不跟命名「使用全局」走
    posterCrop: stored.posterCrop || cfg.naming.posterCrop || "right",
    fieldPriority: ug.sources === false ? stored.fieldPriority : undefined,
  };
}

export function getFieldPriorityForKind(kind: KindId): FieldPriority {
  const cfg = loadScrapeConfig();
  const profile = getKindScrapeProfile(kind);
  if (profile.useGlobal?.sources !== false) return cfg.fieldPriority;
  return profile.fieldPriority ?? cfg.fieldPriority;
}

/** 分区生效的下载/水印/元数据/NFO（全局 ∪ 专属覆盖；任务级 JobOptions 仍由调用方再盖） */
export function resolveKindScrapePrefs(kind: KindId, cfg = loadScrapeConfig()) {
  const profile = resolveEffectiveKindProfile(kind, cfg);
  const stored = cfg.kindProfiles[kind] ?? createDefaultKindScrapeProfile();
  const ug = stored.useGlobal ?? {};

  const downloadRaw =
    ug.download === false && stored.download
      ? { ...cfg.download, ...stored.download }
      : { ...cfg.download };
  // 分区覆盖若改了 amazonHdPoster，同步 skipAmazon 给引擎
  const download =
    typeof downloadRaw.amazonHdPoster === "boolean"
      ? { ...downloadRaw, skipAmazon: !downloadRaw.amazonHdPoster }
      : downloadRaw;

  const watermark =
    ug.watermark === false && stored.watermark
      ? {
          ...cfg.watermark,
          ...stored.watermark,
          position: (stored.watermark.position ??
            cfg.watermark.position) as ScrapeConfig["watermark"]["position"],
        }
      : { ...cfg.watermark };

  const metadata =
    ug.metadata === false && stored.metadata
      ? { ...cfg.metadata, ...stored.metadata }
      : { ...cfg.metadata };

  const nfoMergeStrategy =
    ug.nfo === false && stored.nfoMergeStrategy
      ? stored.nfoMergeStrategy
      : cfg.nfoMergeStrategy;

  const nfo =
    ug.nfo === false && stored.nfoMergeStrategy
      ? { ...cfg.nfo, mergeStrategy: stored.nfoMergeStrategy }
      : { ...cfg.nfo, mergeStrategy: nfoMergeStrategy };

  return { download, watermark, metadata, nfoMergeStrategy, nfo, profile, naming: cfg.naming };
}

export function getNetworkConfig() {
  const cfg = loadScrapeConfig();
  return {
    proxyUrl: cfg.proxyUrl || process.env.PROXY_URL || "",
    flareSolverrUrl: cfg.flareSolverrUrl || process.env.FLARESOLVERR_URL || "",
    requestTimeoutSec: cfg.requestTimeoutSec || 30,
  };
}
