import type {
  KindConfig,
  KindId,
  LibrariesConfig,
  OrganizeFallback,
  OrganizeMode,
} from "../types.js";
import { KIND_IDS } from "../types.js";
import {
  DEFAULT_SERVER_WEB,
  ORGANIZE_FALLBACKS,
  ORGANIZE_MODES,
  ON_CONFLICT,
  type ServerWebConfig,
} from "./defaults.js";
import { normalizeLibrariesConfig } from "./schema.js";

export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigValidationError";
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function assertStringField(
  obj: Record<string, unknown>,
  key: string,
  label: string,
  optional = false,
): string | undefined {
  const v = obj[key];
  if (v === undefined || v === null || v === "") {
    if (optional) return undefined;
    throw new ConfigValidationError(`配置缺少必填项：${label}`);
  }
  if (typeof v !== "string") {
    throw new ConfigValidationError(`${label} 必须是字符串`);
  }
  return v;
}

function assertBool(obj: Record<string, unknown>, key: string, label: string): boolean {
  const v = obj[key];
  if (typeof v !== "boolean") {
    throw new ConfigValidationError(`${label} 必须是布尔值`);
  }
  return v;
}

function validateKindConfig(raw: unknown, kindId: KindId): KindConfig {
  if (!isRecord(raw)) {
    throw new ConfigValidationError(`分区 ${kindId} 配置格式无效`);
  }
  const enabled = assertBool(raw, "enabled", `${kindId}.enabled`);
  const label = assertStringField(raw, "label", `${kindId}.label`)!;
  const sourceRoot = typeof raw.sourceRoot === "string" ? raw.sourceRoot.trim() : "";
  const libraryRoot = typeof raw.libraryRoot === "string" ? raw.libraryRoot.trim() : "";

  const out: KindConfig = { enabled, label, sourceRoot, libraryRoot };

  if (typeof raw.useGlobalOrganize === "boolean") {
    out.useGlobalOrganize = raw.useGlobalOrganize;
  }
  if (raw.organizeMode !== undefined) {
    if (!ORGANIZE_MODES.includes(raw.organizeMode as OrganizeMode)) {
      throw new ConfigValidationError(
        `${kindId}.organizeMode 无效，可选：硬链接/软链接/原地/复制/移动`,
      );
    }
    out.organizeMode = raw.organizeMode as OrganizeMode;
  }
  if (raw.organizeFallback !== undefined) {
    if (!ORGANIZE_FALLBACKS.includes(raw.organizeFallback as OrganizeFallback)) {
      throw new ConfigValidationError(`${kindId}.organizeFallback 无效`);
    }
    out.organizeFallback = raw.organizeFallback as OrganizeFallback;
  }
  if (typeof raw.metadataDir === "string") {
    out.metadataDir = raw.metadataDir.trim();
  }
  if (typeof raw.deleteMetadataOnFail === "boolean") {
    out.deleteMetadataOnFail = raw.deleteMetadataOnFail;
  }
  return out;
}

function validateServerWeb(raw: unknown): ServerWebConfig {
  if (!isRecord(raw)) return DEFAULT_SERVER_WEB;
  const server = isRecord(raw.server) ? raw.server : {};
  const web = isRecord(raw.web) ? raw.web : {};
  const port = Number(server.port ?? DEFAULT_SERVER_WEB.server.port);
  const webPort = Number(web.port ?? DEFAULT_SERVER_WEB.web.port);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new ConfigValidationError("server.port 必须是 1–65535 之间的数字");
  }
  if (!Number.isFinite(webPort) || webPort < 1 || webPort > 65535) {
    throw new ConfigValidationError("web.port 必须是 1–65535 之间的数字");
  }
  const host =
    typeof server.host === "string" && server.host.trim()
      ? server.host.trim()
      : DEFAULT_SERVER_WEB.server.host;
  const apiOrigin =
    typeof web.apiOrigin === "string" && web.apiOrigin.trim()
      ? web.apiOrigin.trim()
      : DEFAULT_SERVER_WEB.web.apiOrigin;
  return {
    server: { port, host },
    web: { port: webPort, apiOrigin },
  };
}

/** 校验并规范化 libraries.json 结构 */
export function validateLibrariesConfig(raw: unknown): LibrariesConfig & ServerWebConfig {
  if (!isRecord(raw)) {
    throw new ConfigValidationError("libraries.json 根对象无效");
  }
  if (!isRecord(raw.organize)) {
    throw new ConfigValidationError("缺少 organize 配置块");
  }
  if (!isRecord(raw.kinds)) {
    throw new ConfigValidationError("缺少 kinds 分区配置");
  }

  const defaultMode = raw.organize.defaultMode;
  if (!ORGANIZE_MODES.includes(defaultMode as OrganizeMode)) {
    throw new ConfigValidationError("organize.defaultMode 无效");
  }
  if (!ORGANIZE_FALLBACKS.includes(raw.organize.defaultFallback as OrganizeFallback)) {
    throw new ConfigValidationError("organize.defaultFallback 无效");
  }
  if (!ON_CONFLICT.includes(raw.organize.onConflict as LibrariesConfig["organize"]["onConflict"])) {
    throw new ConfigValidationError("organize.onConflict 无效");
  }

  for (const id of KIND_IDS) {
    if (!raw.kinds[id]) {
      throw new ConfigValidationError(`缺少分区配置：${id}`);
    }
    validateKindConfig(raw.kinds[id], id);
  }

  try {
    const normalized = normalizeLibrariesConfig(raw);
    const runtime = validateServerWeb(raw);
    return { ...normalized, ...runtime };
  } catch (err) {
    if (err instanceof ConfigValidationError) throw err;
    throw new ConfigValidationError(err instanceof Error ? err.message : String(err));
  }
}
