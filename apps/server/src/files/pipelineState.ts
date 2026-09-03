/**
 * 单文件刮削流水线（用户视角 vs 库内状态）
 *
 * 用户视角：
 *   等待中 → 处理中（刮削+整理） → 成功 | 失败
 *
 * 库内实现（处理中内部阶段）：
 *   indexed/pending → scraping → scraped → planned → organizing → done
 *
 * 终态：done | failed | skipped
 * 非终态被任务暂停/取消/异常中断时 → 回退 indexed（等待中）
 */

export const FILE_TERMINAL_STATUSES = new Set(["done", "failed", "skipped"]);

/** 库内「处理中」流水线阶段（非终态） */
export const FILE_PIPELINE_INFLIGHT_STATUSES = new Set([
  "scraping",
  "scraped",
  "planned",
  "organizing",
]);

/** UI「等待中」 */
export const FILE_WAITING_STATUSES = new Set(["indexed", "pending"]);

export function isFileTerminalStatus(status: string): boolean {
  return FILE_TERMINAL_STATUSES.has(status);
}

export function isFilePipelineInflight(status: string): boolean {
  return FILE_PIPELINE_INFLIGHT_STATUSES.has(status);
}

export function isFileWaitingStatus(status: string): boolean {
  return FILE_WAITING_STATUSES.has(status);
}

/** 刮削任务取队：等待中优先，同档按 id 升序 */
export const FILE_SCRAPE_QUEUE_ORDER_SQL = `CASE WHEN status IN ('indexed', 'pending') THEN 0 ELSE 1 END, id ASC`;

export type ScrapeQueueOrderClause = { sql: string; params: number[] };

/** 构建刮削取队 ORDER BY（支持插队优先） */
export function buildScrapeQueueOrderClause(priorityIds: number[] = []): ScrapeQueueOrderClause {
  const ids = priorityIds.filter((id) => Number.isFinite(id));
  if (!ids.length) {
    return { sql: FILE_SCRAPE_QUEUE_ORDER_SQL, params: [] };
  }
  const placeholders = ids.map(() => "?").join(",");
  return {
    sql: `CASE WHEN id IN (${placeholders}) AND status IN ('indexed', 'pending') THEN 0 WHEN status IN ('indexed', 'pending') THEN 1 ELSE 2 END, id ASC`,
    params: ids,
  };
}

/** 整理任务取队：待整理优先，同档按 id 升序 */
export const FILE_ORGANIZE_QUEUE_ORDER_SQL = `CASE WHEN status IN ('scraped', 'planned') THEN 0 ELSE 1 END, id ASC`;

export type FileWaitingRevertPatch = {
  status: "indexed";
  error: null;
  scraped_at: null;
  organized_at: null;
  target_path: null;
  job_id: string | null;
};

/** 任务未完成时，将文件回退到最初等待状态 */
export function buildWaitingRevertPatch(
  jobId: string | null,
  detachJobId: boolean,
): FileWaitingRevertPatch {
  return {
    status: "indexed",
    error: null,
    scraped_at: null,
    organized_at: null,
    target_path: null,
    job_id: detachJobId ? null : jobId,
  };
}
