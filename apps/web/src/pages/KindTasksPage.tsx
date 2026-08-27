import { useMemo, useState } from "react";
import { PlayIcon, PauseIcon } from "@heroicons/react/20/solid";
import { createJob, pauseJob, type JobRow, type KindRow } from "../api";
import { JobMonitoringTag, JobProgressPills } from "../components/JobProgressPills";
import { StatusBadge } from "../components/StatusBadge";
import { JOB_TABLE_STATUS_LABELS, KIND_LABELS } from "../lib/labels";
import {
  activeJobForKind,
  jobProgressPills,
  kindHasIndexProgress,
  kindIndexProgressPills,
  recordsPathForKindTask,
  resolveKindOrganizeMode,
} from "../lib/jobDisplay";
import type { NotifyFn } from "../lib/notify";

const KIND_ORDER = [
  "japan_censored",
  "japan_gravure",
  "japan_uncensored",
  "japan_amateur",
  "fc2",
  "china",
  "western",
] as const;

const DEFAULT_MODE = "full";
const DEFAULT_MODE_LABEL = "全流程（扫描 + 刮削 + 整理）";

const KIND_STATUS_LABELS: Record<string, string> = {
  ready: "就绪",
  disabled: "未启用",
  unbound: "未绑定",
};

type Props = {
  kinds: KindRow[];
  jobs: JobRow[];
  loading: boolean;
  onChanged: () => void;
  onNavigate: (path: string) => void;
  notify: NotifyFn;
};

function kindStatus(kind: KindRow, active?: JobRow): { status: string; label?: string } {
  if (!kind.enabled) return { status: "disabled" };
  if (!kind.sourceRoot) return { status: "unbound" };
  if (active) return { status: active.status };
  return { status: "ready" };
}

function isKindMonitoring(kind: KindRow): boolean {
  return kind.enabled && Boolean(kind.sourceRoot?.trim());
}

function canRunKind(kind: KindRow, jobs: JobRow[]): { ok: boolean; reason?: string } {
  if (!kind.enabled) return { ok: false, reason: "分区未启用" };
  if (!kind.sourceRoot) return { ok: false, reason: "未绑定来源目录" };
  if (activeJobForKind(jobs, kind.id)) return { ok: false, reason: "该分区任务进行中" };
  return { ok: true };
}

function canPauseKind(active?: JobRow): { ok: boolean; reason?: string } {
  if (!active) return { ok: false, reason: "无进行中任务" };
  if (active.status === "paused") return { ok: false, reason: "任务已暂停" };
  if (active.status === "running" || active.status === "queued") return { ok: true };
  return { ok: false, reason: "无法暂停" };
}

export function KindTasksPage({ kinds, jobs, loading, onChanged, onNavigate, notify }: Props) {
  const [runningId, setRunningId] = useState<string | null>(null);
  const [pausingId, setPausingId] = useState<string | null>(null);

  const kindMap = useMemo(() => new Map(kinds.map((k) => [k.id, k])), [kinds]);

  const rows = useMemo(
    () =>
      KIND_ORDER.map((id) => kindMap.get(id)).filter((k): k is KindRow => Boolean(k)),
    [kindMap],
  );

  async function runKindTask(kind: KindRow) {
    const gate = canRunKind(kind, jobs);
    if (!gate.ok) {
      notify("warn", gate.reason ?? "无法运行");
      return;
    }
    setRunningId(kind.id);
    try {
      await createJob({
        kinds: [kind.id],
        mode: DEFAULT_MODE,
        options: { forceScan: true },
      });
      notify("ok", `已提交「${KIND_LABELS[kind.id] ?? kind.label}」任务（重扫 + 全流程）`);
      onChanged();
    } catch (e) {
      notify("error", e, "提交任务失败");
    } finally {
      setRunningId(null);
    }
  }

  async function pauseKindTask(kind: KindRow, active: JobRow) {
    const gate = canPauseKind(active);
    if (!gate.ok) {
      notify("warn", gate.reason ?? "无法暂停");
      return;
    }
    setPausingId(kind.id);
    try {
      await pauseJob(active.id);
      notify("warn", `已暂停「${KIND_LABELS[kind.id] ?? kind.label}」任务`);
      onChanged();
    } catch (e) {
      notify("error", e, "暂停任务失败");
    } finally {
      setPausingId(null);
    }
  }

  function openKindRecords(kind: KindRow, active?: JobRow) {
    onNavigate(recordsPathForKindTask(kind, jobs, active));
  }

  const enabledCount = rows.filter((k) => k.enabled).length;

  return (
    <div className="kind-tasks-page">
      <header className="kind-tasks-head">
        <div className="kind-tasks-head-left">
          <h1 className="kind-tasks-title">七区任务</h1>
          <span className="kind-tasks-summary">
            已启用 <strong>{enabledCount}</strong> / {rows.length} 区 · 默认{DEFAULT_MODE_LABEL}
          </span>
        </div>
      </header>

      <section className="panel kind-tasks-panel">
        <div className="jobs-table-wrap">
          <table className="jobs-table data-table kind-tasks-table">
            <colgroup>
              <col className="jobs-col-index" />
              <col className="kind-tasks-col-name" />
              <col className="jobs-col-mode" />
              <col className="kind-tasks-col-status" />
              <col className="jobs-col-progress" />
              <col className="jobs-col-op" />
            </colgroup>
            <thead>
              <tr>
                <th className="jobs-col-index">#</th>
                <th className="kind-tasks-col-name">分区</th>
                <th className="jobs-col-mode">整理模式</th>
                <th className="kind-tasks-col-status">状态</th>
                <th className="jobs-col-progress">进度</th>
                <th className="jobs-col-op">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((kind, idx) => {
                const active = activeJobForKind(jobs, kind.id);
                const gate = canRunKind(kind, jobs);
                const pauseGate = canPauseKind(active);
                const busy = runningId === kind.id;
                const pausing = pausingId === kind.id;
                const rowStatus = kindStatus(kind, active);
                const progressStats = active
                  ? jobProgressPills(active)
                  : kindHasIndexProgress(kind)
                    ? kindIndexProgressPills(kind.stats)
                    : null;
                const monitoring = isKindMonitoring(kind);
                return (
                  <tr
                    key={kind.id}
                    className={kind.enabled ? undefined : "kind-tasks-row-off"}
                  >
                    <td className="jobs-col-index">{idx + 1}</td>
                    <td
                      className="kind-tasks-col-name jobs-col-link"
                      role="button"
                      tabIndex={0}
                      title="查看该分区对应任务的刮削记录"
                      onClick={() => openKindRecords(kind, active)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openKindRecords(kind, active);
                        }
                      }}
                    >
                      <span className="kind-tasks-name">{KIND_LABELS[kind.id] ?? kind.label}</span>
                    </td>
                    <td className="jobs-col-mode">
                      <span className="jobs-mode-tag">{resolveKindOrganizeMode(kind)}</span>
                    </td>
                    <td className="kind-tasks-col-status">
                      {monitoring && !active ? (
                        <JobMonitoringTag />
                      ) : (
                        <StatusBadge
                          status={rowStatus.status}
                          map={{ ...JOB_TABLE_STATUS_LABELS, ...KIND_STATUS_LABELS }}
                        />
                      )}
                    </td>
                    <td
                      className="jobs-col-progress jobs-col-link"
                      role="button"
                      tabIndex={0}
                      title="查看该分区对应任务的刮削记录"
                      onClick={() => openKindRecords(kind, active)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openKindRecords(kind, active);
                        }
                      }}
                    >
                      {progressStats ? (
                        <JobProgressPills stats={progressStats} />
                      ) : (
                        <div className="jobs-stat-pills">
                          <span className="jobs-stat-pill jobs-stat-pill--total">未绑定</span>
                        </div>
                      )}
                    </td>
                    <td className="jobs-col-op">
                      <div className="kind-tasks-op-btns">
                        <button
                          type="button"
                          className="btn xs primary kind-tasks-run"
                          disabled={!gate.ok || busy || loading}
                          title={
                            gate.reason ??
                            "重扫来源目录并全流程处理；已有硬链接的文件跳过"
                          }
                          onClick={() => void runKindTask(kind)}
                        >
                          <PlayIcon className="kind-tasks-run-icon" aria-hidden />
                          {busy ? "提交中…" : "运行"}
                        </button>
                        <button
                          type="button"
                          className="btn xs warn kind-tasks-pause"
                          disabled={!pauseGate.ok || pausing || loading}
                          title={pauseGate.reason ?? "暂停该分区进行中任务"}
                          onClick={() => active && void pauseKindTask(kind, active)}
                        >
                          <PauseIcon className="kind-tasks-pause-icon" aria-hidden />
                          {pausing ? "暂停中…" : "暂停"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
