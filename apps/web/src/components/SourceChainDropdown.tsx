import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/20/solid";
import {
  displayProviderName,
  groupCatalogForDropdown,
  providerAccessBadge,
} from "../lib/providerCatalogUi";
import type { ProviderCatalogRow } from "../types";

type Props = {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  catalog: ProviderCatalogRow[];
  emptyText?: string;
  disabled?: boolean;
};

type DragSession = {
  id: string;
  pointerId: number;
};

type GhostPos = {
  x: number;
  y: number;
};

type DropdownPos = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: "bottom" | "top";
};

const DRAG_THRESHOLD_PX = 4;
const DROPDOWN_GAP_PX = 4;
const DROPDOWN_MIN_HEIGHT = 140;
const VIEWPORT_EDGE_PAD = 12;
/** 底部保存栏 / safe area，避免向下展开被挡 */
const BOTTOM_ACTION_RESERVE = 80;

function moveItem(list: string[], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

function previewOrder(values: string[], dragId: string, overId: string | null): string[] {
  if (!overId || dragId === overId) return values;
  const from = values.indexOf(dragId);
  const to = values.indexOf(overId);
  if (from < 0 || to < 0) return values;
  return moveItem(values, from, to);
}

export function SourceChainDropdown({
  label,
  values,
  onChange,
  catalog,
  emptyText = "暂无源，请选择",
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [dragSession, setDragSession] = useState<DragSession | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [overId, setOverId] = useState<string | null>(null);
  const [ghostPos, setGhostPos] = useState<GhostPos | null>(null);
  const [dropdownPos, setDropdownPos] = useState<DropdownPos | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const valuesRef = useRef(values);
  const onChangeRef = useRef(onChange);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const ghostOffsetRef = useRef({ x: 0, y: 0 });
  const isDragActiveRef = useRef(false);
  const overIdRef = useRef<string | null>(null);

  valuesRef.current = values;
  onChangeRef.current = onChange;

  const groupedItems = useMemo(() => groupCatalogForDropdown(catalog), [catalog]);

  function updateDropdownPos() {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const preferredMax = Math.min(480, viewportH * 0.62);
    const spaceBelow =
      viewportH - rect.bottom - DROPDOWN_GAP_PX - BOTTOM_ACTION_RESERVE - VIEWPORT_EDGE_PAD;
    const spaceAbove = rect.top - DROPDOWN_GAP_PX - VIEWPORT_EDGE_PAD;

    const canOpenUp = spaceAbove >= DROPDOWN_MIN_HEIGHT;
    const canOpenDown = spaceBelow >= DROPDOWN_MIN_HEIGHT;

    // 下方空间不足、触发器偏下、或上方更宽 → 向上弹
    const preferUp =
      canOpenUp &&
      (spaceBelow < preferredMax ||
        spaceAbove > spaceBelow ||
        rect.bottom > viewportH * 0.52);

    let placement: DropdownPos["placement"] = preferUp ? "top" : "bottom";
    if (placement === "bottom" && !canOpenDown && canOpenUp) placement = "top";
    if (placement === "top" && !canOpenUp && canOpenDown) placement = "bottom";

    const available = placement === "top" ? spaceAbove : spaceBelow;
    const maxHeight = Math.min(preferredMax, Math.max(DROPDOWN_MIN_HEIGHT, available));

    const measured = dropdownRef.current?.getBoundingClientRect().height ?? 0;
    const panelHeight =
      measured > 0 ? Math.min(measured, maxHeight) : maxHeight;

    const top =
      placement === "bottom"
        ? rect.bottom + DROPDOWN_GAP_PX
        : Math.max(VIEWPORT_EDGE_PAD, rect.top - DROPDOWN_GAP_PX - panelHeight);

    setDropdownPos({
      top,
      left: rect.left,
      width: rect.width,
      maxHeight,
      placement,
    });
  }

  useLayoutEffect(() => {
    if (!open) {
      setDropdownPos(null);
      return;
    }
    let cancelled = false;
    updateDropdownPos();
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      updateDropdownPos();
      requestAnimationFrame(() => {
        if (!cancelled) updateDropdownPos();
      });
    });
    window.addEventListener("resize", updateDropdownPos);
    window.addEventListener("scroll", updateDropdownPos, true);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updateDropdownPos);
      window.removeEventListener("scroll", updateDropdownPos, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!dragSession) return;
    const session = dragSession;

    isDragActiveRef.current = false;
    overIdRef.current = session.id;
    setGhostPos(null);

    function findTagId(clientX: number, clientY: number): string | null {
      const el = document.elementFromPoint(clientX, clientY);
      const tagEl = el?.closest<HTMLElement>("[data-tag-id]");
      if (!tagEl || !summaryRef.current?.contains(tagEl)) return null;
      const id = tagEl.dataset.tagId ?? null;
      if (!id || id === session.id) return null;
      return id;
    }

    function cleanup() {
      setDragSession(null);
      setIsDragActive(false);
      setOverId(null);
      setGhostPos(null);
      isDragActiveRef.current = false;
      overIdRef.current = null;
      document.body.classList.remove("prio-tag-sorting");
    }

    function onPointerMove(e: PointerEvent) {
      if (e.pointerId !== session.pointerId) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (!isDragActiveRef.current) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        isDragActiveRef.current = true;
        setIsDragActive(true);
        document.body.classList.add("prio-tag-sorting");
      }
      e.preventDefault();
      setGhostPos({
        x: e.clientX - ghostOffsetRef.current.x,
        y: e.clientY - ghostOffsetRef.current.y,
      });
      const nextOver = findTagId(e.clientX, e.clientY) ?? overIdRef.current ?? session.id;
      overIdRef.current = nextOver;
      setOverId(nextOver);
    }

    function onPointerUp(e: PointerEvent) {
      if (e.pointerId !== session.pointerId) return;
      if (isDragActiveRef.current && overIdRef.current) {
        const next = previewOrder(valuesRef.current, session.id, overIdRef.current);
        onChangeRef.current(next);
      }
      cleanup();
    }

    function onPointerCancel(e: PointerEvent) {
      if (e.pointerId !== session.pointerId) return;
      cleanup();
    }

    document.addEventListener("pointermove", onPointerMove, { passive: false });
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerCancel);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerCancel);
      document.body.classList.remove("prio-tag-sorting");
    };
  }, [dragSession]);

  function toggle(id: string) {
    if (values.includes(id)) {
      onChange(values.filter((x) => x !== id));
      return;
    }
    onChange([...values, id]);
  }

  function openDropdown() {
    if (disabled) return;
    setOpen(true);
  }

  function toggleDropdown() {
    if (disabled) return;
    setOpen((v) => !v);
  }

  function onTagPointerDown(e: ReactPointerEvent<HTMLSpanElement>, id: string) {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    ghostOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    setDragSession({ id, pointerId: e.pointerId });
    setIsDragActive(false);
    setOverId(id);
  }

  const ghostLabel =
    dragSession && isDragActive ? displayProviderName(dragSession.id, catalog) : "";

  const dropdownMenu =
    open && dropdownPos ? (
      <div
        ref={dropdownRef}
        className={`prio-source-dropdown is-portal is-${dropdownPos.placement}`}
        style={{
          top: `${dropdownPos.top}px`,
          left: `${dropdownPos.left}px`,
          width: `${dropdownPos.width}px`,
          maxHeight: `${dropdownPos.maxHeight}px`,
        }}
        role="listbox"
        aria-label={label}
        aria-multiselectable="true"
      >
        <div className="prio-source-dropdown-scroll">
          {groupedItems.map((group) => (
            <section key={group.id} className="prio-source-dropdown-group">
              <h4 className="prio-source-dropdown-group-title">{group.label}</h4>
              {group.items.map((c) => {
                const selected = values.includes(c.id);
                const order = values.indexOf(c.id);
                const inactive = c.enabled === false;
                const access = providerAccessBadge(c.access);
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`prio-source-dropdown-opt${selected ? " is-selected" : ""}${
                      inactive ? " is-inactive" : ""
                    }`}
                    onClick={() => toggle(c.id)}
                  >
                    <span className="prio-source-dropdown-box" aria-hidden>
                      {selected ? (
                        <CheckIcon className="prio-source-dropdown-check-icon" />
                      ) : null}
                    </span>
                    <span className="prio-source-dropdown-opt-label">
                      {displayProviderName(c.id, catalog)}
                    </span>
                    <span
                      className={`prio-source-dropdown-badge prio-source-dropdown-badge--${access.kind}`}
                    >
                      {access.label}
                    </span>
                    <span
                      className="prio-source-dropdown-order"
                      aria-hidden={!selected || order < 0}
                    >
                      {selected && order >= 0 ? `#${order + 1}` : ""}
                    </span>
                  </button>
                );
              })}
            </section>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div className={`prio-compact-row${open ? " is-open" : ""}`} ref={wrapRef}>
      <span className="prio-compact-label">{label}</span>
      <div className="prio-compact-dropdown-wrap" ref={triggerRef}>
        <div className="prio-compact-trigger">
          <div
            className="prio-compact-summary"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-label={label}
          >
            <div
              ref={summaryRef}
              className={`prio-compact-summary-content${isDragActive ? " is-sorting" : ""}`}
              onClick={(e) => {
                if (disabled || isDragActive) return;
                if ((e.target as HTMLElement).closest(".prio-tag-draggable")) return;
                toggleDropdown();
              }}
            >
              {values.length ? (
                values.map((id) => {
                  const isDragging = isDragActive && dragSession?.id === id;
                  const isOver = isDragActive && overId === id && dragSession?.id !== id;
                  return (
                    <span
                      key={id}
                      data-tag-id={id}
                      className={`tag sm prio-tag prio-tag-draggable${isDragging ? " is-dragging" : ""}${
                        isOver ? " is-drag-over" : ""
                      }`}
                      title={`${id}（拖动调整优先级）`}
                      onPointerDown={(e) => onTagPointerDown(e, id)}
                    >
                      {displayProviderName(id, catalog)}
                    </span>
                  );
                })
              ) : (
                <button
                  type="button"
                  className="prio-compact-empty-btn"
                  disabled={disabled}
                  onClick={openDropdown}
                >
                  {emptyText}
                </button>
              )}
            </div>
            <button
              type="button"
              className="prio-compact-chevron-btn"
              disabled={disabled}
              aria-label={`展开 ${label}`}
              onClick={toggleDropdown}
            >
              <ChevronDownIcon className="prio-compact-chevron" aria-hidden />
            </button>
          </div>
        </div>
      </div>
      {dropdownMenu ? createPortal(dropdownMenu, document.body) : null}
      {isDragActive && ghostPos && ghostLabel
        ? createPortal(
            <span
              className="tag sm prio-tag prio-tag-ghost"
              style={{ left: `${ghostPos.x}px`, top: `${ghostPos.y}px` }}
            >
              {ghostLabel}
            </span>,
            document.body,
          )
        : null}
    </div>
  );
}
