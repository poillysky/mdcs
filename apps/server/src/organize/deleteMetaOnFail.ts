import fs from "node:fs";
import path from "node:path";
import { COVERS_DIR, META_DIR, PROJECT_ROOT, resolveFromRoot } from "../paths.js";
import type { KindId, OrganizeConfig } from "../types.js";

/** 刮削失败时清理本番号本地封面与 meta 缓存；独立元数据目录下同名子目录一并删 */
export function deleteMetadataOnScrapeFail(
  code: string,
  kind: KindId,
  org: OrganizeConfig,
): void {
  if (!org.deleteMetadataOnFail || !code) return;

  const coverDir = path.join(COVERS_DIR, kind);
  if (fs.existsSync(coverDir)) {
    for (const ext of ["jpg", "jpeg", "png", "webp"]) {
      const p = path.join(coverDir, `${code}.${ext}`);
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
  }

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
