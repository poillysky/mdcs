import { useEffect, useMemo, useState } from "react";
import { ArrowLeftIcon, ChevronRightIcon, FolderIcon } from "@heroicons/react/24/solid";
import { fetchIndexFolders } from "../api";
import type { IndexFolder } from "../types";
import { displayRelativePath, normalizeRelativePath } from "../lib/paths";
import { Modal } from "./Modal";

type Props = {
  value: string;
  onChange: (relative: string) => void;
  usedBy?: Map<string, string>;
  currentLabel?: string;
  onError: (message: string) => void;
  variant?: "default" | "inline";
  placeholder?: string;
  pickerTitle?: string;
};

function displayPath(relative: string): string {
  return displayRelativePath(relative);
}

export function FolderPicker({
  value,
  onChange,
  usedBy,
  currentLabel,
  onError,
  variant = "default",
  placeholder = "未绑定",
  pickerTitle = "选择目录",
}: Props) {
  const [open, setOpen] = useState(false);
  const [browsePath, setBrowsePath] = useState("");
  const [pendingPath, setPendingPath] = useState("");
  const [folders, setFolders] = useState<IndexFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");

  async function load(nextParent: string, opts?: { keepPending?: boolean }) {
    setLoading(true);
    try {
      const data = await fetchIndexFolders(nextParent);
      const parent = data.parent ?? "";
      setBrowsePath(parent);
      setFolders(data.folders);
      if (!opts?.keepPending) {
        setPendingPath(parent);
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    setFilter("");
    const norm = value.replace(/\\/g, "/").replace(/^\/+/, "");
    const start = norm.includes("/") ? norm.slice(0, norm.lastIndexOf("/")) : norm;
    setPendingPath(norm);
    void load(start, { keepPending: Boolean(norm) });
  }, [open]);

  const filteredFolders = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((f) => f.name.toLowerCase().includes(q));
  }, [filter, folders]);

  const parentPath = browsePath.includes("/")
    ? browsePath.slice(0, browsePath.lastIndexOf("/"))
    : "";

  function enterFolder(folder: IndexFolder) {
    setPendingPath(folder.relative);
    void load(folder.relative);
  }

  function goUp() {
    void load(parentPath);
    setPendingPath(parentPath);
  }

  function confirmPick() {
    onChange(pendingPath.trim());
    setOpen(false);
  }

  function openPicker() {
    setOpen(true);
  }

  return (
    <div className={`folder-picker${variant === "inline" ? " folder-picker--inline" : ""}`}>
      {variant === "inline" ? (
        <div className="create-job-path-row">
          <div
            className={`create-job-path-value mono${value ? "" : " is-empty"}`}
            title={value || undefined}
          >
            {value ? displayPath(value) : placeholder}
          </div>
          <button
            type="button"
            className="create-job-path-btn"
            aria-label={pickerTitle}
            onClick={openPicker}
          >
            <FolderIcon aria-hidden />
          </button>
        </div>
      ) : (
        <div className="folder-picker-summary">
          <span className={value ? "folder-path" : "folder-path is-empty"} title={value || undefined}>
            {value || placeholder}
          </span>
          <button type="button" className="btn sm" onClick={openPicker}>
            选择目录
          </button>
        </div>
      )}

      <Modal
        open={open}
        variant="sheet"
        title={pickerTitle}
        padded
        className="modal-folder-picker"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn text" onClick={() => setOpen(false)}>
              取消
            </button>
            <button
              type="button"
              className="btn primary solid"
              disabled={!pendingPath.trim()}
              onClick={confirmPick}
            >
              确认
            </button>
          </>
        }
      >
        <div className="folder-picker-sheet">
          <input
            className="folder-picker-filter"
            placeholder="文件名过滤"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />

          <div className="folder-picker-list" role="listbox" aria-label={pickerTitle}>
            {browsePath ? (
              <button
                type="button"
                className="folder-picker-item folder-picker-item--up"
                onClick={goUp}
                title="返回上级"
              >
                <span className="folder-picker-up-icon" aria-hidden>
                  <ArrowLeftIcon />
                </span>
                <span className="folder-picker-item-name">
                  返回上级
                  <em> · {browsePath.split("/").filter(Boolean).at(-1) || "项目根"}</em>
                </span>
              </button>
            ) : null}

            {loading ? <div className="folder-picker-empty">读取中…</div> : null}

            {!loading && filteredFolders.length === 0 ? (
              <div className="folder-picker-empty">
                {filter.trim() ? "没有匹配的目录" : "这一层没有子目录"}
              </div>
            ) : null}

            {!loading
              ? filteredFolders.map((f) => {
                  const used = usedBy?.get(f.relative.replace(/\\/g, "/").replace(/^\/+/, ""));
                  const extra = used && used !== currentLabel ? ` · 已用于${used}` : "";
                  const active = pendingPath === f.relative;
                  return (
                    <button
                      key={f.relative}
                      type="button"
                      className={`folder-picker-item${active ? " is-active" : ""}`}
                      onClick={() => enterFolder(f)}
                    >
                      <ChevronRightIcon className="folder-picker-chevron" aria-hidden />
                      <span className="folder-picker-item-name">
                        {f.name}
                        {extra ? <em>{extra}</em> : null}
                      </span>
                    </button>
                  );
                })
              : null}
          </div>

          <div className="folder-picker-current">
            当前选择: <span className="mono">{displayPath(pendingPath)}</span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
