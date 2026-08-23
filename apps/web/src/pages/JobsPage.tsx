import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { CreateJobModal } from "../components/CreateJobModal";
import { COPY } from "../lib/messages";
import { useJobEvents } from "../hooks/useJobEvents";
import { cancelJob, fetchJobs, pauseJob, resumeJob, type JobRow, type KindRow } from "../api";
import { StatusBadge } from "../components/StatusBadge";
import { JOB_MODE_LABELS, JOB_STATUS_LABELS, kindLabel } from "../lib/labels";
import type { NotifyFn } from "../lib/notify";

const STATUS_OPTIONS = [
  { value: "", label: "全部状态" },
  { value: "running", label: "运行中" },
  { value: "queued", label: "排队中" },
  { value: "paused", label: "已暂停" },
  { value: "done", label: "已完成" },
  { value: "failed", label: "失败" },
  { value: "cancelled", label: "已取消" },
];

const MODE_OPTIONS = [
  { value: "", label: "全部模式" },
  { value: "scan_only", label: "仅扫描" },
  { value: "scrape_only", label: "仅刮削" },
  { value: "full", label: "扫描 + 刮削" },
  { value: "organize_only", label: "仅整理" },
  { value: "rescan", label: "重新扫描" },
];

const PAGE_SIZE = 15;

type Props = {
  kinds: KindRow[];
  loading: boolean;
  onChanged: () => void;
  notify: NotifyFn;
};

export function JobsPage({ kinds, loading, onChanged, notify }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [listLoading, setListLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState("");
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("status");
    const m = params.get("mode");
    if (s) setStatus(s);
    if (m) setMode(m);
  }, []);

  const loadJobs = useCallback(async () => {
    setListLoading(true);
    try {
      const data = await fetchJobs({
        status: status || undefined,
        mode: mode || undefined,
        q: query || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setJobs(data.jobs);
      setTotal(data.total);
    } catch (e) {
      notify("error", e, "加载任务失败");
    } finally {
      setListLoading(false);
    }
  }, [status, mode, query, page, notify]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    const t = setInterval(() => void loadJobs(), 30000);
    return () => clearInterval(t);
  }, [loadJobs]);

  useJobEvents({
    onJobUpdate: (job) => {
      setJobs((prev) => {
        const idx = prev.findIndex((j) => j.id === job.id);
        const matches =
          (!status || job.status === status) &&
          (!mode || job.mode === mode) &&
          (!query ||
            job.id.includes(query) ||
            (job.message ?? "").toLowerCase().includes(query.toLowerCase()));
        if (idx >= 0) {
          if (!matches) return prev.filter((j) => j.id !== job.id);
          const next = [...prev];
          next[idx] = job;
          return next;
        }
        if (page === 1 && matches) return [job, ...prev].slice(0, PAGE_SIZE);
        return prev;
      });
    },
  });

  const running = useMemo(
    () => jobs.filter((j) => j.status === "running" || j.status === "queued").length,
    [jobs],
  );
  const done = useMemo(() => jobs.filter((j) => j.status === "done").length, [jobs]);
  const failed = useMemo(() => jobs.filter((j) => j.status === "failed").length, [jobs]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function act(id: string, action: "pause" | "resume" | "cancel") {
    setActing(id);
    try {
      if (action === "pause") {
        await pauseJob(id);
        notify("warn", "任务已暂停");
      }
      if (action === "resume") {
        await resumeJob(id);
        notify("ok", "任务已继续");
      }
      if (action === "cancel") {
        await cancelJob(id);
        notify("warn", "任务已取消");
      }
      await loadJobs();
      onChanged();
    } catch (e) {
      notify("error", e, "操作失败");
    } finally {
      setActing(null);
    }
  }

  function applySearch() {
    setQuery(searchInput.trim());
    setPage(1);
  }

  function handleCreated() {
    void loadJobs();
    onChanged();
  }

  return (
    <div className="jobs-page">
      <PageHeader
        title="手动任务"
        description="创建、监控与管理刮削任务"
        actions={
          <button
            type="button"
            className="btn primary"
            disabled={loading}
            onClick={() => setCreateOpen(true)}
          >
            {COPY.createTask}
          </button>
        }
      />

      <section className="stats-row">
        <div className="stat-card accent">
          <div className="stat-value">{running}</div>
          <div className="stat-label">本页进行中</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{done}</div>
          <div className="stat-label">本页已完成</div>
        </div>
        <div className="stat-card warn">
          <div className="stat-value">{failed}</div>
          <div className="stat-label">本页失败</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{total}</div>
          <div className="stat-label">匹配任务</div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>任务列表</h2>
          <div className="list-toolbar">
            <input
              className="search-input"
              placeholder="搜索任务 ID 或消息…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applySearch();
              }}
            />
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select value={mode} onChange={(e) => { setMode(e.target.value); setPage(1); }}>
              {MODE_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button type="button" className="btn sm" onClick={applySearch}>
              搜索
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>任务</th>
                <th>模式</th>
                <th>状态</th>
                <th>进度</th>
                <th>分区</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {listLoading && jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">
                    加载中…
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">
                    {COPY.emptyTasks}
                  </td>
                </tr>
              ) : (
                jobs.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <code className="mono">{j.id.slice(-14)}</code>
                      {j.dryRun ? <span className="tag sm">试运行</span> : null}
                      {j.message ? <div className="sub">{j.message}</div> : null}
                    </td>
                    <td>{JOB_MODE_LABELS[j.mode] ?? j.mode}</td>
                    <td>
                      <StatusBadge status={j.status} map={JOB_STATUS_LABELS} />
                    </td>
                    <td>
                      <div className="progress-cell">
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{
                              width:
                                j.total > 0
                                  ? `${Math.min(100, (j.processed / j.total) * 100)}%`
                                  : j.status === "done"
                                    ? "100%"
                                    : "0%",
                            }}
                          />
                        </div>
                        <span>
                          {j.processed}/{j.total || "—"}
                          {j.skipped > 0 ? ` · 跳过 ${j.skipped}` : ""}
                          {j.failed > 0 ? ` · 失败 ${j.failed}` : ""}
                        </span>
                      </div>
                    </td>
                    <td className="kinds-cell">
                      {j.kinds.slice(0, 2).map((k) => (
                        <span key={k} className="tag sm">
                          {kindLabel(k)}
                        </span>
                      ))}
                      {j.kinds.length > 2 ? (
                        <span className="tag sm">+{j.kinds.length - 2}</span>
                      ) : null}
                    </td>
                    <td>
                      <div className="row-actions">
                        {j.status === "running" ? (
                          <button
                            type="button"
                            className="btn xs"
                            disabled={acting === j.id}
                            onClick={() => void act(j.id, "pause")}
                          >
                            暂停
                          </button>
                        ) : null}
                        {j.status === "paused" ? (
                          <button
                            type="button"
                            className="btn xs"
                            disabled={acting === j.id}
                            onClick={() => void act(j.id, "resume")}
                          >
                            继续
                          </button>
                        ) : null}
                        {j.status === "running" || j.status === "queued" ? (
                          <button
                            type="button"
                            className="btn xs danger"
                            disabled={acting === j.id}
                            onClick={() => void act(j.id, "cancel")}
                          >
                            取消
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <div className="pagination">
            <button
              type="button"
              className="btn sm ghost"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </button>
            <span className="text-muted">
              第 {page} / {totalPages} 页 · 共 {total} 条
            </span>
            <button
              type="button"
              className="btn sm ghost"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              下一页
            </button>
          </div>
        ) : null}
      </section>

      <CreateJobModal
        open={createOpen}
        kinds={kinds}
        loading={loading}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
        notify={notify}
      />
    </div>
  );
}
