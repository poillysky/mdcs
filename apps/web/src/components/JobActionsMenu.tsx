import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import type { JobRow } from "../types";

type Action = "terminate" | "restart" | "copy" | "delete";

type DropdownPos = {
  top: number;
  left: number;
};

type Props = {
  job: JobRow;
  busy?: boolean;
  onTerminate?: () => void;
  onRestart?: () => void;
  onCopy?: () => void;
  onDelete?: () => void;
};

const DROPDOWN_GAP = 4;
const VIEWPORT_PAD = 8;

function canTerminate(job: JobRow): boolean {
  return job.status === "running" || job.status === "queued" || job.status === "paused";
}

function canRestart(job: JobRow): boolean {
  return job.status === "paused" || job.status === "done" || job.status === "failed" || job.status === "cancelled";
}

function canDelete(job: JobRow): boolean {
  return job.status !== "running" && job.status !== "queued";
}

export function JobActionsMenu({ job, busy, onTerminate, onRestart, onCopy, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<DropdownPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  function updateDropdownPos() {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = dropdownRef.current?.offsetWidth ?? 112;
    const left = Math.min(
      Math.max(VIEWPORT_PAD, rect.right - width),
      window.innerWidth - width - VIEWPORT_PAD,
    );
    setDropdownPos({
      top: rect.bottom + DROPDOWN_GAP,
      left,
    });
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

  function run(action: Action) {
    setOpen(false);
    if (action === "terminate") onTerminate?.();
    if (action === "restart") onRestart?.();
    if (action === "copy") onCopy?.();
    if (action === "delete") onDelete?.();
  }

  const items: Array<{
    id: Action;
    label: string;
    disabled?: boolean;
    title?: string;
    danger?: boolean;
  }> = [
    {
      id: "terminate",
      label: "停止",
      disabled: !canTerminate(job) || busy,
      title: canTerminate(job) ? undefined : "任务已结束",
    },
    {
      id: "restart",
      label: job.status === "paused" ? "继续" : "重启",
      disabled: !canRestart(job) || busy,
      title: canRestart(job) ? undefined : "任务进行中",
    },
    { id: "copy", label: "复制", disabled: busy },
    {
      id: "delete",
      label: "删除",
      disabled: !canDelete(job) || busy,
      title: canDelete(job) ? undefined : "请先停止任务",
      danger: true,
    },
  ];

  const dropdownMenu =
    open && dropdownPos
      ? createPortal(
          <div
            ref={dropdownRef}
            className="jobs-actions-dropdown is-portal"
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
                className={`jobs-actions-item${item.danger ? " is-danger" : ""}`}
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
      <div className={`jobs-actions-menu${open ? " is-open" : ""}`}>
        <button
          ref={triggerRef}
          type="button"
          className="jobs-actions-trigger"
          aria-label="任务操作"
          aria-expanded={open}
          disabled={busy}
          onClick={() => setOpen((v) => !v)}
        >
          <EllipsisVerticalIcon aria-hidden />
        </button>
      </div>
      {dropdownMenu}
    </>
  );
}
