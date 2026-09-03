import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import type { FileRow } from "../types";

export type RecordTaskActionMode = "rescrape" | "reorganize";

export type RecordTaskActionOptions = {
  mode: RecordTaskActionMode;
  /** 日志分类：重试刮削→retry，重新整理→reorganize */
  kind?: "retry" | "rescrape" | "reorganize";
  code?: string;
  pageUrl?: string;
};

type Props = {
  open: boolean;
  file: FileRow;
  onClose: () => void;
  onConfirm: (opts: RecordTaskActionOptions) => void;
};

export function RecordTaskActionModal({ open, file, onClose, onConfirm }: Props) {
  const displayCode = file.code || file.file_name || `#${file.id}`;
  const [mode, setMode] = useState<RecordTaskActionMode>("rescrape");
  const [code, setCode] = useState("");
  const [pageUrl, setPageUrl] = useState("");

  useEffect(() => {
    if (!open) return;
    setMode("rescrape");
    setCode("");
    setPageUrl("");
  }, [open, file.id]);

  function submit() {
    onConfirm({
      mode,
      kind: mode === "reorganize" ? "reorganize" : "retry",
      code: code.trim() || undefined,
      pageUrl: mode === "rescrape" && pageUrl.trim() ? pageUrl.trim() : undefined,
    });
  }

  return (
    <Modal
      open={open}
      title={`任务操作 - ${displayCode}`}
      variant="sheet"
      padded
      className="modal-task-action"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn text rd-task-cancel" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn primary solid rd-task-confirm" onClick={submit}>
            确认重试
          </button>
        </>
      }
    >
      <div className="rd-task-form">
        <div className="rd-task-options" role="radiogroup" aria-label="操作类型">
          <label className={`rd-task-option${mode === "rescrape" ? " is-active" : ""}`}>
            <input
              type="radio"
              name="rd-task-mode"
              checked={mode === "rescrape"}
              onChange={() => setMode("rescrape")}
            />
            <span className="rd-task-radio" aria-hidden />
            <span className="rd-task-option-body">
              <span className="rd-task-option-title">重试刮削</span>
              <span className="rd-task-option-desc">重新刮削元数据、下载封面并生成 NFO</span>
            </span>
          </label>

          <label className={`rd-task-option${mode === "reorganize" ? " is-active" : ""}`}>
            <input
              type="radio"
              name="rd-task-mode"
              checked={mode === "reorganize"}
              onChange={() => setMode("reorganize")}
            />
            <span className="rd-task-radio" aria-hidden />
            <span className="rd-task-option-body">
              <span className="rd-task-option-title">重新整理</span>
              <span className="rd-task-option-desc">按当前配置重新生成片库目录、转移文件与海报</span>
            </span>
          </label>
        </div>

        <div className="rd-task-fields">
          <label className="rd-task-field">
            <span className="rd-task-field-label">手动指定番号</span>
            <input
              type="text"
              className="rd-task-input"
              placeholder="留空则重新解析番号"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>

          <label className={`rd-task-field${mode !== "rescrape" ? " is-disabled" : ""}`}>
            <span className="rd-task-field-label">指定页面刮削</span>
            <input
              type="url"
              className="rd-task-input"
              placeholder="详情页面链接"
              value={pageUrl}
              disabled={mode !== "rescrape"}
              onChange={(e) => setPageUrl(e.target.value)}
            />
          </label>
        </div>
      </div>
    </Modal>
  );
}
