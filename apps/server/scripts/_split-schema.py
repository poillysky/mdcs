"""Split config/schema.ts into config/schema/ modules."""
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "src" / "config" / "schema.ts"
OUT = Path(__file__).resolve().parents[1] / "src" / "config" / "schema"
lines = SRC.read_text(encoding="utf-8").splitlines(keepends=True)
OUT.mkdir(parents=True, exist_ok=True)

# 0-indexed slices from exploration:
# helpers: isObject..parseExtList = lines 104-132 (1-based) -> 103:132
# recognition: 55-101 + uses isObject -> need helpers first
# libraries: 46-53, 102, 213-351
# naming: 364-499
# watermark: 977-1049
# scrape: rest (134-211, 353-362, 501-975) + uses naming/watermark/recognition

helpers = """import type { OrganizeCleanupConfig } from "../../types.js";

export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function toStringOr(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

export function toBooleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function toNumberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function parseStringList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  const out = value
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean);
  return out.length ? out : [...fallback];
}

export function parseExtList(value: unknown, fallback: string[]): string[] {
  const list = parseStringList(value, fallback);
  return list.map((x) => x.replace(/^\\./, "").toLowerCase());
}
"""
# Fix: don't need OrganizeCleanupConfig in helpers - remove unused import
helpers = """export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function toStringOr(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

export function toBooleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function toNumberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function parseStringList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  const out = value
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean);
  return out.length ? out : [...fallback];
}

export function parseExtList(value: unknown, fallback: string[]): string[] {
  const list = parseStringList(value, fallback);
  return list.map((x) => x.replace(/^\\./, "").toLowerCase());
}
"""
(OUT / "helpers.ts").write_text(helpers, encoding="utf-8")

# recognition: lines 55-101 (1-based) = 54:101
recog_body = "".join(lines[54:101])
for name in (
    "createDefaultRecognitionWords",
    "parseRecognitionWordList",
    "normalizeRecognitionWordsByKind",
    "normalizeRecognitionWords",
):
    recog_body = recog_body.replace(f"function {name}", f"export function {name}", 1)
recog_body = recog_body.replace(
    "const RECOGNITION_KIND_KEYS",
    "export const RECOGNITION_KIND_KEYS",
    1,
)
(OUT / "recognition.ts").write_text(
    """import type {
  RecognitionKindKey,
  RecognitionWordsByKind,
  RecognitionWordsConfig,
} from "../../scrape/types.js";
import { isObject } from "./helpers.js";

"""
    + recog_body,
    encoding="utf-8",
)

# libraries: constants 46-53, 102 + parseCleanup..normalizeLibraries 213-351
lib_consts = "".join(lines[45:53]) + "".join(lines[101:102])
lib_body = "".join(lines[212:351])
for name in (
    "parseCleanup",
    "normalizeOrganize",
    "assertLibrariesConfig",
):
    lib_body = lib_body.replace(f"function {name}", f"function {name}", 1)
# exports already have export on createDefault and normalizeLibraries
(OUT / "libraries.ts").write_text(
    """import {
  KIND_IDS,
  type KindConfig,
  type KindId,
  type LibrariesConfig,
  type OnConflict,
  type OrganizeCleanupConfig,
  type OrganizeConfig,
  type OrganizeFallback,
  type OrganizeMode,
} from "../../types.js";
import {
  DEFAULT_CRACK_KEYWORDS,
  DEFAULT_JUNK_FILTERS,
  DEFAULT_VIDEO_EXTENSIONS,
  defaultOrganizeConfig,
} from "../organizeDefaults.js";
import {
  isObject,
  parseExtList,
  parseStringList,
  toBooleanOr,
  toNumberOr,
  toStringOr,
} from "./helpers.js";

"""
    + lib_consts
    + "\n"
    + lib_body,
    encoding="utf-8",
)

# naming: 364-499
naming_body = "".join(lines[363:499])
naming_body = naming_body.replace(
    "function normalizeNamingConfig",
    "export function normalizeNamingConfig",
    1,
)
(OUT / "naming.ts").write_text(
    """import type { GlobalNamingConfig, KindScrapeProfile } from "../../scrape/types.js";
import { defaultNamingConfig } from "../../organize/namingConfig.js";
import {
  isObject,
  toBooleanOr,
  toNumberOr,
  toStringOr,
} from "./helpers.js";

"""
    + naming_body,
    encoding="utf-8",
)

# watermark: 977-1049
wm_body = "".join(lines[976:1049])
for name in ("parseCorner", "parsePos", "parseLayout"):
    wm_body = wm_body.replace(f"function {name}", f"function {name}", 1)
wm_body = wm_body.replace(
    "function normalizeWatermarkConfig",
    "export function normalizeWatermarkConfig",
    1,
)
(OUT / "watermark.ts").write_text(
    """import {
  heightRatioToScalePercent,
  scalePercentToHeightRatio,
  type GlobalWatermarkConfig,
  type WatermarkCorner,
  type WatermarkLayout,
  type WatermarkPos,
} from "../../organize/watermarkConfig.js";
import { isObject, toBooleanOr, toNumberOr, toStringOr } from "./helpers.js";

"""
    + wm_body,
    encoding="utf-8",
)

# scrape: provider helpers 134-211, createDefaultKind 353-362, kindProfileWith+createDefaultScrape+normalize* 501-975
# but exclude watermark normalize which is in watermark.ts
scrape_parts = (
    "".join(lines[133:211])
    + "".join(lines[352:362])
    + "".join(lines[500:975])
)
for name in (
    "parseSourceList",
    "parseDisabledProviders",
    "defaultProviderSiteConfig",
    "normalizeProviderSiteConfig",
    "parseProviderSettings",
    "parseFieldPriority",
    "kindProfileWith",
    "normalizeUseGlobal",
    "normalizeDownloadOverride",
    "normalizeWatermarkOverride",
    "normalizeMetadataOverride",
    "normalizeKindProfile",
    "assertScrapeConfig",
):
    scrape_parts = scrape_parts.replace(f"function {name}", f"function {name}", 1)

(OUT / "scrape.ts").write_text(
    """import { KIND_IDS, type KindId } from "../../types.js";
import type {
  FieldPriority,
  KindDownloadOverride,
  KindMetadataOverride,
  KindScrapeProfile,
  KindUseGlobal,
  KindWatermarkOverride,
  NfoMergeStrategy,
  ScrapeConfig,
  SourceId,
} from "../../scrape/types.js";
import { listCatalogIds, SOURCE_CATALOG } from "../../scrape/providers/catalog.js";
import { defaultNfoConfig, normalizeNfoConfig } from "../../organize/nfoConfig.js";
import { defaultWatermarkConfig } from "../../organize/watermarkConfig.js";
import {
  isObject,
  toBooleanOr,
  toNumberOr,
  toStringOr,
} from "./helpers.js";
import { createDefaultNamingConfig, normalizeNamingConfig } from "./naming.js";
import { createDefaultRecognitionWords, normalizeRecognitionWords } from "./recognition.js";
import { normalizeWatermarkConfig } from "./watermark.js";

"""
    + scrape_parts,
    encoding="utf-8",
)

(OUT / "index.ts").write_text(
    """export {
  createDefaultLibrariesConfig,
  normalizeLibrariesConfig,
} from "./libraries.js";
export { createDefaultNamingConfig } from "./naming.js";
export {
  createDefaultKindScrapeProfile,
  createDefaultScrapeConfig,
  normalizeScrapeConfig,
} from "./scrape.js";
""",
    encoding="utf-8",
)

SRC.write_text(
    """export {
  createDefaultLibrariesConfig,
  normalizeLibrariesConfig,
  createDefaultKindScrapeProfile,
  createDefaultNamingConfig,
  createDefaultScrapeConfig,
  normalizeScrapeConfig,
} from "./schema/index.js";
""",
    encoding="utf-8",
)
print("schema split done")
