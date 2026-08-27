import fs from "node:fs";
import { CONFIG_DIR, ensureDir, OPS_CONFIG_PATH, pathExists } from "../paths.js";
import {
  createDefaultOpsConfig,
  normalizeOpsConfig,
  type OpsConfig,
} from "./types.js";

let cached: OpsConfig | null = null;
const listeners = new Set<(cfg: OpsConfig) => void>();

export function onOpsConfigChange(listener: (cfg: OpsConfig) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(cfg: OpsConfig) {
  for (const fn of listeners) {
    try {
      fn(cfg);
    } catch {
      /* ignore */
    }
  }
}

export function loadOpsConfig(force = false): OpsConfig {
  if (cached && !force) return cached;
  ensureDir(CONFIG_DIR);
  if (!pathExists(OPS_CONFIG_PATH)) {
    cached = createDefaultOpsConfig();
    return cached;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(OPS_CONFIG_PATH, "utf8"));
  } catch (err) {
    throw new Error(
      `配置文件解析失败: ops.json 不是有效 JSON（${err instanceof Error ? err.message : String(err)}）`,
    );
  }
  cached = normalizeOpsConfig(raw);
  return cached;
}

export function saveOpsConfig(config: OpsConfig): OpsConfig {
  ensureDir(CONFIG_DIR);
  const normalized = normalizeOpsConfig(config);
  fs.writeFileSync(OPS_CONFIG_PATH, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  cached = normalized;
  notify(normalized);
  return normalized;
}
