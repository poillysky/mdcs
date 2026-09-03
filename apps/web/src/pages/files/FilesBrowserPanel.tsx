import { DocumentIcon, FolderIcon, PlusIcon } from "@heroicons/react/20/solid";
import { TableSkeleton } from "../../components/ui/TableSkeleton";
import { COPY } from "../../lib/messages";
import type { BrowseFileRow } from "./types";
import type { FileRow, IndexFile, IndexFolder, KindRow } from "../../types";
import { recordTableStatusLabel } from "../records/recordsDisplay";
import {
  formatDirMtime,
  formatFileSize,
  scrapeDisabledReason,
} from "./filesDisplay";

export function FilesBrowserPanel({
  crumbs,
  treeLoading,
  filteredFolders,
  selectedPaths,
  allVisibleSelected,
  kinds,
  browseFiles,
  pagedBrowseFiles,
  treeFiles,
  filePage,
  filePages,
  fileStatus,
  filesLoading,
  scrapeEnabled,
  scrapingId,
  inScope,
  browsePath,
  onGoCrumb,
  onNavigate,
  onToggleSelect,
  onToggleSelectAll,
  onCreateJob,
  onFileStatus,
  onFilePage,
  onScrape,
  onOpenDetail,
}: {
  crumbs: string[];
  treeLoading: boolean;
  filteredFolders: IndexFolder[];
  selectedPaths: Set<string>;
  allVisibleSelected: boolean;
  kinds: KindRow[];
  browseFiles: BrowseFileRow[];
  pagedBrowseFiles: BrowseFileRow[];
  treeFiles: IndexFile[];
  filePage: number;
  filePages: number;
  fileStatus: string;
  filesLoading: boolean;
  scrapeEnabled: boolean;
  scrapingId: number | null;
  inScope: boolean;
  browsePath: string;
  onGoCrumb: (index: number) => void;
  onNavigate: (relative: string) => void;
  onToggleSelect: (relative: string) => void;
  onToggleSelectAll: () => void;
  onCreateJob: (relative: string) => void;
  onFileStatus: (status: string) => void;
  onFilePage: (updater: number | ((p: number) => number)) => void;
  onScrape: (file: FileRow) => void;
  onOpenDetail: (id: number) => void;
}) {
  const showFolderEmpty = !treeLoading && filteredFolders.length === 0 && !inScope;
  const directCount = browseFiles.length;
  const showFileEmpty =
    inScope &&
    !filesLoading &&
    directCount === 0 &&
    !treeLoading &&
    filteredFolders.length === 0;

  const fileCountLabel = inScope
    ? directCount > 0
      ? `本层 ${directCount} 条`
      : "本层 0 条"
    : "未在分区来源内";

  return (
    <section className="panel files-browser">
      <div className="panel-head files-browser-head">
        <div className="folder-crumbs files-browser-crumbs">
          <button type="button" className="crumb" onClick={() => onGoCrumb(-1)}>
            项目根
          </button>
          {crumbs.map((part, i) => (
            <span key={`${part}-${i}`}>
              <span className="crumb-sep">/</span>
              <button type="button" className="crumb" onClick={() => onGoCrumb(i)}>
                {part}
              </button>
            </span>
          ))}
        </div>
        <div className="list-toolbar files-browser-toolbar">
          <select value={fileStatus} onChange={(e) => onFileStatus(e.target.value)} disabled={!inScope}>
            <option value="">全部状态</option>
            <option value="indexed">已索引（待刮削）</option>
            <option value="pending">排队刮削</option>
            <option value="failed">失败</option>
            <option value="done">完成</option>
          </select>
          <span className="text-muted">{fileCountLabel}</span>
        </div>
      </div>

      <div className="files-dir-table-wrap">
        <table className="files-dir-table files-unified-table">
          <colgroup>
            <col className="files-col-check" />
            <col className="files-col-name" />
            <col className="files-col-code" />
            <col className="files-col-time" />
            <col className="files-col-size" />
            <col className="files-col-status" />
            <col className="files-col-op" />
          </colgroup>
          <thead>
            <tr>
              <th className="files-col-check">
                <input
                  type="checkbox"
                  className="files-row-check"
                  checked={allVisibleSelected && filteredFolders.length > 0}
                  onChange={onToggleSelectAll}
                  aria-label="全选当前文件夹"
                />
              </th>
              <th className="files-col-name">名称</th>
              <th className="files-col-code">番号</th>
              <th className="files-col-time">修改时间</th>
              <th className="files-col-size">大小</th>
              <th className="files-col-status">状态</th>
              <th className="files-col-op">操作</th>
            </tr>
          </thead>
          <tbody>
            {treeLoading ? (
              <tr>
                <td colSpan={7} className="files-dir-empty">
                  读取中…
                </td>
              </tr>
            ) : null}

            {!treeLoading && showFolderEmpty ? (
              <tr>
                <td colSpan={7} className="files-dir-empty">
                  这一层没有子目录
                </td>
              </tr>
            ) : null}

            {!treeLoading
              ? filteredFolders.map((f) => {
                  const selected = selectedPaths.has(f.relative);
                  return (
                    <tr
                      key={`dir:${f.relative}`}
                      className={`files-dir-row files-row-folder${selected ? " is-selected" : ""}`}
                    >
                      <td className="files-col-check">
                        <input
                          type="checkbox"
                          className="files-row-check"
                          checked={selected}
                          onChange={() => onToggleSelect(f.relative)}
                          aria-label={`选择 ${f.name}`}
                        />
                      </td>
                      <td className="files-col-name">
                        <button
                          type="button"
                          className="files-dir-name"
                          onClick={() => onNavigate(f.relative)}
                        >
                          <FolderIcon className="files-dir-folder-icon" aria-hidden />
                          <span>{f.name}</span>
                        </button>
                      </td>
                      <td className="files-col-code files-col-muted">—</td>
                      <td className="files-col-time files-col-muted">{formatDirMtime(f.mtime)}</td>
                      <td className="files-col-size files-col-muted">—</td>
                      <td className="files-col-status files-col-muted">文件夹</td>
                      <td className="files-col-op">
                        <button
                          type="button"
                          className="btn sm files-row-action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCreateJob(f.relative);
                          }}
                        >
                          <PlusIcon className="files-row-action-btn-icon" aria-hidden />
                          <span>{COPY.createTask}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              : null}

            {inScope && filesLoading && browseFiles.length === 0 && treeFiles.length === 0 ? (
              <TableSkeleton colCount={7} rowCount={3} />
            ) : null}

            {showFileEmpty ? (
              <tr className="files-hint-row">
                <td colSpan={7} className="files-dir-empty">
                  本层暂无视频文件
                </td>
              </tr>
            ) : null}

            {inScope && !filesLoading
              ? pagedBrowseFiles.map((row) => {
                  if (row.kind === "indexed") {
                    const f = row.file;
                    const scrapeReason = scrapeDisabledReason(f, kinds, scrapeEnabled);
                    const canScrape = !scrapeReason;
                    const busy = scrapingId === f.id;
                    return (
                      <tr key={`file:${f.id}`} className="files-dir-row files-row-file">
                        <td className="files-col-check" />
                        <td className="files-col-name">
                          <button
                            type="button"
                            className="files-dir-name files-file-name"
                            title="查看刮削详情"
                            onClick={() => onOpenDetail(f.id)}
                          >
                            <DocumentIcon className="files-file-icon" aria-hidden />
                            <span className="mono">{f.file_name}</span>
                          </button>
                        </td>
                        <td className="files-col-code">{f.code ?? "—"}</td>
                        <td className="files-col-time files-col-muted">
                          {formatDirMtime(f.file_mtime)}
                        </td>
                        <td className="files-col-size files-col-muted">{formatFileSize(f.file_size)}</td>
                        <td className="files-col-status">{recordTableStatusLabel(f.status, f)}</td>
                        <td className="files-col-op">
                          <button
                            type="button"
                            className="btn sm files-row-action-btn"
                            disabled={!canScrape || busy}
                            title={scrapeReason ?? "按该文件所属分区配置立即刮削"}
                            onClick={() => onScrape(f)}
                          >
                            {busy ? "刮削中…" : "刮削"}
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={`local:${row.relative}`} className="files-dir-row files-row-file files-row-local">
                      <td className="files-col-check" />
                      <td className="files-col-name">
                        <span className="files-dir-name files-file-name files-file-name-static">
                          <DocumentIcon className="files-file-icon" aria-hidden />
                          <span className="mono">{row.file_name}</span>
                        </span>
                      </td>
                      <td className="files-col-code files-col-muted">—</td>
                      <td className="files-col-time files-col-muted">
                        {formatDirMtime(row.file_mtime)}
                      </td>
                      <td className="files-col-size files-col-muted">{formatFileSize(row.file_size)}</td>
                      <td className="files-col-status files-col-muted">未索引</td>
                      <td className="files-col-op files-col-muted">—</td>
                    </tr>
                  );
                })
              : null}
          </tbody>
        </table>
      </div>

      {inScope && filePages > 1 ? (
        <div className="pagination files-browser-pagination">
          <button
            type="button"
            className="btn sm ghost"
            disabled={filePage <= 1}
            onClick={() => onFilePage((p) => Math.max(1, p - 1))}
          >
            上一页
          </button>
          <span className="text-muted">
            第 {filePage} / {filePages} 页
          </span>
          <button
            type="button"
            className="btn sm ghost"
            disabled={filePage >= filePages}
            onClick={() => onFilePage((p) => Math.min(filePages, p + 1))}
          >
            下一页
          </button>
        </div>
      ) : null}
    </section>
  );
}
