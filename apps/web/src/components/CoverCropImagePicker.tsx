import { useEffect, useMemo, useState } from "react";
import { ArrowLeftIcon, ChevronRightIcon, PhotoIcon } from "@heroicons/react/24/solid";
import { fetchCoverCropBrowse, type CoverCropBrowseEntry } from "../api";
import { displayRelativePath } from "../lib/paths";
import { Modal } from "./Modal";

type Props = {
  open: boolean;
  fileId: number;
  initialPath?: string;
  onClose: () => void;
  onPick: (relativePath: string) => void;
  onError: (message: string) => void;
};

export function CoverCropImagePicker({
  open,
  fileId,
  initialPath = "",
  onClose,
  onPick,
  onError,
}: Props) {
  const [browsePath, setBrowsePath] = useState("");
  const [pendingFile, setPendingFile] = useState("");
  const [folders, setFolders] = useState<CoverCropBrowseEntry[]>([]);
  const [files, setFiles] = useState<CoverCropBrowseEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");

  async function load(nextParent: string, opts?: { keepPending?: boolean }) {
    setLoading(true);
    try {
      const data = await fetchCoverCropBrowse(fileId, nextParent);
      const parent = data.parent ?? "";
      setBrowsePath(parent);
      setFolders(data.folders);
      setFiles(data.files);
      if (!opts?.keepPending) setPendingFile("");
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    setFilter("");
    const norm = initialPath.replace(/\\/g, "/").replace(/^\/+/, "");
    const start = norm.includes("/") ? norm.slice(0, norm.lastIndexOf("/")) : "";
    const fileName = norm.includes("/") ? norm.slice(norm.lastIndexOf("/") + 1) : norm;
    const looksLikeFile = /\.(jpe?g|png|webp|gif|bmp)$/i.test(fileName);
    setPendingFile(looksLikeFile ? norm : "");
    void load(start || "", { keepPending: looksLikeFile });
  }, [open, fileId]);

  const filteredFolders = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((f) => f.name.toLowerCase().includes(q));
  }, [filter, folders]);

  const filteredFiles = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => f.name.toLowerCase().includes(q));
  }, [filter, files]);

  const parentPath = browsePath.includes("/")
    ? browsePath.slice(0, browsePath.lastIndexOf("/"))
    : "";

  function confirmPick() {
    if (!pendingFile.trim()) return;
    onPick(pendingFile.trim());
    onClose();
  }

  return (
    <Modal
      open={open}
      variant="sheet"
      title="选择原图"
      padded
      className="modal-folder-picker"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn text" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn primary solid"
            disabled={!pendingFile.trim()}
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

        <div className="folder-picker-list" role="listbox" aria-label="选择原图">
          {browsePath ? (
            <button
              type="button"
              className="folder-picker-item folder-picker-item--up"
              onClick={() => {
                setPendingFile("");
                void load(parentPath);
              }}
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

          {!loading && filteredFolders.length === 0 && filteredFiles.length === 0 ? (
            <div className="folder-picker-empty">
              {filter.trim() ? "没有匹配的目录或图片" : "这一层没有子目录或图片"}
            </div>
          ) : null}

          {!loading
            ? filteredFolders.map((f) => (
                <button
                  key={`d:${f.relative}`}
                  type="button"
                  className="folder-picker-item"
                  onClick={() => {
                    setPendingFile("");
                    void load(f.relative);
                  }}
                >
                  <ChevronRightIcon className="folder-picker-chevron" aria-hidden />
                  <span className="folder-picker-item-name">{f.name}</span>
                </button>
              ))
            : null}

          {!loading
            ? filteredFiles.map((f) => {
                const active = pendingFile === f.relative;
                return (
                  <button
                    key={`f:${f.relative}`}
                    type="button"
                    className={`folder-picker-item folder-picker-item--file${active ? " is-active" : ""}`}
                    onClick={() => setPendingFile(f.relative)}
                    onDoubleClick={() => {
                      onPick(f.relative);
                      onClose();
                    }}
                  >
                    <PhotoIcon className="folder-picker-file-icon" aria-hidden />
                    <span className="folder-picker-item-name">{f.name}</span>
                  </button>
                );
              })
            : null}
        </div>

        <div className="folder-picker-current">
          当前选择:{" "}
          <span className="mono">
            {pendingFile ? displayRelativePath(pendingFile) : "未选择图片"}
          </span>
        </div>
      </div>
    </Modal>
  );
}
