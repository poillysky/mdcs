import type { ProgressPillView } from "../lib/jobDisplay";

type Props = {
  stats: ProgressPillView;
};

export function JobMonitoringTag() {
  return (
    <div className="jobs-stat-pills">
      <span className="jobs-stat-pill jobs-stat-pill--monitor">监控中</span>
    </div>
  );
}

export function JobProgressPills({ stats }: Props) {
  if (
    stats.total <= 0 &&
    stats.success <= 0 &&
    stats.middle <= 0 &&
    stats.failed <= 0 &&
    stats.processing <= 0
  ) {
    return (
      <div className="jobs-stat-pills">
        <span className="jobs-stat-pill jobs-stat-pill--total">暂无索引</span>
      </div>
    );
  }

  return (
    <div className="jobs-stat-pills">
      <span className="jobs-stat-pill jobs-stat-pill--success">成功: {stats.success}</span>
      <span className="jobs-stat-pill jobs-stat-pill--skip">
        {stats.middleLabel}: {stats.middle}
      </span>
      <span className="jobs-stat-pill jobs-stat-pill--error">错误: {stats.failed}</span>
      {stats.processing > 0 ? (
        <span className="jobs-stat-pill jobs-stat-pill--processing">处理中: {stats.processing}</span>
      ) : null}
      <span className="jobs-stat-pill jobs-stat-pill--total">总数: {stats.total}</span>
    </div>
  );
}
