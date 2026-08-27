import { useEffect, useState } from "react";
import { Modal } from "./Modal";

export type RecordsBatchActionKind = "stop" | "retry" | "delete";

export type RecordsBatchRetryMode = "rescrape" | "reorganize";

type Props = {
  open: boolean;
  action: RecordsBatchActionKind;
  count: number;
  onClose: () => void;
  onConfirm: (opts: { action: RecordsBatchActionKind; retryMode?: RecordsBatchRetryMode }) => void;
};

const ACTION_META: Record<
  RecordsBatchActionKind,
  { title: string; confirmLabel: string; danger?: boolean }
> = {
  stop: { title: "停止任务", confirmLabel: "确认停止" },
  retry: { title: "重试 / 重新整理", confirmLabel: "确认重试" },
  delete: { title: "删除任务", confirmLabel: "确认删除", danger: true },
};

export function RecordsBatchActionModal({ open, action, count, onClose, onConfirm }: Props) {
  const [retryMode, setRetryMode] = useState<RecordsBatchRetryMode>("rescrape");
  const meta = ACTION_META[action];

  useEffect(() => {
    if (!open) return;
    setRetryMode("rescrape");
  }, [open, action]);

  function submit() {
    onConfirm({
      action,
      retryMode: action === "retry" ? retryMode : undefined,
    });
  }

  return (
    <Modal
      open={open}
      title={meta.title}
      subtitle={`对 ${count} 个任务执行操作`}
      variant="sheet"
      padded={action === "retry"}
      className={`modal-task-action modal-batch-action${action === "retry" ? "" : " modal-batch-action--confirm"}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn text rd-task-cancel" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className={`btn primary solid rd-task-confirm${meta.danger ? " is-danger" : ""}`}
            onClick={submit}
          >
            {meta.confirmLabel}
          </button>
        </>
      }
    >
      {action === "retry" ? (
        <div className="rd-task-form">
          <div className="rd-task-options" role="radiogroup" aria-label="操作类型">
            <label className={`rd-task-option${retryMode === "rescrape" ? " is-active" : ""}`}>
              <input
                type="radio"
                name="records-batch-retry-mode"
                checked={retryMode === "rescrape"}
                onChange={() => setRetryMode("rescrape")}
              />
              <span className="rd-task-radio" aria-hidden />
              <span className="rd-task-option-body">
                <span className="rd-task-option-title">重试刮削</span>
                <span className="rd-task-option-desc">重新从网络刮削元数据并整理文件</span>
              </span>
            </label>

            <label className={`rd-task-option${retryMode === "reorganize" ? " is-active" : ""}`}>
              <input
                type="radio"
                name="records-batch-retry-mode"
                checked={retryMode === "reorganize"}
                onChange={() => setRetryMode("reorganize")}
              />
              <span className="rd-task-radio" aria-hidden />
              <span className="rd-task-option-body">
                <span className="rd-task-option-title">重新整理</span>
                <span className="rd-task-option-desc">使用当前配置重新生成目录结构、文件名和 NFO</span>
              </span>
            </label>
          </div>

          <p className="rd-task-batch-hint">批量重试不支持手动指定番号或页面链接</p>
        </div>
      ) : null}
    </Modal>
  );
}
