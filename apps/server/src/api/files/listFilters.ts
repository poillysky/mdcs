/**
 * 文件流水线 UI 分桶（任务 fileStats、刮削记录筛选共用）
 *
 * 处理中 = 已进入刮削+整理流水线（scraping → scraped → planned → organizing）
 * 等待中 = 尚未进入流水线（仅 indexed / pending）
 */

import { FILE_ACTIVITY_TS } from "../fileListMap.js";

/** 处理中：刮削+整理全流程 */
export const FILE_PIPELINE_PROCESSING_WHERE = `(
  (f.status = 'scraping' AND f.scraped_at IS NULL)
  OR f.status = 'scraped'
  OR f.status = 'planned'
  OR (f.status = 'organizing' AND f.organized_at IS NULL)
)`;

/** 等待中：排队进流水线 */
export const FILE_PIPELINE_WAITING_WHERE = `(f.status IN ('indexed', 'pending'))`;

/** @deprecated 使用 FILE_PIPELINE_PROCESSING_WHERE */
export const FILE_SCRAPING_ACTIVE_WHERE = FILE_PIPELINE_PROCESSING_WHERE;

export const FILE_PIPELINE_PROCESSING_COUNT_SQL = `SUM(CASE
  WHEN status = 'scraping' AND scraped_at IS NULL THEN 1
  WHEN status = 'scraped' THEN 1
  WHEN status = 'planned' THEN 1
  WHEN status = 'organizing' AND organized_at IS NULL THEN 1
  ELSE 0
END)`;

export const FILE_PIPELINE_WAITING_COUNT_SQL = `SUM(CASE WHEN status IN ('indexed', 'pending') THEN 1 ELSE 0 END)`;

/** @deprecated 使用 FILE_PIPELINE_PROCESSING_COUNT_SQL */
export const FILE_SCRAPING_ACTIVE_COUNT_SQL = FILE_PIPELINE_PROCESSING_COUNT_SQL;

/** 文件列表 status 筛选 SQL 片段（须整体作为 AND 子句加入 WHERE） */
export function appendFileListStatusFilter(
  status: string | undefined,
  where: string[],
  params: (string | number)[],
): void {
  if (status === "processing") {
    where.push(FILE_PIPELINE_PROCESSING_WHERE);
    return;
  }
  if (status === "waiting" || status === "pending") {
    where.push(FILE_PIPELINE_WAITING_WHERE);
    return;
  }
  if (status) {
    where.push("f.status = ?");
    params.push(status);
  }
}

/** 默认列表是否排除 indexed（等待扫描入库的占位行） */
export function shouldExcludeIndexed(
  excludeIndexed: boolean,
  status: string | undefined,
  jobId: string,
): boolean {
  if (!excludeIndexed || jobId) return false;
  if (!status || status === "indexed" || status === "waiting" || status === "processing") {
    return false;
  }
  return true;
}

/** 文件列表排序（刮削记录默认按索引 id 升序） */
export function resolveFileListOrderBy(sort?: string): string {
  const key = String(sort ?? "").trim().toLowerCase();
  if (key === "id" || key === "id_asc" || key === "index") {
    return `f.id ASC`;
  }
  if (key === "code" || key === "code_asc") {
    return `(f.code IS NULL OR f.code = ''), f.code COLLATE NOCASE ASC, f.id ASC`;
  }
  return `${FILE_ACTIVITY_TS} DESC, f.id DESC`;
}
