import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import type { FileRow } from "../../types";
import {
  isFileReorganizable,
  isFileRetryable,
  isFileStopable,
} from "./recordsDisplay";

type RowMenuProps = {
  file: FileRow;
  busy?: boolean;
  onView: () => void;
  onRetry: () => void;
  onStop: () => void;
  onReorganize: () => void;
  onDelete: () => void;
};

const RECORDS_DROPDOWN_GAP = 4;
const RECORDS_VIEWPORT_PAD = 8;

type DropdownPos = {
  top: number;
  left: number;
};

type RowMenuAction = "view" | "retry" | "stop" | "reorganize" | "delete";

export function RecordsRowMenu({
  file,
  busy,
  onView,
  onRetry,
  onStop,
  onReorganize,
  onDelete,
}: RowMenuProps) {
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<DropdownPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const canStop = isFileStopable(file.status);
  const canReorganize = isFileReorganizable(file);
  const canRetry = isFileRetryable(file.status);

  const items: Array<{
    id: RowMenuAction;
    label: string;
    disabled?: boolean;
    title?: string;
  }> = [
    { id: "view", label: "查看", disabled: busy },
    {
      id: "retry",
      label: "重试",
      disabled: !canRetry || busy,
      title: canRetry ? undefined : "仅失败或已取消记录可重试",
    },
    {
      id: "stop",
      label: "终止",
      disabled: !canStop || busy,
      title: canStop ? undefined : "无进行中的任务",
    },
    {
      id: "reorganize",
      label: "重新整理",
      disabled: !canReorganize || busy,
      title: canReorganize ? undefined : "需有番号",
    },
    { id: "delete", label: "删除", disabled: busy },
  ];

  function run(action: RowMenuAction) {
    setOpen(false);
    if (action === "view") onView();
    if (action === "retry") onRetry();
    if (action === "stop") onStop();
    if (action === "reorganize") onReorganize();
    if (action === "delete") onDelete();
  }

  function updateDropdownPos() {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = dropdownRef.current?.offsetWidth ?? 128;
    const height = dropdownRef.current?.offsetHeight ?? 200;
    const left = Math.min(
      Math.max(RECORDS_VIEWPORT_PAD, rect.right - width),
      window.innerWidth - width - RECORDS_VIEWPORT_PAD,
    );
    const spaceBelow = window.innerHeight - rect.bottom - RECORDS_DROPDOWN_GAP;
    const spaceAbove = rect.top - RECORDS_DROPDOWN_GAP;
    const showAbove = spaceBelow < height && spaceAbove > spaceBelow;
    const top = showAbove
      ? rect.top - height - RECORDS_DROPDOWN_GAP
      : rect.bottom + RECORDS_DROPDOWN_GAP;
    setDropdownPos({ top, left });
  }

  useLayoutEffect(() => {
    if (!open) {
      setDropdownPos(null);
      return;
    }
    updateDropdownPos();
    const raf = requestAnimationFrame(updateDropdownPos);
    window.addEventListener("resize", updateDropdownPos);
    window.addEventListener("scroll", updateDropdownPos, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updateDropdownPos);
      window.removeEventListener("scroll", updateDropdownPos, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const dropdownMenu =
    open && dropdownPos
      ? createPortal(
          <div
            ref={dropdownRef}
            className="records-actions-dropdown is-portal"
            role="menu"
            style={{
              top: `${dropdownPos.top}px`,
              left: `${dropdownPos.left}px`,
            }}
          >
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className="records-actions-item"
                disabled={item.disabled}
                title={item.title}
                onClick={() => run(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className={`records-actions-menu${open ? " is-open" : ""}`}>
        <button
          ref={triggerRef}
          type="button"
          className="records-actions-trigger"
          aria-label="操作"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <EllipsisVerticalIcon aria-hidden />
        </button>
      </div>
      {dropdownMenu}
    </>
  );
}
