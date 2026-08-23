import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchFiles, fetchIndexFolders, scanKind } from "../api";
import { CreateJobModal } from "../components/CreateJobModal";
import { VirtualList } from "../components/VirtualList";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { FILE_STATUS_LABELS, kindLabel } from "../lib/labels";
import { COPY } from "../lib/messages";
import type { NotifyFn } from "../lib/notify";
import type { FileRow, IndexFolder, KindRow } from "../types";

type Mode = "scan" | "tree";

const FILE_PAGE_SIZE = 20;

type Props = {
  kinds: KindRow[];
  loading: boolean;
  onChanged: () => void;
  notify: NotifyFn;
};

export function FilesPage({ kinds, loading, onChanged, notify }: Props) {
  const [mode, setMode] = useState<Mode>("scan");
  const [activeKind, setActiveKind] = useState("");
  const [scanning, setScanning] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [treeParent, setTreeParent] = useState("");
  const [treeFolders, setTreeFolders] = useState<IndexFolder[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeFilter, setTreeFilter] = useState("");
  const [files, setFiles] = useState<FileRow[]>([]);
  const [fileTotal, setFileTotal] = useState(0);
  const [filePage, setFilePage] = useState(1);
  const [fileStatus, setFileStatus] = useState("");
  const [filesLoading, setFilesLoading] = useState(false);

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

  return (
    <>
      <PageHeader title="文件管理" description="路径扫描入库与 index 只读目录浏览" />

      <div className="subnav files-mode-nav">
        <button
          type="button"
          className={`subnav-item${mode === "scan" ? " active" : ""}`}
          onClick={() => setMode("scan")}
        >
          路径扫描
        </button>
        <button
          type="button"
          className={`subnav-item${mode === "tree" ? " active" : ""}`}
          onClick={() => setMode("tree")}
        >
          目录浏览
        </button>
      </div>

      {mode === "scan" ? (
        <>
          <div className="panel">
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
                    <label>
                      <span>来源目录</span>
                      <input
                        readOnly
                        value={kind?.sourceRoot || "未绑定"}
                        className={kind?.sourceRoot ? "" : "input-warn"}
                      />
                    </label>
                  </div>
                  {!kind?.sourceRoot ? (
                    <p className="hint warn">{COPY.emptyTasks}</p>
                  ) : (
                    <p className="hint">
                      扫描将把「{kind.sourceRoot}」下的媒体文件索引入库，不会移动或修改源文件。
                    </p>
                  )}
                  <div className="toolbar">
                    <button
                      type="button"
                      className="btn primary"
                      disabled={scanning || !kind?.sourceRoot}
                      onClick={() => void runScan()}
                    >
                      {scanning ? "扫描中…" : "立即扫描"}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={!kind?.sourceRoot || loading}
                      onClick={() => setCreateOpen(true)}
                    >
                      创建扫描任务
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {activeKind ? (
            <section className="panel" style={{ marginTop: 16 }}>
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
                    </tr>
                  </thead>
                  <tbody>
                    {filesLoading && !files.length ? (
                      <tr>
                        <td colSpan={3} className="empty">
                          加载中…
                        </td>
                      </tr>
                    ) : files.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="empty">
                          暂无索引文件，请先扫描来源目录
                        </td>
                      </tr>
                    ) : (
                      files.map((f) => (
                        <tr key={f.id}>
                          <td>{f.code ?? "—"}</td>
                          <td className="mono">{f.file_name}</td>
                          <td>{FILE_STATUS_LABELS[f.status] ?? f.status}</td>
                        </tr>
                      ))
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
        <div className="panel folder-browser">
          <div className="list-toolbar" style={{ marginBottom: 12 }}>
            <input
              className="search-input"
              placeholder="过滤当前层目录名…"
              value={treeFilter}
              onChange={(e) => setTreeFilter(e.target.value)}
            />
          </div>
          <div className="folder-crumbs">
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
          <div className="folder-list readonly">
            {treeParent ? (
              <button
                type="button"
                className="folder-row"
                onClick={() => goCrumb(crumbs.length - 2)}
              >
                返回上级
              </button>
            ) : null}
            {treeLoading ? <div className="folder-empty">读取中…</div> : null}
            {!treeLoading && filteredFolders.length === 0 ? (
              <div className="folder-empty">
                {treeFilter ? "没有匹配的子目录" : "这一层没有子目录"}
              </div>
            ) : null}
            {!treeLoading
              ? (
                <VirtualList
                  items={filteredFolders}
                  rowHeight={40}
                  maxHeight={420}
                  getKey={(f) => f.relative}
                  renderRow={(f) => (
                    <button
                      type="button"
                      className="folder-row"
                      style={{ width: "100%" }}
                      onClick={() => void loadTree(f.relative)}
                    >
                      {f.name}
                    </button>
                  )}
                />
              )
              : null}
          </div>
          <p className="hint">只读浏览，index 与已绑定目录；不会在浏览时写入文件。</p>
        </div>
      )}

      <CreateJobModal
        open={createOpen}
        kinds={kinds}
        loading={loading}
        defaultMode="scan_only"
        defaultKindIds={activeKind ? [activeKind] : undefined}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          onChanged();
          void loadFiles();
        }}
        notify={notify}
      />
    </>
  );
}
