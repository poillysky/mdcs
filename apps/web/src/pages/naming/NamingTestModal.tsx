import { Modal } from "../../components/Modal";
import type { PreviewResult } from "./types";

export function NamingTestModal({
  open,
  onClose,
  testCode,
  setTestCode,
  testMosaic,
  setTestMosaic,
  testHasSub,
  setTestHasSub,
  testResolution,
  setTestResolution,
  preview,
  runPreview,
}: {
  open: boolean;
  onClose: () => void;
  testCode: string;
  setTestCode: (v: string) => void;
  testMosaic: string;
  setTestMosaic: (v: string) => void;
  testHasSub: boolean;
  setTestHasSub: (v: boolean) => void;
  testResolution: string;
  setTestResolution: (v: string) => void;
  preview: PreviewResult | null;
  runPreview: () => void | Promise<void>;
}) {
  return (
    <Modal
      open={open}
      title="命名测试"
      subtitle="用当前未保存的模板规则预览路径与标题"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            关闭
          </button>
          <button type="button" className="btn primary" onClick={() => void runPreview()}>
            生成预览
          </button>
        </>
      }
    >
      <div className="naming-test-modal">
        <div className="naming-test-modal-grid">
          <label className="naming-test-field">
            <span>番号</span>
            <input
              className="org-input"
              value={testCode}
              onChange={(e) => setTestCode(e.target.value)}
            />
          </label>
          <label className="naming-test-field">
            <span>马赛克</span>
            <input
              className="org-input"
              value={testMosaic}
              onChange={(e) => setTestMosaic(e.target.value)}
            />
          </label>
          <label className="naming-test-field">
            <span>分辨率</span>
            <select
              className="org-input"
              value={testResolution}
              onChange={(e) => setTestResolution(e.target.value)}
            >
              {["720P", "1080P", "4K", "8K"].map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className="naming-test-switch">
            <span>有字幕</span>
            <label className="switch inline">
              <input
                type="checkbox"
                checked={testHasSub}
                onChange={(e) => setTestHasSub(e.target.checked)}
              />
              <span />
            </label>
          </label>
        </div>
        <div className={`naming-preview${preview ? " has-result" : ""}`}>
          {preview ? (
            <>
              <div className="naming-preview-row">
                <span>路径</span>
                <code>{preview.targetRel}</code>
              </div>
              <div className="naming-preview-row">
                <span>标题</span>
                <code>{preview.mediaTitle || "-"}</code>
              </div>
            </>
          ) : (
            <p className="naming-preview-empty">填写样例后点「生成预览」</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
