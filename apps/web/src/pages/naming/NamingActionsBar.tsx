import type { RefObject } from "react";

export function NamingActionsBar({
  embedded,
  saving,
  dirty = true,
  fileImportRef,
  onExport,
  onImport,
  onTest,
  onSave,
}: {
  embedded: boolean;
  saving: boolean;
  dirty?: boolean;
  fileImportRef: RefObject<HTMLInputElement | null>;
  onExport: () => void;
  onImport: (file: File) => void;
  onTest: () => void;
  onSave: () => void | Promise<void>;
}) {
  return (
    <div className="page-save-row naming-actions">
      <button type="button" className="btn" onClick={onExport}>
        导出
      </button>
      <button type="button" className="btn" onClick={() => fileImportRef.current?.click()}>
        导入
      </button>
      <input
        ref={fileImportRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImport(f);
          e.target.value = "";
        }}
      />
      <button type="button" className="btn" onClick={onTest}>
        命名测试
      </button>
      {!embedded ? (
        <button
          type="button"
          className="btn primary"
          disabled={!dirty || saving}
          onClick={() => void onSave()}
        >
          {saving ? "保存中…" : "保存配置"}
        </button>
      ) : null}
    </div>
  );
}
