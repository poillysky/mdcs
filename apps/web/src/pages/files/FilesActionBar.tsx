import { ArrowPathIcon, CircleStackIcon, FolderIcon, QueueListIcon } from "@heroicons/react/20/solid";
import { kindLabel } from "../../lib/labels";
import { displayRelativePath } from "../../lib/paths";
import type { IndexAllStatus, KindRow } from "../../types";
import { FILES_DEFAULT_BROWSE_PATH } from "./types";

function indexProgressLabel(status: IndexAllStatus | null): string | null {
  if (!status) return null;
  if (status.discovered > 0) {
    const kind =
      status.kindTotal > 1 && status.kindIndex > 0
        ? `分区 ${status.kindIndex}/${status.kindTotal} · `
        : "";
    return `${kind}已发现 ${status.discovered} 个文件`;
  }
  if (status.message?.trim()) return status.message.trim();
  return "全量索引进行中";
}

export function FilesActionBar({
  kind,
  inScope,
  browsePath,
  selectedCount,
  indexingAll,
  indexingSubmitting,
  indexStatus,
  scrapingAll,
  scrapeEnabled,
  indexableCount,
  loading,
  onIndexAll,
  onScrapeAll,
}: {
  kind: KindRow | null;
  inScope: boolean;
  browsePath: string;
  selectedCount: number;
  indexingAll: boolean;
  indexingSubmitting: boolean;
  indexStatus: IndexAllStatus | null;
  scrapingAll: boolean;
  scrapeEnabled: boolean;
  indexableCount: number;
  loading: boolean;
  onIndexAll: () => void;
  onScrapeAll: () => void;
}) {
  const canScrape = inScope && Boolean(kind?.sourceRoot);
  const canIndex = indexableCount > 0;
  const busy = indexingAll || scrapingAll;
  const pathLabel = browsePath ? displayRelativePath(browsePath) : "项目根";
  const indexProgress = indexProgressLabel(indexStatus);

  let hintTitle = "浏览目录";
  let hintDetail = "全量索引一次后，进入文件夹将直接读取索引库";

  if (!kind?.sourceRoot && inScope) {
    hintTitle = "分区未配置";
    hintDetail = "请先在设置中为当前分区绑定来源目录";
  } else if (inScope && kind) {
    hintTitle = kindLabel(kind.id, kind.label);
    hintDetail = pathLabel;
  }

  if (indexingAll) {
    hintDetail = indexingSubmitting
      ? "正在启动全量索引…"
      : indexProgress || "全量索引进行中，请稍候…";
  }

  const indexBtnLabel = indexingSubmitting
    ? "提交中…"
    : indexingAll
      ? "索引中…"
      : "全量索引";

  return (
    <div className={`panel files-action-bar${indexingAll ? " is-indexing" : ""}`}>
      <div className="files-action-bar-inner">
        <div className="files-action-hint" title={hintDetail}>
          <span
            className={`files-action-status${canScrape ? " is-ready" : ""}${indexingAll ? " is-pulse" : ""}`}
            aria-hidden
          />
          <FolderIcon className="files-action-hint-icon" aria-hidden />
          <div className="files-action-hint-text">
            <span className="files-action-hint-title">{hintTitle}</span>
            <span className="files-action-hint-detail">{hintDetail}</span>
          </div>
        </div>

        <div className="files-action-buttons">
          <span className="files-selected-label">
            已选中 <strong>{selectedCount}</strong> 个条目
          </span>
          <button
            type="button"
            className={`btn files-index-all-btn${indexingAll ? " is-busy" : ""}`}
            disabled={busy || !canIndex || loading}
            aria-busy={indexingAll}
            title={`扫描 ${displayRelativePath(FILES_DEFAULT_BROWSE_PATH)} 下全部分区来源并写入索引库（后台执行，仅需偶尔操作）`}
            onClick={onIndexAll}
          >
            {indexingAll ? (
              <ArrowPathIcon className="files-action-btn-icon is-spin" aria-hidden />
            ) : (
              <CircleStackIcon className="files-action-btn-icon" aria-hidden />
            )}
            {indexBtnLabel}
          </button>
          <button
            type="button"
            className="btn files-scrape-all-btn"
            disabled={busy || !canScrape || !scrapeEnabled || loading}
            title={
              !scrapeEnabled
                ? "在线刮削未开启"
                : "对当前目录范围内全部已索引文件创建刮削任务"
            }
            onClick={onScrapeAll}
          >
            <QueueListIcon className="files-action-btn-icon" aria-hidden />
            {scrapingAll ? "提交中…" : "全部刮削"}
          </button>
        </div>
      </div>
    </div>
  );
}
