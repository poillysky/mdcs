import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type RecordsMenuItem = {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
};

type DropdownPos = {
  top: number;
  left: number;
};

type Props = {
  className?: string;
  panelClassName?: string;
  label: ReactNode;
  items: RecordsMenuItem[];
  onSelect: (id: string) => void;
  closeOnSelect?: boolean;
  align?: "left" | "right";
};

const DROPDOWN_GAP = 6;
const VIEWPORT_PAD = 8;

export function RecordsMenuDropdown({
  className,
  panelClassName,
  label,
  items,
  onSelect,
  closeOnSelect = false,
  align = "left",
}: Props) {
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<DropdownPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  function updateDropdownPos() {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = dropdownRef.current?.offsetWidth ?? 168;
    let left = align === "right" ? rect.right - width : rect.left;
    left = Math.min(Math.max(VIEWPORT_PAD, left), window.innerWidth - width - VIEWPORT_PAD);
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
  }, [open, align]);

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
            className={`records-menu-panel is-portal${align === "right" ? " align-right" : ""}${panelClassName ? ` ${panelClassName}` : ""}`}
            style={{
              top: `${dropdownPos.top}px`,
              left: `${dropdownPos.left}px`,
            }}
          >
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`records-menu-item${item.checked ? " is-checked" : ""}`}
                disabled={item.disabled}
                onClick={() => {
                  onSelect(item.id);
                  if (closeOnSelect) setOpen(false);
                }}
              >
                <span className="records-menu-check" aria-hidden />
                <span className="records-menu-item-label">{item.label}</span>
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className={`records-menu${open ? " is-open" : ""}${className ? ` ${className}` : ""}`}>
        <button
          ref={triggerRef}
          type="button"
          className="records-menu-trigger"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {label}
        </button>
      </div>
      {dropdownMenu}
    </>
  );
}
