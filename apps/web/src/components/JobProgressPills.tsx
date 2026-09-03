import type { MouseEvent, ReactNode } from "react";
import type { ProgressPillView } from "../lib/jobDisplay";

import type { JobProgressRecordsFilter } from "../lib/jobDisplay";

type FilterKey = JobProgressRecordsFilter;

type PillVariant = "success" | "skip" | "error" | "queued" | "processing" | "total";

type PillItem = {
  key: string;
  label: string;
  value: number;
  variant: PillVariant;
  filter?: FilterKey;
};

type Props = {
  stats: ProgressPillView;
  /** 任务刚创建、磁盘 walk 未完成时展示 */
  jobStatus?: string;
  onFilterClick?: (filter: FilterKey, e: MouseEvent) => void;
};

function Pill({
  variant,
  filter,
  onFilterClick,
  children,
}: {
  variant: PillVariant;
  filter?: FilterKey;
  onFilterClick?: (filter: FilterKey, e: MouseEvent) => void;
  children: ReactNode;
}) {
  const className = `jobs-stat-pill jobs-stat-pill--${variant}`;
  if (!filter || !onFilterClick) {
    return <span className={className}>{children}</span>;
  }
  return (
    <button
      type="button"
      className={className}
      onClick={(e) => {
        e.stopPropagation();
        onFilterClick(filter, e);
      }}
    >
      {children}
    </button>
  );
}

function buildPillItems(stats: ProgressPillView): PillItem[] {
  return [
    { key: "success", label: "成功", value: stats.success, variant: "success", filter: "success" },
    { key: "skip", label: stats.middleLabel, value: stats.middle, variant: "skip",
      filter: stats.middleLabel === "跳过" ? "skipped" : undefined },
    { key: "error", label: "错误", value: stats.failed, variant: "error", filter: "failed" },
    { key: "queued", label: "待处理", value: stats.queued, variant: "queued", filter: "waiting" },
    {
      key: "processing",
      label: "处理中",
      value: stats.processing,
      variant: "processing",
      filter: "processing",
    },
    { key: "total", label: "总数", value: stats.total, variant: "total" },
  ];
}

export function JobMonitoringTag() {
  return (
    <div className="jobs-stat-pills">
      <span className="jobs-stat-pill jobs-stat-pill--monitor">监控中</span>
    </div>
  );
}

export function JobProgressPills({ stats, jobStatus, onFilterClick }: Props) {
  const empty =
    stats.total <= 0 &&
    stats.success <= 0 &&
    stats.middle <= 0 &&
    stats.queued <= 0 &&
    stats.failed <= 0 &&
    stats.processing <= 0;
  if (empty) {
    const scanning = jobStatus === "queued" || jobStatus === "running";
    return (
      <div className="jobs-stat-pills">
        <span className="jobs-stat-pill jobs-stat-pill--queued">
          {scanning ? "索引中…" : "暂无数据"}
        </span>
      </div>
    );
  }

  return (
    <div className="jobs-stat-pills jobs-stat-pills--grid">
      {buildPillItems(stats).map((item) => (
        <Pill
          key={item.key}
          variant={item.variant}
          filter={item.filter}
          onFilterClick={onFilterClick}
        >
          {item.label}: {item.value}
        </Pill>
      ))}
    </div>
  );
}
