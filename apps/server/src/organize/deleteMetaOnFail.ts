import fs from "node:fs";
import path from "node:path";
import { resolveOrganizeForKind } from "../config/loadConfig.js";
import type { JobOptions } from "../jobs/options.js";
import { deleteCoverCacheFiles } from "./coverCache.js";
import { META_DIR, PROJECT_ROOT, resolveFromRoot } from "../paths.js";
import type { KindId, OrganizeConfig } from "../types.js";

/** 刮削失败清理：合并任务级 deleteMetadataOnFail 覆盖 */
export function resolveOrganizeForScrapeFail(
  kind: KindId,
  jobOptions?: JobOptions,
): OrganizeConfig {
  const org = resolveOrganizeForKind(kind);
  if (jobOptions?.useGlobal?.organize === false) {
    const v = jobOptions.organize?.deleteMetadataOnFail;
    if (typeof v === "boolean") {
      return { ...org, deleteMetadataOnFail: v };
    }
  }
  return org;
}

/** 刮削失败时清理本番号本地封面与 meta 缓存；独立元数据目录下同名子目录一并删 */
export function deleteMetadataOnScrapeFail(
  code: string,
  kind: KindId,
  org: OrganizeConfig,
): void {
  if (!org.deleteMetadataOnFail || !code) return;

  deleteCoverCacheFiles(code, kind);

  const metaJson = path.join(META_DIR, kind, `${code}.json`);
  try {
    if (fs.existsSync(metaJson)) fs.unlinkSync(metaJson);
  } catch {
    /* ignore */
  }

  const raw = (org.metadataDir || "").trim();
  if (!raw) return;
  const metaRoot = path.isAbsolute(raw) ? raw : resolveFromRoot(raw, PROJECT_ROOT);
  const candidate = path.join(metaRoot, code);
  try {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      fs.rmSync(candidate, { recursive: true, force: true });
    }
  } catch {
    /* ignore */
  }
}
