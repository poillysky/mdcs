import type { FileRow } from "../types";

/**
 * 处理中：刮削+整理流水线（与服务端 listFilters / fileStats 一致）
 * scraping → scraped → planned → organizing
 */
export function isFilePipelineProcessing(
  status: string,
  file?: Pick<FileRow, "scraped_at" | "organized_at">,
): boolean {
  if (status === "scraped" || status === "planned") return true;
  if (status === "scraping") return file?.scraped_at == null;
  if (status === "organizing") return file?.organized_at == null;
  return false;
}

/** 等待中：尚未进入流水线 */
export function isFilePipelineWaiting(status: string): boolean {
  return status === "indexed" || status === "pending";
}
