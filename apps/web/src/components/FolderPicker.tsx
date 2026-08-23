import { useEffect, useState } from "react";
import { fetchIndexFolders } from "../api";
import type { IndexFolder } from "../types";
import { Modal } from "./Modal";

type Props = {
  value: string;
  onChange: (relative: string) => void;
  usedBy?: Map<string, string>;
  currentLabel?: string;
  onError: (message: string) => void;
};

export function FolderPicker({ value, onChange, usedBy, currentLabel, onError }: Props) {
  const [open, setOpen] = useState(false);
  const [parent, setParent] = useState("");
  const [folders, setFolders] = useState<IndexFolder[]>([]);
  const [loading, setLoading] = useState(false);

  async function load(nextParent: string) {
    setLoading(true);
    try {
      const data = await fetchIndexFolders(nextParent);
      setParent(data.parent);
      setFolders(data.folders);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    const start = value.includes("/") ? value.slice(0, value.lastIndexOf("/")) : "";
    void load(start);
  }, [open]);

  const crumbs = parent ? parent.split("/") : [];

  function goCrumb(index: number) {
    if (index < 0) {
      void load("");
      return;
    }
    void load(crumbs.slice(0, index + 1).join("/"));
  }

  function pick(relative: string) {
    onChange(relative);
    setOpen(false);
  }

  function clear() {
    onChange("");
    setOpen(false);
  }

  return (
    <div className="folder-picker">
      <div className="folder-picker-summary">
        <span className={value ? "folder-path" : "folder-path is-empty"} title={value || undefined}>
          {value || "未绑定"}
        </span>
        <button type="button" className="btn sm" onClick={() => setOpen(true)}>
          选择目录
        </button>
      </div>

      <Modal
        open={open}
        title="选择目录"
        subtitle="浏览项目下的文件夹并选用"
        wide
        onClose={() => setOpen(false)}
        footer={
          <>
            {value ? (
              <button type="button" className="btn ghost folder-clear" onClick={clear}>
                清除绑定
              </button>
            ) : null}
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              取消
            </button>
          </>
        }
      >
        <div className="folder-browser">
          <div className="folder-crumbs">
            <button type="button" className="crumb" onClick={() => goCrumb(-1)}>
              项目根
            </button>
            {crumbs.map((part, i) => (
              <span key={`${part}-${i}`}>
                <span className="crumb-sep">/</span>
                <button type="button" className="crumb" onClick={() => goCrumb(i)}>
                  {part}
                </button>
              </span>
            ))}
          </div>

          <div className="folder-list">
            {parent ? (
              <button type="button" className="folder-row" onClick={() => goCrumb(crumbs.length - 2)}>
                返回上级
              </button>
            ) : null}

            {parent ? (
              <button
                type="button"
                className={`folder-row pick${value === parent ? " selected" : ""}`}
                onClick={() => pick(parent)}
              >
                选用当前目录
              </button>
            ) : null}

            {loading ? <div className="folder-empty">读取中…</div> : null}

            {!loading && folders.length === 0 ? (
              <div className="folder-empty">这一层没有子目录</div>
            ) : null}

            {!loading
              ? folders.map((f) => {
                  const used = usedBy?.get(f.relative);
                  const extra = used && used !== currentLabel ? ` · 已用于${used}` : "";
                  return (
                    <div
                      key={f.relative}
                      className={`folder-row${value === f.relative ? " selected" : ""}`}
                    >
                      <button
                        type="button"
                        className="folder-enter"
                        onClick={() => void load(f.relative)}
                      >
                        {f.name}
                        {extra}
                      </button>
                      <button type="button" className="btn xs" onClick={() => pick(f.relative)}>
                        选用
                      </button>
                    </div>
                  );
                })
              : null}
          </div>
        </div>
      </Modal>
    </div>
  );
}
