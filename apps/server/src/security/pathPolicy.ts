import path from "node:path";
import { getIndexRoot, getPathRoot, loadLibrariesConfig } from "../config/loadConfig.js";
import { resolveFromRoot } from "../paths.js";

/** 规范化相对路径：去首尾斜杠、统一正斜杠、拒绝 .. */
export function normalizeRelativePath(input: string): string {
  const rel = input.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim();
  if (!rel) return "";
  if (rel.includes("..")) {
    throw new Error("路径不在允许范围内，请选择已配置的来源或输出目录");
  }
  return rel;
}

/** 收集所有允许写入/浏览的相对路径根（pathRoot、index、各分区 source/library） */
export function listAllowedRelativeRoots(config = loadLibrariesConfig()): string[] {
  const roots = new Set<string>();
  roots.add(".");
  const indexRoot = (config.indexRoot || "index").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (indexRoot) roots.add(indexRoot);
  for (const kind of Object.values(config.kinds)) {
    const s = (kind.sourceRoot || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    const l = (kind.libraryRoot || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    if (s) roots.add(s);
    if (l) roots.add(l);
  }
  return [...roots];
}

/** 判断相对路径是否落在允许根之下（前缀匹配） */
export function isRelativePathAllowed(
  relativePath: string,
  config = loadLibrariesConfig(),
): boolean {
  const rel = normalizeRelativePath(relativePath);
  if (!rel) return true;
  const allowed = listAllowedRelativeRoots(config);
  return allowed.some((root) => {
    const r = root.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    if (!r || r === ".") return !rel.includes("..");
    return rel === r || rel.startsWith(`${r}/`);
  });
}

export function assertRelativePathAllowed(
  relativePath: string,
  config = loadLibrariesConfig(),
): string {
  const rel = normalizeRelativePath(relativePath);
  if (!isRelativePathAllowed(rel, config)) {
    throw new Error("路径不在允许范围内，请选择已配置的来源或输出目录");
  }
  return rel;
}

/** 校验分区 sourceRoot / libraryRoot 字段 */
export function assertKindPathField(field: "sourceRoot" | "libraryRoot", value: string): string {
  const rel = normalizeRelativePath(value);
  if (!rel) return "";
  if (!isRelativePathAllowed(rel)) {
    const label = field === "sourceRoot" ? "来源目录" : "输出目录";
    throw new Error(`${label}不在允许范围内，请选择已配置目录`);
  }
  return rel;
}

/** 绝对路径是否落在项目 pathRoot 内 */
export function isAbsUnderPathRoot(absPath: string, config = loadLibrariesConfig()): boolean {
  const root = getPathRoot(config);
  const resolved = path.resolve(absPath);
  const rel = path.relative(root, resolved);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export function getAllowedAbsRoots(config = loadLibrariesConfig()): string[] {
  const root = getPathRoot(config);
  const out = new Set<string>([root, getIndexRoot(config)]);
  for (const kind of Object.values(config.kinds)) {
    if (kind.sourceRoot) out.add(resolveFromRoot(kind.sourceRoot, root));
    if (kind.libraryRoot) out.add(resolveFromRoot(kind.libraryRoot, root));
  }
  return [...out];
}
