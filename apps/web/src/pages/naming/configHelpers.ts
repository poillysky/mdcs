import type { ScrapeConfig } from "../../types";
import { DEFAULT_NAMING, type Naming } from "./types";

export function mergeNaming(raw: ScrapeConfig["naming"], download?: ScrapeConfig["download"]): Naming {
  return {
    ...DEFAULT_NAMING,
    ...raw,
    subtitleAddChsSuffix: Boolean(
      raw?.subtitleAddChsSuffix ?? download?.subtitleAddChsSuffix,
    ),
  };
}

export function withMergedNaming(cfg: ScrapeConfig): ScrapeConfig {
  return {
    ...cfg,
    naming: mergeNaming(cfg.naming, cfg.download),
  };
}

export function namingSnapshot(cfg: ScrapeConfig): Naming {
  return mergeNaming(cfg.naming, cfg.download);
}

/** 保存前同步 naming ↔ download.subtitleAddChsSuffix */
export function prepareConfigForSave(cfg: ScrapeConfig): ScrapeConfig {
  const naming = mergeNaming(cfg.naming, cfg.download);
  const chs = Boolean(naming.subtitleAddChsSuffix);
  return {
    ...cfg,
    naming: { ...naming, subtitleAddChsSuffix: chs },
    download: {
      ...cfg.download!,
      subtitleAddChsSuffix: chs,
    },
  };
}
