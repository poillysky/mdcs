import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowsRightLeftIcon,
  FolderIcon,
  MagnifyingGlassIcon,
  PlusIcon,
} from "@heroicons/react/20/solid";
import { fetchFiles, fetchIndexFolders, fetchScrapeConfig, rescrapeFile, scanKind } from "../api";
import { CreateJobModal } from "../components/CreateJobModal";
import { EmptyState } from "../components/ui/EmptyState";
import { FILE_STATUS_LABELS, kindLabel } from "../lib/labels";
import { COPY } from "../lib/messages";
import { displayRelativePath, normalizeRelativePath } from "../lib/paths";
import type { NotifyFn } from "../lib/notify";
import type { FileRow, IndexFolder, KindRow } from "../types";

type Mode = "scan" | "tree";

const FILE_PAGE_SIZE = 20;

function formatDirMtime(ms?: number): string {
  if (!ms) return "—";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function normalizeFolderPath(path: string): string {
  return normalizeRelativePath(path);
}

function kindIdsForFolder(kinds: KindRow[], folderRelative: string): string[] | undefined {
  const norm = normalizeFolderPath(folderRelative);
  const matched = kinds.find((k) => normalizeFolderPath(k.sourceRoot || "") === norm);
  return matched ? [matched.id] : undefined;
}

function scrapeDisabledReason(
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

type CreateJobContext = {
  folder?: string;
  kindIds?: string[];
};

type Props = {
  kinds: KindRow[];
  loading: boolean;
  onChanged: () => void;
  notify: NotifyFn;
};

export function FilesPage({ kinds, loading, onChanged, notify }: Props) {
  const [mode, setMode] = useState<Mode>("tree");
  const [activeKind, setActiveKind] = useState("");
  const [scanning, setScanning] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createJobContext, setCreateJobContext] = useState<CreateJobContext | null>(null);
  const [treeParent, setTreeParent] = useState("");
  const [treeFolders, setTreeFolders] = useState<IndexFolder[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeFilter, setTreeFilter] = useState("");
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [files, setFiles] = useState<FileRow[]>([]);
  const [fileTotal, setFileTotal] = useState(0);
  const [filePage, setFilePage] = useState(1);
  const [fileStatus, setFileStatus] = useState("");
  const [filesLoading, setFilesLoading] = useState(false);
  const [scrapeEnabled, setScrapeEnabled] = useState(false);
  const [scrapingId, setScrapingId] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const { config } = await fetchScrapeConfig();
        setScrapeEnabled(Boolean(config.enabled));
      } catch {
        setScrapeEnabled(false);
      }
    })();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("status");
    if (s) setFileStatus(s);
  }, []);

  useEffect(() => {
    if (!activeKind && kinds.length) setActiveKind(kinds[0].id);
  }, [kinds, activeKind]);

  const kind = kinds.find((k) => k.id === activeKind) ?? null;

  const loadFiles = useCallback(async () => {
    if (!activeKind) return;
    setFilesLoading(true);
    try {
      const data = await fetchFiles({
        kind: activeKind,
        status: fileStatus || undefined,
        page: filePage,
        pageSize: FILE_PAGE_SIZE,
      });
      setFiles(data.files);
      setFileTotal(data.total);
    } catch (e) {
      notify("error", e, "加载文件列表失败");
    } finally {
      setFilesLoading(false);
    }
  }, [activeKind, filePage, fileStatus, notify]);

  useEffect(() => {
    if (mode === "scan" && activeKind) void loadFiles();
  }, [mode, activeKind, filePage, loadFiles]);

  async function loadTree(parent: string) {
    setTreeLoading(true);
    try {
      const data = await fetchIndexFolders(parent);
      setTreeParent(data.parent);
      setTreeFolders(data.folders);
      setSelectedPaths(new Set());
    } catch (e) {
      notify("error", e, "读取目录失败");
    } finally {
      setTreeLoading(false);
    }
  }

  useEffect(() => {
    if (mode === "tree") void loadTree("");
  }, [mode]);

  async function runScan() {
    if (!kind) return;
    if (!kind.sourceRoot) {
      notify("warn", "请先在设置里绑定来源文件夹");
      return;
    }
    setScanning(true);
    try {
      await scanKind(kind.id);
      notify("ok", `「${kind.label}」扫描已完成`);
      setFilePage(1);
      onChanged();
      await loadFiles();
    } catch (e) {
      notify("error", e, "扫描失败");
    } finally {
      setScanning(false);
    }
  }

  const crumbs = treeParent ? treeParent.split("/") : [];
  const filteredFolders = useMemo(() => {
    const q = treeFilter.trim().toLowerCase();
    if (!q) return treeFolders;
    return treeFolders.filter((f) => f.name.toLowerCase().includes(q));
  }, [treeFolders, treeFilter]);

  const filePages = Math.max(1, Math.ceil(fileTotal / FILE_PAGE_SIZE));
  const selectedCount = mode === "tree" ? selectedPaths.size : 0;
  const allVisibleSelected =
    filteredFolders.length > 0 && filteredFolders.every((f) => selectedPaths.has(f.relative));

  function goCrumb(index: number) {
    if (index < 0) {
      void loadTree("");
      return;
    }
    void loadTree(crumbs.slice(0, index + 1).join("/"));
  }

  function handleKindChange(nextId: string) {
    setActiveKind(nextId);
    setFilePage(1);
  }

  function toggleMode() {
    setMode((m) => (m === "scan" ? "tree" : "scan"));
    setSelectedPaths(new Set());
  }

  function toggleFolderSelect(relative: string) {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(relative)) next.delete(relative);
      else next.add(relative);
      return next;
    });
  }

  function openCreateJob(folderRelative?: string) {
    const folder = folderRelative ? normalizeFolderPath(folderRelative) : undefined;
    const kindIds =
      folder !== undefined
        ? kindIdsForFolder(kinds, folder)
        : activeKind
          ? [activeKind]
          : undefined;
    setCreateJobContext({ folder, kindIds });
    setCreateOpen(true);
  }

  function closeCreateJob() {
    setCreateOpen(false);
    setCreateJobContext(null);
  }

  async function scrapeFileRow(file: FileRow) {
    const reason = scrapeDisabledReason(file, kinds, scrapeEnabled);
    if (reason) return;
    setScrapingId(file.id);
    try {
      const r = await rescrapeFile(file.id, true);
      notify(
        r.meta?.ok ? "ok" : "warn",
        r.meta?.ok ? "刮削完成" : r.meta?.message || "刮削未成功",
      );
      onChanged();
      await loadFiles();
    } catch (e) {
      notify("error", e, "刮削失败");
    } finally {
      setScrapingId(null);
    }
  }

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      setSelectedPaths(new Set());
      return;
    }
    setSelectedPaths(new Set(filteredFolders.map((f) => f.relative)));
  }

  return (
    <div className="files-page">
      <header className="files-page-head">
        <div className="files-page-head-top">
          <div className="files-page-head-left">
            <h1 className="files-page-title">文件管理</h1>
            <button type="button" className="files-mode-switch" onClick={toggleMode}>
              <ArrowsRightLeftIcon className="files-mode-switch-icon" aria-hidden />
              <span>{mode === "scan" ? "扫描模式" : "目录浏览"}</span>
            </button>
          </div>
        </div>
        <div className={`files-page-head-bar${mode === "scan" ? " is-actions-only" : ""}`}>
          {mode === "tree" ? (
            <div className="files-page-head-center">
              <div className="files-filter-bar">
                <MagnifyingGlassIcon className="files-filter-icon" aria-hidden />
                <input
                  className="files-filter-input"
                  placeholder="关键字过滤"
                  value={treeFilter}
                  onChange={(e) => setTreeFilter(e.target.value)}
                />
              </div>
            </div>
          ) : null}
          <div className="files-page-head-right">
            <span className="files-selected-label">
              已选中 <strong>{selectedCount}</strong> 个条目
            </span>
            <button
              type="button"
              className="btn primary files-create-btn"
              disabled={loading || (mode === "scan" && !kind?.sourceRoot)}
              onClick={() => openCreateJob()}
            >
              <PlusIcon className="files-create-btn-icon" aria-hidden />
              {COPY.createTask}
            </button>
          </div>
        </div>
      </header>

      {mode === "scan" ? (
        <>
          <div className="panel files-scan-panel">
            <div className="panel-body">
              {!kinds.length ? (
                <EmptyState title="暂无分区" description="请先在设置中配置七路径分区。" />
              ) : (
                <>
                  <div className="form-grid two">
                    <label>
                      <span>分区</span>
                      <select
                        value={activeKind}
                        onChange={(e) => handleKindChange(e.target.value)}
                        disabled={loading}
                      >
                        {kinds.map((k) => (
                          <option key={k.id} value={k.id}>
                            {kindLabel(k.id, k.label)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="files-scan-source">
                      <span>来源目录</span>
                      <div className="files-scan-source-row">
                        <input
                          readOnly
                          value={
                            kind?.sourceRoot
                              ? displayRelativePath(kind.sourceRoot)
                              : "未绑定"
                          }
                          className={kind?.sourceRoot ? "" : "input-warn"}
                        />
                        <button
                          type="button"
                          className="btn primary files-scan-btn"
                          disabled={scanning || !kind?.sourceRoot}
                          onClick={() => void runScan()}
                        >
                          {scanning ? "扫描中…" : "立即扫描"}
                        </button>
                      </div>
                    </label>
                  </div>
                  {!kind?.sourceRoot ? (
                    <p className="hint warn">{COPY.emptyTasks}</p>
                  ) : null}
                </>
              )}
            </div>
          </div>

          {activeKind ? (
            <section className="panel files-index-panel">
              <div className="panel-head">
                <h2>已索引文件</h2>
                <div className="list-toolbar">
                  <select
                    value={fileStatus}
                    onChange={(e) => {
                      setFileStatus(e.target.value);
                      setFilePage(1);
                    }}
                  >
                    <option value="">全部状态</option>
                    <option value="pending">待处理</option>
                    <option value="failed">失败</option>
                    <option value="done">完成</option>
                  </select>
                  <span className="text-muted">共 {fileTotal} 条</span>
                </div>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>番号</th>
                      <th>文件名</th>
                      <th>状态</th>
                      <th className="files-index-col-op">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filesLoading && !files.length ? (
                      <tr>
                        <td colSpan={4} className="empty">
                          加载中…
                        </td>
                      </tr>
                    ) : files.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="empty">
                          暂无索引文件，请先扫描来源目录
                        </td>
                      </tr>
                    ) : (
                      files.map((f) => {
                        const scrapeReason = scrapeDisabledReason(f, kinds, scrapeEnabled);
                        const canScrape = !scrapeReason;
                        const busy = scrapingId === f.id;
                        return (
                          <tr key={f.id}>
                            <td>{f.code ?? "—"}</td>
                            <td className="mono">{f.file_name}</td>
                            <td>{FILE_STATUS_LABELS[f.status] ?? f.status}</td>
                            <td className="files-index-col-op">
                              <button
                                type="button"
                                className="btn sm primary files-scrape-btn"
                                disabled={!canScrape || busy}
                                title={scrapeReason ?? "按该文件所属分区配置立即刮削"}
                                onClick={() => void scrapeFileRow(f)}
                              >
                                {busy ? "刮削中…" : "刮削"}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {filePages > 1 ? (
                <div className="pagination">
                  <button
                    type="button"
                    className="btn sm ghost"
                    disabled={filePage <= 1}
                    onClick={() => setFilePage((p) => Math.max(1, p - 1))}
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
                    onClick={() => setFilePage((p) => Math.min(filePages, p + 1))}
                  >
                    下一页
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      ) : (
        <>
          <div className="files-browser panel">
            <div className="folder-crumbs files-browser-crumbs">
              <button type="button" className="crumb" onClick={() => goCrumb(-1)}>
                项目根
              </button>
              {crumbs.map((part, i) => (
                <span key={`${part}-${i}`}>
                  <span className="crumb-sep">/</span>
                  <button type="button" className="crumb" onClick={() => goCrumb(i)}>
                    {part}
                  </button>
                </span>
              ))}
            </div>

            <div className="files-dir-table-wrap">
              <table className="files-dir-table">
                <thead>
                  <tr>
                    <th className="files-col-check">
                      <input
                        type="checkbox"
                        className="files-row-check"
                        checked={allVisibleSelected && filteredFolders.length > 0}
                        onChange={toggleSelectAllVisible}
                        aria-label="全选当前列表"
                      />
                    </th>
                    <th>名称</th>
                    <th className="files-col-time">修改时间</th>
                    <th className="files-col-size">文件大小</th>
                    <th className="files-col-op">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {treeParent ? (
                    <tr className="files-dir-row files-dir-row--back">
                      <td className="files-col-check" />
                      <td colSpan={4}>
                        <button
                          type="button"
                          className="files-dir-back"
                          onClick={() => goCrumb(crumbs.length - 2)}
                        >
                          返回上级
                        </button>
                      </td>
                    </tr>
                  ) : null}
                  {treeLoading ? (
                    <tr>
                      <td colSpan={5} className="files-dir-empty">读取中…</td>
                    </tr>
                  ) : null}
                  {!treeLoading && filteredFolders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="files-dir-empty">
                        {treeFilter ? "没有匹配的子目录" : "这一层没有子目录"}
                      </td>
                    </tr>
                  ) : null}
                  {!treeLoading
                    ? filteredFolders.map((f) => {
                        const selected = selectedPaths.has(f.relative);
                        return (
                          <tr
                            key={f.relative}
                            className={`files-dir-row${selected ? " is-selected" : ""}`}
                          >
                            <td className="files-col-check">
                              <input
                                type="checkbox"
                                className="files-row-check"
                                checked={selected}
                                onChange={() => toggleFolderSelect(f.relative)}
                                aria-label={`选择 ${f.name}`}
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="files-dir-name"
                                onClick={() => void loadTree(f.relative)}
                              >
                                <FolderIcon className="files-dir-folder-icon" aria-hidden />
                                <span>{f.name}</span>
                              </button>
                            </td>
                            <td className="files-col-time files-col-muted">{formatDirMtime(f.mtime)}</td>
                            <td className="files-col-size files-col-muted">—</td>
                            <td className="files-col-op">
                              <button
                                type="button"
                                className="files-dir-enter"
                                title="创建任务"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openCreateJob(f.relative);
                                }}
                              >
                                <PlusIcon aria-hidden />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <CreateJobModal
        open={createOpen}
        kinds={kinds}
        loading={loading}
        defaultMode="scan_only"
        defaultKindIds={createJobContext?.kindIds}
        contextFolder={createJobContext?.folder}
        onClose={closeCreateJob}
        onCreated={() => {
          onChanged();
          void loadFiles();
        }}
        notify={notify}
      />
    </div>
  );
}
