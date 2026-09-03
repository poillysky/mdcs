import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/20/solid";
import { CreateJobModal } from "../components/CreateJobModal";
import { JobActionsMenu } from "../components/JobActionsMenu";
import { JobProgressPills } from "../components/JobProgressPills";
import { StatusBadge } from "../components/StatusBadge";
import { TableSkeleton } from "../components/ui/TableSkeleton";
import { COPY } from "../lib/messages";
import {
  invalidateCachedQueryPrefix,
  listQueryKey,
  useCachedQuery,
} from "../hooks/useCachedQuery";
import { useJobEvents } from "../hooks/useJobEvents";
import {
  cancelJob,
  deleteJob,
  fetchJob,
  fetchJobs,
  pauseJob,
  resumeJob,
  type JobRow,
  type KindRow,
} from "../api";
import { JOB_TABLE_STATUS_LABELS } from "../lib/labels";
import {
  buildJobRecordsPath,
  formatJobDuration,
  formatJobSummaryLine,
  formatJobPathCellGroups,
  jobProgressFilterToRecordsStatus,
  jobShortId,
  jobProgressPills,
  resolveOrganizeModeLabel,
} from "../lib/jobDisplay";
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

const PAGE_SIZE = 25;
const COL_COUNT = 9;

function formatJobTime(ms?: number): string {
  if (!ms) return "—";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

type Props = {
  kinds: KindRow[];
  loading: boolean;
  onChanged: () => void;
  onNavigate: (path: string) => void;
  notify: NotifyFn;
};

export function JobsPage({ kinds, loading, onChanged, onNavigate, notify }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tick, setTick] = useState(() => Date.now());
  const fileRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingJobRefreshRef = useRef(new Set<string>());
  const visibleJobIdsRef = useRef(new Set<string>());

  const jobsKey = useMemo(
    () => listQueryKey("jobs", { status, q: query, page, pageSize: PAGE_SIZE }),
    [status, query, page],
  );
  const {
    data: jobsData,
    loading: listLoading,
    refreshing: listRefreshing,
    reload: reloadJobs,
  } = useCachedQuery({
    key: jobsKey,
    fetcher: async () => {
      const data = await fetchJobs({
        status: status || undefined,
        q: query || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      return { jobs: data.jobs, total: data.total };
    },
    onError: (e) => notify("error", e, "加载任务失败"),
  });
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const total = jobsData?.total ?? 0;

  useEffect(() => {
    if (jobsData?.jobs) {
      setJobs(jobsData.jobs);
      setSelected((prev) => {
        const ids = new Set(jobsData.jobs.map((j) => j.id));
        const next = new Set<string>();
        for (const id of prev) {
          if (ids.has(id)) next.add(id);
        }
        return next;
      });
    }
  }, [jobsData]);

  useEffect(() => {
    visibleJobIdsRef.current = new Set(jobs.map((j) => j.id));
  }, [jobs]);

  const loadJobs = useCallback(async () => {
    await reloadJobs({ silent: Boolean(jobsData) });
  }, [reloadJobs, jobsData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("status");
    if (s) setStatus(s);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    return () => {
      if (fileRefreshTimerRef.current) clearTimeout(fileRefreshTimerRef.current);
    };
  }, []);

  const pageStats = useMemo(() => {
    let running = 0;
    let done = 0;
    let failed = 0;
    for (const j of jobs) {
      if (j.status === "running" || j.status === "queued") running += 1;
      else if (j.status === "done") done += 1;
      else if (j.status === "failed") failed += 1;
    }
    return { running, done, failed };
  }, [jobs]);

  useEffect(() => {
    const ms = pageStats.running > 0 ? 5000 : 30000;
    const t = setInterval(() => void reloadJobs({ silent: true }), ms);
    return () => clearInterval(t);
  }, [reloadJobs, pageStats.running]);

  const refreshJobsFromFileChange = useCallback((jobIds: string[]) => {
    if (!jobIds.length) return;
    void Promise.all(jobIds.map((id) => fetchJob(id)))
      .then((results) => {
        setJobs((prev) => {
          const next = [...prev];
          let changed = false;
          for (const { job } of results) {
            const idx = next.findIndex((j) => j.id === job.id);
            if (idx < 0) continue;
            next[idx] = job;
            changed = true;
          }
          return changed ? next : prev;
        });
      })
      .catch(() => {
        /* 静默失败，避免与 WS 叠加弹 toast */
      });
  }, []);

  useJobEvents({
    onJobUpdate: (job) => {
      setJobs((prev) => {
        const idx = prev.findIndex((j) => j.id === job.id);
        const matches =
          (!status || job.status === status) &&
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
    onFileChange: (change) => {
      if (change.reason === "scan" || !change.jobId) return;
      if (!visibleJobIdsRef.current.has(change.jobId)) return;
      pendingJobRefreshRef.current.add(change.jobId);
      if (fileRefreshTimerRef.current) clearTimeout(fileRefreshTimerRef.current);
      fileRefreshTimerRef.current = setTimeout(() => {
        fileRefreshTimerRef.current = null;
        const ids = [...pendingJobRefreshRef.current];
        pendingJobRefreshRef.current.clear();
        refreshJobsFromFileChange(ids);
      }, 400);
    },
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const allSelected = jobs.length > 0 && jobs.every((j) => selected.has(j.id));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(jobs.map((j) => j.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function act(id: string, action: "pause" | "resume" | "cancel" | "restart") {
    setActing(id);
    try {
      const job = jobs.find((j) => j.id === id);
      if (!job) return;

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
        notify("warn", "任务已停止");
      }
      if (action === "restart") {
        await resumeJob(id);
        notify("ok", job.status === "paused" ? "任务已继续" : "任务已重新启动");
      }
      await loadJobs();
      onChanged();
    } catch (e) {
      notify("error", e, "操作失败");
    } finally {
      setActing(null);
    }
  }

  async function copyJob(job: JobRow) {
    try {
      await navigator.clipboard.writeText(formatJobSummaryLine(job));
      notify("ok", "已复制任务摘要");
    } catch (e) {
      notify("error", e, "复制失败");
    }
  }

  async function removeJob(job: JobRow) {
    if (!window.confirm(`确定删除任务 #${jobShortId(job.id)}？此操作不可恢复。`)) return;
    setActing(job.id);
    try {
      await deleteJob(job.id);
      notify("ok", "任务已删除");
      await loadJobs();
      onChanged();
    } catch (e) {
      notify("error", e, "删除失败");
    } finally {
      setActing(null);
    }
  }

  function openJobRecords(job: JobRow, status?: string) {
    onNavigate(buildJobRecordsPath(job, status ? { status } : undefined));
  }

  function handleCreated(created: JobRow) {
    setStatus("");
    setSearchInput("");
    setQuery("");
    const canMerge = page === 1 && !status && !query;
    setPage(1);
    setJobs((prev) =>
      canMerge
        ? [created, ...prev.filter((j) => j.id !== created.id)].slice(0, PAGE_SIZE)
        : [created],
    );
    invalidateCachedQueryPrefix("jobs:");
    void reloadJobs({ silent: false });
    onChanged();
  }

  return (
    <div className="jobs-page">
      <header className="jobs-page-head">
        <div className="jobs-page-head-top">
          <div className="jobs-page-head-left">
            <h1 className="jobs-page-title">手动任务</h1>
            <span className="jobs-page-summary">
              共 <strong>{total}</strong> 条
              {pageStats.running > 0 ? (
                <>
                  {" "}
                  · 进行中 <strong>{pageStats.running}</strong>
                </>
              ) : null}
              {pageStats.failed > 0 ? (
                <>
                  {" "}
                  · 失败 <strong>{pageStats.failed}</strong>
                </>
              ) : null}
            </span>
          </div>
          <button
            type="button"
            className="btn primary jobs-create-btn"
            disabled={loading}
            onClick={() => setCreateOpen(true)}
          >
            <PlusIcon className="jobs-create-btn-icon" aria-hidden />
            {COPY.createTask}
          </button>
        </div>
        <div className="jobs-page-head-bar">
          <div className="jobs-page-head-center">
            <div className="jobs-filter-bar">
              <MagnifyingGlassIcon className="jobs-filter-icon" aria-hidden />
              <input
                className="jobs-filter-input"
                placeholder="搜索任务 ID 或消息"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
          </div>
          <div className="jobs-page-head-filters">
            <select
              className="jobs-filter-select"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <section className="panel jobs-list-panel">
        <div className={`jobs-table-wrap${listRefreshing && jobs.length > 0 ? " is-refreshing" : ""}`}>
          <table className="jobs-table data-table">
            <colgroup>
              <col className="jobs-col-check" />
              <col className="jobs-col-index" />
              <col className="jobs-col-path" />
              <col className="jobs-col-mode" />
              <col className="jobs-col-time" />
              <col className="jobs-col-duration" />
              <col className="jobs-col-progress" />
              <col className="jobs-col-status" />
              <col className="jobs-col-op" />
            </colgroup>
            <thead>
              <tr>
                <th className="jobs-col-check">
                  <input
                    type="checkbox"
                    aria-label="全选"
                    checked={allSelected}
                    onChange={toggleAll}
                  />
                </th>
                <th className="jobs-col-index">#</th>
                <th className="jobs-col-path">目录</th>
                <th className="jobs-col-mode">整理模式</th>
                <th className="jobs-col-time">创建时间</th>
                <th className="jobs-col-duration">用时</th>
                <th className="jobs-col-progress">进度</th>
                <th className="jobs-col-status">状态</th>
                <th className="jobs-col-op">操作</th>
              </tr>
            </thead>
            <tbody>
              {listLoading && jobs.length === 0 ? (
                <TableSkeleton colCount={COL_COUNT} rowCount={8} />
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={COL_COUNT} className="empty">
                    {COPY.emptyTasks}
                  </td>
                </tr>
              ) : (
                jobs.map((j, idx) => {
                  const pathGroups = formatJobPathCellGroups(j, kinds);
                  const stats = jobProgressPills(j);
                  const busy = acting === j.id;
                  return (
                    <tr key={j.id} className={selected.has(j.id) ? "is-selected" : undefined}>
                      <td className="jobs-col-check">
                        <input
                          type="checkbox"
                          aria-label={`选择任务 ${idx + 1}`}
                          checked={selected.has(j.id)}
                          onChange={() => toggleOne(j.id)}
                        />
                      </td>
                      <td className="jobs-col-index">{ (page - 1) * PAGE_SIZE + idx + 1}</td>
                      <td
                        className="jobs-col-path jobs-col-link"
                        role="button"
                        tabIndex={0}
                        title="查看该任务范围的刮削记录"
                        onClick={() => openJobRecords(j)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openJobRecords(j);
                          }
                        }}
                      >
                        <div className="jobs-path-groups">
                          {pathGroups.map((paths, pathIdx) => (
                            <div
                              key={pathIdx}
                              className="records-path-cell"
                              title={paths.title}
                            >
                              <span className="records-path-part">{paths.source}</span>
                              {paths.target ? (
                                <span className="records-path-target">
                                  <span className="records-path-arrow"> → </span>
                                  <span className="records-path-target-text">{paths.target}</span>
                                </span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                        {j.dryRun ? <span className="jobs-dryrun-tag">试运行</span> : null}
                      </td>
                      <td className="jobs-col-mode">
                        <span className="jobs-mode-tag">{resolveOrganizeModeLabel(j, kinds)}</span>
                      </td>
                      <td className="jobs-col-time jobs-col-muted">{formatJobTime(j.createdAt)}</td>
                      <td className="jobs-col-duration jobs-col-muted">
                        {formatJobDuration(j, tick)}
                      </td>
                      <td
                        className="jobs-col-progress jobs-col-link"
                        role="button"
                        tabIndex={0}
                        title="查看该任务范围的刮削记录"
                        onClick={() => openJobRecords(j)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openJobRecords(j);
                          }
                        }}
                      >
                        <JobProgressPills
                          stats={stats}
                          jobStatus={j.status}
                          onFilterClick={(filter) => {
                            openJobRecords(j, jobProgressFilterToRecordsStatus(filter));
                          }}
                        />
                      </td>
                      <td className="jobs-col-status">
                        <StatusBadge status={j.status} map={JOB_TABLE_STATUS_LABELS} />
                      </td>
                      <td className="jobs-col-op">
                        <JobActionsMenu
                          job={j}
                          busy={busy}
                          onTerminate={() => void act(j.id, "cancel")}
                          onRestart={() => void act(j.id, "restart")}
                          onCopy={() => void copyJob(j)}
                          onDelete={() => void removeJob(j)}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 || total > 0 ? (
          <div className="pagination jobs-pagination">
            <button
              type="button"
              className="btn sm ghost"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </button>
            <span className="jobs-page-indicator">{page}</span>
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
