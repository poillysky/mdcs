import { useEffect, useMemo, useState } from "react";
import { fetchActors, fetchFiles, fetchScrapeConfig } from "../api";
import type { FileRow, JobRow, KindRow } from "../types";

type Props = {
  jobs: JobRow[];
  kinds: KindRow[];
  fileFailedTotal: number;
  onNavigate: (path: string) => void;
};

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

function countDoneInRange(files: FileRow[], startMs: number, endMs: number): number {
  return files.filter((f) => {
    const ts = fileAddedAt(f);
    return ts != null && ts >= startMs && ts < endMs;
  }).length;
}

function weekCompareFromDoneFiles(files: FileRow[]): { text: string; tone: "up" | "down" | "flat" } | null {
  if (!files.length) return null;
  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  const thisWeek = countDoneInRange(files, now - week, now);
  const lastWeek = countDoneInRange(files, now - 2 * week, now - week);
  if (lastWeek <= 0) {
    if (thisWeek <= 0) return null;
    return { text: `+${thisWeek} 对比上周`, tone: "up" };
  }
  const pct = ((thisWeek - lastWeek) / lastWeek) * 100;
  const sign = pct > 0 ? "+" : "";
  return {
    text: `${sign}${pct.toFixed(2)}% 对比上周`,
    tone: pct > 0 ? "up" : pct < 0 ? "down" : "flat",
  };
}

function triggerLabel(file: FileRow, kinds: KindRow[]): string {
  const kind = kinds.find((row) => row.id === file.kind);
  if (kind?.enabled && kind.sourceRoot?.trim()) return "监控";
  return "手动";
}

function displayTitle(file: FileRow): string {
  return file.titleZh?.trim() || file.title?.trim() || "—";
}

function displayActors(file: FileRow): string {
  return file.actors?.trim() || "—";
}

export function DashboardPage({
  jobs,
  kinds,
  fileFailedTotal,
  onNavigate,
}: Props) {
  const [scrapeMax, setScrapeMax] = useState(5);
  const [actorTotal, setActorTotal] = useState(0);
  const [doneFiles, setDoneFiles] = useState<FileRow[]>([]);
  const [recentAdded, setRecentAdded] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void fetchScrapeConfig()
      .then((data) => {
        if (cancelled) return;
        const fast = data.config.exportFastConcurrency ?? 3;
        const slow = data.config.exportSlowConcurrency ?? 2;
        setScrapeMax(Math.max(1, fast + slow));
      })
      .catch(() => {
        if (!cancelled) setScrapeMax(5);
      });
    void fetchActors({ pageSize: 1 })
      .then((data) => {
        if (!cancelled) setActorTotal(data.total);
      })
      .catch(() => {
        if (!cancelled) setActorTotal(0);
      });
    void fetchFiles({ status: "done", pageSize: 500 })
      .then((data) => {
        if (cancelled) return;
        const rows = data.files ?? [];
        setDoneFiles(rows);
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        setRecentAdded(countDoneInRange(rows, weekAgo, Date.now()));
      })
      .catch(() => {
        if (!cancelled) {
          setDoneFiles([]);
          setRecentAdded(0);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [kinds]);

  const kindStats = useMemo(() => aggregateKindStats(kinds), [kinds]);
  const scrapeActive = kindStats.scraping + kindStats.organizing;
  const manualActive = jobs.filter((j) => j.status === "running" || j.status === "queued").length;
  const manualMax = 1;
  const ingestCompare = useMemo(() => weekCompareFromDoneFiles(doneFiles), [doneFiles]);

  const recentActivity = useMemo(
    () =>
      [...doneFiles]
        .sort((a, b) => (fileAddedAt(b) ?? 0) - (fileAddedAt(a) ?? 0) || b.id - a.id)
        .slice(0, 20),
    [doneFiles],
  );

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
            onClick={() => onNavigate("/records?status=scraping")}
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

          <div className="dashboard-stat-card">
            <div className="dashboard-stat-label">手动任务线程</div>
            <div className="dashboard-stat-value">
              {Math.min(manualActive, manualMax)}/{manualMax}{" "}
              <span className="dashboard-stat-suffix">
                {manualActive > 0 ? "忙碌" : "空闲"}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="dashboard-stat-card"
            onClick={() => onNavigate("/records?status=done")}
          >
            <div className="dashboard-stat-label">入库记录</div>
            <div className="dashboard-stat-value">
              {recentAdded}{" "}
              <span className="dashboard-stat-suffix">最近新增</span>
            </div>
            <div className={`dashboard-stat-compare is-${ingestCompare?.tone ?? "flat"}`}>
              {ingestCompare?.text ?? "暂无对比数据"}
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
        <header className="dashboard-activity-head">
          <h2 className="dashboard-section-title">最近活动</h2>
        </header>
        <div className="records-table-wrap dashboard-activity-table-wrap">
          <table className="records-table data-table dashboard-activity-table">
            <colgroup>
              <col className="records-col-index" />
              <col className="records-col-code" />
              <col />
              <col className="records-col-actors" />
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
                <th className="records-col-trigger">来源</th>
                <th className="records-col-duration">年份</th>
                <th className="records-col-time">添加日期</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.length ? (
                recentActivity.map((file) => (
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
                    <td className="records-col-trigger">
                      <span className="records-pill records-pill--trigger">
                        {triggerLabel(file, kinds)}
                      </span>
                    </td>
                    <td className="records-col-duration">—</td>
                    <td className="records-col-time">{formatDashboardTime(fileAddedAt(file))}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="empty">
                    刮削成功后会显示在这里
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
