import { FILE_STATUS_LABELS } from "../../lib/labels";
import { isFilePipelineProcessing, isFilePipelineWaiting } from "../../lib/filePipelineStatus";
import { normalizeRelativePath } from "../../lib/paths";
import type { FileRow, IndexFile, KindRow } from "../../types";
import type { BrowseFileRow } from "./types";

export function formatDirMtime(ms?: number): string {
  if (!ms) return "—";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function formatFileSize(bytes?: number): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function normalizeFolderPath(path: string): string {
  return normalizeRelativePath(path);
}

export function kindIdsForFolder(kinds: KindRow[], folderRelative: string): string[] | undefined {
  const matched = kindForPath(kinds, folderRelative);
  return matched ? [matched.id] : undefined;
}

/** 当前路径落在哪个分区来源树下（可列出已索引文件） */
export function kindCoveringPath(kinds: KindRow[], folderRelative: string): KindRow | null {
  const path = normalizeFolderPath(folderRelative);
  if (!path) return null;
  return (
    kinds.find((k) => {
      const root = normalizeFolderPath(k.sourceRoot || "");
      return root && (path === root || path.startsWith(`${root}/`));
    }) ?? null
  );
}

/** 根据当前浏览路径匹配分区（精确、位于来源下、或来源位于当前路径下） */
export function kindForPath(kinds: KindRow[], folderRelative: string): KindRow | null {
  const norm = normalizeFolderPath(folderRelative);
  if (!norm) return null;
  const exact = kinds.find((k) => normalizeFolderPath(k.sourceRoot || "") === norm);
  if (exact) return exact;
  const under = kinds.find((k) => {
    const root = normalizeFolderPath(k.sourceRoot || "");
    return root && (norm === root || norm.startsWith(`${root}/`));
  });
  if (under) return under;
  return (
    kinds.find((k) => {
      const root = normalizeFolderPath(k.sourceRoot || "");
      return root && (root === norm || root.startsWith(`${norm}/`));
    }) ?? null
  );
}

/** 当前路径是否在分区来源范围内（可列出已索引文件） */
export function scrapeDisabledReason(
  file: FileRow,
  kinds: KindRow[],
  scrapeEnabled: boolean,
): string | null {
  if (!scrapeEnabled) return "在线刮削未开启，请先在数据源设置中开启";
  if (!file.code) return "无番号，无法刮削";
  const k = kinds.find((x) => x.id === file.kind);
  if (!k) return "分区未配置";
  if (!k.enabled) return "该分区未启用";
  if (!k.sourceRoot) return "该分区未绑定来源目录";
  return null;
}

/** 浏览列表状态筛选（合并后再筛，避免索引记录被 API 状态条件挡掉） */
export function filterBrowseFiles(rows: BrowseFileRow[], status: string): BrowseFileRow[] {
  if (!status) return rows;
  return rows.filter((row) => {
    if (row.kind === "local") return false;
    if (status === "processing") {
      return isFilePipelineProcessing(row.file.status, row.file);
    }
    if (status === "waiting") {
      return isFilePipelineWaiting(row.file.status);
    }
    return row.file.status === status;
  });
}

/** 合并当前目录磁盘文件与索引库记录（磁盘为准） */
export function buildBrowseFiles(treeFiles: IndexFile[], indexedFiles: FileRow[]): BrowseFileRow[] {
  const indexedByPath = new Map<string, FileRow>();
  for (const file of indexedFiles) {
    indexedByPath.set(normalizeFolderPath(file.source_path), file);
  }

  const rows: BrowseFileRow[] = [];
  const seen = new Set<string>();

  for (const entry of treeFiles) {
    const rel = normalizeFolderPath(entry.relative);
    seen.add(rel);
    const indexed = indexedByPath.get(rel);
    if (indexed) {
      rows.push({ kind: "indexed", file: indexed });
      continue;
    }
    rows.push({
      kind: "local",
      relative: rel,
      file_name: entry.name,
      file_mtime: entry.mtime,
      file_size: entry.size,
    });
  }

  for (const file of indexedFiles) {
    const rel = normalizeFolderPath(file.source_path);
    if (seen.has(rel)) continue;
    rows.push({ kind: "indexed", file });
  }

  return rows;
}

export { FILE_STATUS_LABELS };
