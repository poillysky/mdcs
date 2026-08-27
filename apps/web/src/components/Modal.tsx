import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { lockBodyScroll } from "../lib/lockBodyScroll";

type Props = {
  open: boolean;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  wide?: boolean;
  /** 卡片式弹窗：标题/正文/底栏同一白底，无分隔条 */
  variant?: "default" | "sheet";
  /** 表单弹窗：正文区按设置页留白 */
  padded?: boolean;
  className?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function Modal({
  open,
  title,
  subtitle,
  icon,
  wide,
  variant = "default",
  padded,
  className,
  onClose,
  children,
  footer,
}: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const unlock = lockBodyScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      unlock();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className={`modal${wide ? " modal-wide" : ""}${variant === "sheet" ? " modal-sheet" : ""}${padded ? " modal-padded" : ""}${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <div className="modal-head-main">
            {icon ? <div className="modal-head-icon">{icon}</div> : null}
            <div className="modal-head-text">
              <h2 id="modal-title">{title}</h2>
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-foot">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
