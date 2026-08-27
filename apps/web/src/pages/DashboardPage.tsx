import { useEffect, useMemo, useState } from "react";
import { fetchDashboard, type DashboardWeekCompare } from "../api";
import { kindLabel } from "../lib/labels";
import type { FileRow, JobRow, KindRow } from "../types";

type Props = {
  jobs: JobRow[];
  kinds: KindRow[];
  fileFailedTotal: number;
  onNavigate: (path: string) => void;
};

const ACTIVITY_PAGE_SIZE = 20;

function dashboardGreeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 6) return "夜深了";
  if (hour < 12) return "早上好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

function aggregateKindStats(kinds: KindRow[]) {
  let done = 0;
  let failed = 0;
  let skipped = 0;
  let scraping = 0;
  let organizing = 0;
  let planned = 0;
  for (const kind of kinds) {
    const stats = kind.stats ?? {};
    done += stats.done ?? 0;
    failed += stats.failed ?? 0;
    skipped += stats.skipped ?? 0;
    scraping += stats.scraping ?? 0;
    organizing += stats.organizing ?? 0;
    planned += stats.planned ?? 0;
  }
  return {
    done,
    failed,
    skipped,
    scraping,
    organizing,
    planned,
    /** 运行中队列：正在刮削/整理/排队整理，不含索引待处理 backlog */
    queue: scraping + organizing + planned,
  };
}

function formatDashboardTime(ms?: number | null): string {
  if (!ms) return "—";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function fileAddedAt(file: FileRow): number | null {
  return file.organized_at ?? file.scraped_at ?? file.file_mtime ?? null;
}

function triggerLabel(source?: string | null): string {
  switch (source) {
    case "monitor":
      return "监控";
    case "qb":
      return "qB";
    case "manual":
      return "手动";
    default:
      return "—";
  }
}

function triggerPillClass(source?: string | null): string {
  const base = "records-pill";
  switch (source) {
    case "monitor":
      return `${base} records-pill--trigger records-pill--source-monitor`;
    case "qb":
      return `${base} records-pill--trigger records-pill--source-qb`;
    case "manual":
      return `${base} records-pill--source-manual`;
    default:
      return `${base} records-pill--muted`;
  }
}

function displayTitle(file: FileRow): string {
  return file.titleZh?.trim() || file.title?.trim() || "—";
}

function displayActors(file: FileRow): string {
  return file.actors?.trim() || "—";
}

function displayYear(file: FileRow): string {
  const raw = file.premiered?.trim();
  if (!raw) return "—";
  const y = raw.slice(0, 4);
  return /^\d{4}$/.test(y) ? y : "—";
}

export function DashboardPage({
  jobs,
  kinds,
  fileFailedTotal,
  onNavigate,
}: Props) {
  const [scrapeMax, setScrapeMax] = useState(5);
  const [actorTotal, setActorTotal] = useState(0);
  const [recentAdded7d, setRecentAdded7d] = useState(0);
  const [weekCompare, setWeekCompare] = useState<DashboardWeekCompare | null>(null);
  const [activityFiles, setActivityFiles] = useState<FileRow[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityPage, setActivityPage] = useState(1);
  const [activityKind, setActivityKind] = useState("");

  useEffect(() => {
    let cancelled = false;

    function loadDashboardData() {
      void fetchDashboard({
        page: activityPage,
        pageSize: ACTIVITY_PAGE_SIZE,
        kind: activityKind || undefined,
      })
        .then((data) => {
          if (cancelled) return;
          setScrapeMax(data.scrapeMax);
          setActorTotal(data.actorTotal);
          setRecentAdded7d(data.recentAdded7d);
          setWeekCompare(data.weekCompare);
          setActivityFiles(data.activity.files ?? []);
          setActivityTotal(data.activity.total);
        })
        .catch(() => {
          if (!cancelled) {
            setScrapeMax(5);
            setActorTotal(0);
            setRecentAdded7d(0);
            setWeekCompare(null);
            setActivityFiles([]);
            setActivityTotal(0);
          }
        });
    }

    loadDashboardData();
    const timer = setInterval(loadDashboardData, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activityPage, activityKind]);

  const kindStats = useMemo(() => aggregateKindStats(kinds), [kinds]);
  const scrapeActive = kindStats.scraping + kindStats.organizing;
  const manualActive = jobs.filter((j) => j.status === "running" || j.status === "queued").length;
  const manualMax = 1;
  const activityPageCount = Math.max(1, Math.ceil(activityTotal / ACTIVITY_PAGE_SIZE));

  const successTotal = kindStats.done;
  const failedTotal = Math.max(kindStats.failed, fileFailedTotal);

  return (
    <div className="dashboard-page">
      <h1 className="dashboard-greeting">{dashboardGreeting()}</h1>

      <section className="dashboard-status">
        <h2 className="dashboard-section-title">运行状态</h2>
        <div className="dashboard-stat-grid">
          <button
            type="button"
            className="dashboard-stat-card"
            onClick={() => onNavigate("/tasks")}
          >
            <div className="dashboard-stat-label">刮削线程</div>
            <div className="dashboard-stat-value">
              {scrapeActive}/{scrapeMax}{" "}
              <span className="dashboard-stat-suffix">
                {scrapeActive >= scrapeMax ? "忙碌" : "空闲"}
              </span>
            </div>
            <div className="dashboard-stat-pills">
              <span className="jobs-stat-pill jobs-stat-pill--skip">队列: {kindStats.queue}</span>
              <span className="jobs-stat-pill jobs-stat-pill--success">成功: {successTotal}</span>
              <span className="jobs-stat-pill jobs-stat-pill--error">失败: {failedTotal}</span>
            </div>
          </button>

          <button
            type="button"
            className="dashboard-stat-card"
            onClick={() => onNavigate("/tasks")}
          >
            <div className="dashboard-stat-label">手动任务线程</div>
            <div className="dashboard-stat-value">
              {Math.min(manualActive, manualMax)}/{manualMax}{" "}
              <span className="dashboard-stat-suffix">
                {manualActive > 0 ? "忙碌" : "空闲"}
              </span>
            </div>
          </button>

          <button
            type="button"
            className="dashboard-stat-card"
            onClick={() => onNavigate("/records?status=done")}
          >
            <div className="dashboard-stat-label">入库记录</div>
            <div className="dashboard-stat-value">
              {successTotal}{" "}
              <span className="dashboard-stat-suffix">总计</span>
            </div>
            <div className={`dashboard-stat-compare is-${weekCompare?.tone ?? "flat"}`}>
              {weekCompare?.text ?? (recentAdded7d > 0 ? `近 7 日 +${recentAdded7d}` : "暂无对比数据")}
            </div>
          </button>

          <button
            type="button"
            className="dashboard-stat-card"
            onClick={() => onNavigate("/actors")}
          >
            <div className="dashboard-stat-label">演员</div>
            <div className="dashboard-stat-value">
              {actorTotal}{" "}
              <span className="dashboard-stat-suffix">位老师</span>
            </div>
          </button>
        </div>
      </section>

      <section className="dashboard-activity panel">
        <header className="panel-head dashboard-activity-head">
          <h2>最近活动</h2>
          <select
            className="input sm dashboard-activity-kind"
            value={activityKind}
            aria-label="按分类筛选"
            onChange={(e) => {
              setActivityKind(e.target.value);
              setActivityPage(1);
            }}
          >
            <option value="">全部分类</option>
            {kinds.map((kind) => (
              <option key={kind.id} value={kind.id}>
                {kindLabel(kind.id)}
              </option>
            ))}
          </select>
        </header>
        <div className="records-table-wrap dashboard-activity-table-wrap">
          <table className="records-table data-table dashboard-activity-table">
            <colgroup>
              <col className="records-col-index" />
              <col className="records-col-code" />
              <col className="dashboard-col-title-col" />
              <col className="records-col-actors" />
              <col className="records-col-kind" />
              <col className="records-col-trigger" />
              <col className="records-col-duration" />
              <col className="records-col-time" />
            </colgroup>
            <thead>
              <tr>
                <th className="records-col-index">#</th>
                <th className="records-col-code">番号</th>
                <th className="dashboard-col-title">标题</th>
                <th className="records-col-actors">演员</th>
                <th className="records-col-kind">分类</th>
                <th className="records-col-trigger">来源</th>
                <th className="records-col-duration">年份</th>
                <th className="records-col-time">添加日期</th>
              </tr>
            </thead>
            <tbody>
              {activityFiles.length ? (
                activityFiles.map((file) => (
                  <tr
                    key={file.id}
                    className="records-row-clickable"
                    onClick={() => onNavigate(`/records?id=${file.id}`)}
                  >
                    <td className="records-col-index">{file.id}</td>
                    <td className="records-col-code">{file.code ?? "—"}</td>
                    <td className="dashboard-col-title" title={displayTitle(file)}>
                      {displayTitle(file)}
                    </td>
                    <td className="records-col-actors" title={displayActors(file)}>
                      {displayActors(file)}
                    </td>
                    <td className="records-col-kind">
                      <span className="records-pill records-pill--kind">{kindLabel(file.kind)}</span>
                    </td>
                    <td className="records-col-trigger">
                      <span className={triggerPillClass(file.triggerSource)}>
                        {triggerLabel(file.triggerSource)}
                      </span>
                    </td>
                    <td className="records-col-duration">{displayYear(file)}</td>
                    <td className="records-col-time">{formatDashboardTime(fileAddedAt(file))}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="empty">
                    刮削成功后会显示在这里
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {activityPageCount > 1 || activityTotal > 0 ? (
          <footer className="pagination dashboard-activity-pagination">
            <span className="dashboard-activity-page-meta">
              共 {activityTotal} 条
              {activityPageCount > 1 ? ` · 第 ${activityPage}/${activityPageCount} 页` : ""}
            </span>
            <div className="dashboard-activity-page-controls">
              <button
                type="button"
                className="btn sm ghost"
                disabled={activityPage <= 1}
                onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </button>
              <span className="records-page-indicator">{activityPage}</span>
              <button
                type="button"
                className="btn sm ghost"
                disabled={activityPage >= activityPageCount}
                onClick={() => setActivityPage((p) => p + 1)}
              >
                下一页
              </button>
            </div>
          </footer>
        ) : null}
      </section>
    </div>
  );
}
