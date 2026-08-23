import { PageHeader } from "../components/ui/PageHeader";
import { FILE_STATUS_LABELS, JOB_MODE_LABELS, JOB_STATUS_LABELS, formatTime } from "../lib/labels";
import { COPY } from "../lib/messages";
import type { FileRow, HealthInfo, JobRow } from "../types";

type Props = {
  health: HealthInfo | null;
  jobs: JobRow[];
  files: FileRow[];
  fileFailedTotal: number;
  onNavigate: (path: string) => void;
  onRefresh: () => void;
};

export function DashboardPage({
  health,
  jobs,
  files,
  fileFailedTotal,
  onNavigate,
  onRefresh,
}: Props) {
  const running = jobs.filter((j) => j.status === "running").length;
  const queued = jobs.filter((j) => j.status === "queued").length;
  const failedJobs = jobs.filter((j) => j.status === "failed").length;
  const done = files.filter((f) => f.status === "done").length;
  const recentJobs = [...jobs]
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, 5);
  const recentFiles = [...files].slice(0, 8);
  const failedFilesPreview = files.filter((f) => f.status === "failed").slice(0, 5);

  return (
    <>
      <PageHeader
        title="欢迎回来"
        description="运行状态与最近活动概览"
        actions={
          <button type="button" className="btn ghost" onClick={onRefresh}>
            {COPY.refresh}
          </button>
        }
      />

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">服务状态</div>
          <div className="stat-value">{health ? "在线" : "连接中"}</div>
          {health ? (
            <div className="stat-meta">
              {health.service} v{health.version}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="stat-card stat-card-link"
          onClick={() => onNavigate("/tasks?status=running")}
          title="查看运行中任务"
        >
          <div className="stat-label">运行中任务</div>
          <div className="stat-value">{running}</div>
          {queued ? <div className="stat-meta">排队 {queued}</div> : null}
        </button>
        <div className="stat-card">
          <div className="stat-label">入库记录</div>
          <div className="stat-value">{done}</div>
          <div className="stat-meta">样本 {files.length} 条</div>
        </div>
        <button
          type="button"
          className="stat-card stat-card-link warn"
          onClick={() => onNavigate("/files?status=failed")}
          title="查看失败文件"
        >
          <div className="stat-label">失败文件</div>
          <div className="stat-value stat-warn">{fileFailedTotal}</div>
          {failedJobs ? <div className="stat-meta">失败任务 {failedJobs}</div> : null}
        </button>
      </div>

      <div className="card">
        <div className="card-title-row">
          <h2 className="card-title">最近任务</h2>
          <button type="button" className="btn sm ghost" onClick={() => onNavigate("/tasks")}>
            查看全部
          </button>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>模式</th>
                <th>状态</th>
                <th>进度</th>
                <th>更新时间</th>
              </tr>
            </thead>
            <tbody>
              {recentJobs.map((j) => (
                <tr
                  key={j.id}
                  className={j.status === "failed" ? "row-failed clickable" : "clickable"}
                  onClick={() =>
                    onNavigate(j.status === "failed" ? "/tasks?status=failed" : "/tasks")
                  }
                >
                  <td>{JOB_MODE_LABELS[j.mode] ?? j.mode}</td>
                  <td>{JOB_STATUS_LABELS[j.status] ?? j.status}</td>
                  <td>
                    {j.processed}/{j.total}
                  </td>
                  <td className="text-muted">{j.updatedAt ? formatTime(j.updatedAt) : "—"}</td>
                </tr>
              ))}
              {!recentJobs.length ? (
                <tr>
                  <td colSpan={4} className="text-muted">
                    暂无任务
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-title-row">
          <h2 className="card-title">最近文件</h2>
          {fileFailedTotal > 0 ? (
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => onNavigate("/files?status=failed")}
            >
              失败 {fileFailedTotal} 条
            </button>
          ) : null}
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>番号</th>
                <th>文件</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {recentFiles.map((f) => (
                <tr
                  key={f.id}
                  className={f.status === "failed" ? "row-failed clickable" : undefined}
                  onClick={
                    f.status === "failed"
                      ? () => onNavigate("/files?status=failed")
                      : undefined
                  }
                >
                  <td>{f.code ?? "—"}</td>
                  <td className="mono">{f.file_name}</td>
                  <td>{FILE_STATUS_LABELS[f.status] ?? f.status}</td>
                </tr>
              ))}
              {!recentFiles.length ? (
                <tr>
                  <td colSpan={3} className="text-muted">
                    暂无最近活动
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {failedFilesPreview.length > 0 ? (
          <p className="hint" style={{ padding: "0 16px 12px" }}>
            最近失败：{failedFilesPreview.map((f) => f.file_name).join("、")}
          </p>
        ) : null}
      </div>
    </>
  );
}
