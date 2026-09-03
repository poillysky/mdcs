import { useEffect, useMemo, useRef, useState } from "react";
import { fetchDashboard, type DashboardWeekCompare } from "../api";
import { Pagination } from "../components/ui/Pagination";
import { kindLabel } from "../lib/labels";
import type { NotifyFn } from "../lib/notify";
import type { FileRow, JobRow, KindRow } from "../types";
import { triggerLabel, triggerPillClass } from "./records/recordsDisplay";

type Props = {
  jobs: JobRow[];
  kinds: KindRow[];
  fileFailedTotal: number;
  onNavigate: (path: string) => void;
  notify: NotifyFn;
};

const ACTIVITY_PAGE_SIZE = 20;
const ACTIVITY_SKELETON_ROWS = 6;

type DashboardCache = {
  page: number;
  kind: string;
  scrapeMax: number;
  actorTotal: number;
  recentAdded7d: number;
  weekCompare: DashboardWeekCompare | null;
  activityFiles: FileRow[];
  activityTotal: number;
};

let dashboardCache: DashboardCache | null = null;

function readDashboardCache(page: number, kind: string): DashboardCache | null {
  if (!dashboardCache) return null;
  if (dashboardCache.page !== page || dashboardCache.kind !== kind) return null;
  return dashboardCache;
}

function ActivitySkeletonRows() {
  return Array.from({ length: ACTIVITY_SKELETON_ROWS }, (_, row) => (
    <tr key={row} className="dashboard-skeleton-row" aria-hidden>
      {Array.from({ length: 8 }, (__, col) => (
        <td key={col}>
          <span className="ui-skeleton" />
        </td>
      ))}
    </tr>
  ));
}

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
  notify,
}: Props) {
  const [activityPage, setActivityPage] = useState(1);
  const [activityKind, setActivityKind] = useState("");
  const initialCache = readDashboardCache(1, "");
  const [scrapeMax, setScrapeMax] = useState(() => initialCache?.scrapeMax ?? 5);
  const [actorTotal, setActorTotal] = useState(() => initialCache?.actorTotal ?? 0);
  const [recentAdded7d, setRecentAdded7d] = useState(() => initialCache?.recentAdded7d ?? 0);
  const [weekCompare, setWeekCompare] = useState<DashboardWeekCompare | null>(
    () => initialCache?.weekCompare ?? null,
  );
  const [activityFiles, setActivityFiles] = useState<FileRow[]>(() => initialCache?.activityFiles ?? []);
  const [activityTotal, setActivityTotal] = useState(() => initialCache?.activityTotal ?? 0);
  const [activityLoading, setActivityLoading] = useState(() => !initialCache);
  const fetchSeq = useRef(0);
  const loadErrorNotified = useRef(false);

  useEffect(() => {
    const cached = readDashboardCache(activityPage, activityKind);
    if (cached) {
      setScrapeMax(cached.scrapeMax);
      setActorTotal(cached.actorTotal);
      setRecentAdded7d(cached.recentAdded7d);
      setWeekCompare(cached.weekCompare);
      setActivityFiles(cached.activityFiles);
      setActivityTotal(cached.activityTotal);
      setActivityLoading(false);
    } else {
      setActivityFiles([]);
      setActivityTotal(0);
      setActivityLoading(true);
    }

    const seq = ++fetchSeq.current;
    let cancelled = false;

    function loadDashboardData(opts?: { silent?: boolean }) {
      const hasCachedRows = Boolean(readDashboardCache(activityPage, activityKind)?.activityFiles.length);
      if (!opts?.silent && !hasCachedRows) setActivityLoading(true);
      void fetchDashboard({
        page: activityPage,
        pageSize: ACTIVITY_PAGE_SIZE,
        kind: activityKind || undefined,
      })
        .then((data) => {
          if (cancelled || seq !== fetchSeq.current) return;
          loadErrorNotified.current = false;
          setScrapeMax(data.scrapeMax);
          setActorTotal(data.actorTotal);
          setRecentAdded7d(data.recentAdded7d);
          setWeekCompare(data.weekCompare);
          const total = data.activity.total;
          const pageCount = Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE));
          const clampedPage = Math.min(activityPage, pageCount);
          if (clampedPage !== activityPage) {
            setActivityPage(clampedPage);
            return;
          }
          setActivityFiles(data.activity.files ?? []);
          setActivityTotal(total);
          dashboardCache = {
            page: activityPage,
            kind: activityKind,
            scrapeMax: data.scrapeMax,
            actorTotal: data.actorTotal,
            recentAdded7d: data.recentAdded7d,
            weekCompare: data.weekCompare,
            activityFiles: data.activity.files ?? [],
            activityTotal: total,
          };
        })
        .catch((e) => {
          if (cancelled || seq !== fetchSeq.current) return;
          if (!loadErrorNotified.current) {
            notify("error", e, "加载主界面数据失败");
            loadErrorNotified.current = true;
          }
        })
        .finally(() => {
          if (!cancelled && seq === fetchSeq.current) setActivityLoading(false);
        });
    }

    loadDashboardData({ silent: Boolean(cached) });
    const timer = setInterval(() => loadDashboardData({ silent: true }), 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activityPage, activityKind, notify]);

  const kindStats = useMemo(() => aggregateKindStats(kinds), [kinds]);
  /** 仅计刮削池占用的 scraping；整理 organizing 不占刮削线程槽位 */
  const scrapeActive = kindStats.scraping;
  const manualActive = jobs.filter((j) => j.status === "running" || j.status === "queued").length;
  const manualMax = 1;
  const activityPageCount = Math.max(1, Math.ceil(activityTotal / ACTIVITY_PAGE_SIZE));

  const successTotal = kindStats.done;
  const failedTotal = Math.max(kindStats.failed, fileFailedTotal);
  const activityEmptyMessage = activityKind
    ? "该分类暂无入库记录"
    : "刮削成功后会显示在这里";

  return (
    <div className="dashboard-page">
      <h1 className="dashboard-greeting">{dashboardGreeting()}</h1>

      <section className="dashboard-status">
        <h2 className="dashboard-section-title">运行状态</h2>
        <div className="dashboard-stat-grid">
          <button
            type="button"
            className="dashboard-stat-card"
            onClick={() => onNavigate("/records?status=processing")}
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
              <span className="jobs-stat-pill jobs-stat-pill--skip">跳过: {kindStats.skipped}</span>
              <span className="jobs-stat-pill jobs-stat-pill--success">成功: {successTotal}</span>
              <button
                type="button"
                className="jobs-stat-pill jobs-stat-pill--error dashboard-stat-pill-link"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate("/records?status=failed");
                }}
              >
                失败: {failedTotal}
              </button>
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
        <div
          className={`records-table-wrap dashboard-activity-table-wrap${activityLoading && activityFiles.length > 0 ? " is-loading" : ""}`}
        >
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
              {activityLoading && activityFiles.length === 0 ? (
                <ActivitySkeletonRows />
              ) : activityFiles.length ? (
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
                      <span className={triggerPillClass(file)}>
                        {triggerLabel(file)}
                      </span>
                    </td>
                    <td className="records-col-duration">{displayYear(file)}</td>
                    <td className="records-col-time">{formatDashboardTime(fileAddedAt(file))}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="empty">
                    {activityEmptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={activityPage}
          pageCount={activityPageCount}
          total={activityTotal}
          onPageChange={setActivityPage}
          className="pagination dashboard-activity-pagination"
          metaClassName="dashboard-activity-page-meta"
        />
      </section>
    </div>
  );
}
