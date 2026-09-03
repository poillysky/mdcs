import { CheckIcon } from "@heroicons/react/24/solid";
import { pipelineRunLabel } from "./pipelineLog";
import type { LogRunOption, LogStep } from "./types";

type Props = {
  logRunOptions: LogRunOption[];
  pipelineSteps: LogStep[] | null;
  selectedRunId: string;
  selectedLogRun: LogRunOption | null;
  latestLogRun: LogRunOption | undefined;
  logSteps: LogStep[];
  highlightSource: string | null;
  onSelectRun: (id: string) => void;
};

export function RecordDetailLogPanel({
  logRunOptions,
  pipelineSteps,
  selectedRunId,
  selectedLogRun,
  latestLogRun,
  logSteps,
  highlightSource,
  onSelectRun,
}: Props) {
  return (
    <section className="record-detail-panel">
      <h2 className="record-detail-section-title">刮削日志</h2>
      {logRunOptions.length > 0 ? (
        <div className="record-detail-log-select-wrap">
          <select
            className="record-detail-log-select"
            aria-label="选择日志记录"
            value={
              pipelineSteps !== null
                ? "__live__"
                : selectedLogRun?.id ||
                  (selectedRunId !== "__live__" ? selectedRunId : "") ||
                  latestLogRun?.id ||
                  ""
            }
            disabled={pipelineSteps !== null}
            onChange={(e) => {
              const id = e.target.value;
              if (id === "__live__") return;
              onSelectRun(id);
            }}
          >
            {pipelineSteps !== null ? (
              <option value="__live__">进行中…</option>
            ) : null}
            {logRunOptions.map((run) => (
              <option key={run.id} value={run.id}>
                {pipelineRunLabel(run.kind, run.at)}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="record-detail-log">
        {logSteps.length === 0 && pipelineSteps !== null ? (
          <p className="hint">任务进行中，等待日志…</p>
        ) : null}
        {logSteps.map((step) => (
          <div key={step.title} className={`record-detail-log-step${step.done ? " is-done" : ""}`}>
            <div className="record-detail-log-head">
              <span className="record-detail-log-node" aria-hidden>
                {step.done ? <CheckIcon /> : null}
              </span>
              <h3>{step.title}</h3>
            </div>
            <ul className="record-detail-log-items">
              {step.items.map((item, i) => {
                const highlighted =
                  Boolean(highlightSource) &&
                  item.text.toLowerCase().includes(`<${highlightSource!.toLowerCase()}>`);
                return (
                  <li
                    key={i}
                    className={`record-detail-log-item tone-${item.tone}${highlighted ? " is-highlight" : ""}`}
                  >
                    {item.text}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
