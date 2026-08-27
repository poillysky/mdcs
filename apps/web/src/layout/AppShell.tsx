import { useEffect, useState, type ReactNode } from "react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/solid";
import { NAV_ICONS } from "../lib/navIcons";
import { lockBodyScroll } from "../lib/lockBodyScroll";
import { NAV_ITEMS } from "../lib/routes";
import type { RouteId } from "../lib/routes";

/** 与 styles.css 中 960px 断点对齐：>960 为桌面 */
const DESKTOP_MQ = "(min-width: 961px)";

type Props = {
  route: RouteId;
  onNavigate: (path: string) => void;
  children: ReactNode;
};

function getIsDesktop() {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia(DESKTOP_MQ).matches;
}

function NavButton({
  itemId,
  label,
  path,
  active,
  onNavigate,
}: {
  itemId: RouteId;
  label: string;
  path: string;
  active: boolean;
  onNavigate: (path: string) => void;
}) {
  const Icon = NAV_ICONS[itemId];
  return (
    <button
      type="button"
      className={`nav-item${active ? " active" : ""}`}
      title={label}
      onClick={() => onNavigate(path)}
    >
      <span className="nav-icon" aria-hidden>
        <Icon />
      </span>
      <span className="nav-label">{label}</span>
    </button>
  );
}

export function AppShell({ route, onNavigate, children }: Props) {
  const [isDesktop, setIsDesktop] = useState(getIsDesktop);
  const [open, setOpen] = useState(getIsDesktop);
  const mainItems = NAV_ITEMS.filter((n) => !n.group);
  const systemItems = NAV_ITEMS.filter((n) => n.group === "system");

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    const apply = () => {
      const desktop = mq.matches;
      setIsDesktop(desktop);
      setOpen(desktop);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (isDesktop || !open) return;
    return lockBodyScroll();
  }, [isDesktop, open]);

  function go(path: string) {
    onNavigate(path);
    if (!isDesktop) setOpen(false);
  }

  return (
    <div className={`app-shell${open ? " nav-open" : ""}${isDesktop ? " is-desktop" : " is-mobile"}`}>
      {!isDesktop && open ? (
        <button
          type="button"
          className="nav-backdrop"
          aria-label="关闭导航"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside className={`sidebar${open ? " open" : ""}`} aria-hidden={!isDesktop && !open}>
        <div className="brand">
          <img className="brand-mark" src="/logo.png" alt="MDCS" width={36} height={36} />
          <div className="brand-text">
            <div className="brand-title">MDCS</div>
            <div className="brand-sub">刮削整理服务</div>
          </div>
        </div>

        <nav className="nav">
          {mainItems.map((item) => (
            <NavButton
              key={item.id}
              itemId={item.id}
              label={item.label}
              path={item.path}
              active={route === item.id}
              onNavigate={go}
            />
          ))}

          <div className="nav-group-label">系统</div>
          {systemItems.map((item) => (
            <NavButton
              key={item.id}
              itemId={item.id}
              label={item.label}
              path={item.path}
              active={route === item.id}
              onNavigate={go}
            />
          ))}
        </nav>
      </aside>

      <main className="main">
        {!isDesktop ? (
          <div className="mobile-topbar">
            <button
              type="button"
              className={`mobile-nav-toggle${open ? " is-open" : ""}`}
              aria-label={open ? "关闭导航" : "打开导航"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? (
                <XMarkIcon className="mobile-nav-toggle-icon" aria-hidden />
              ) : (
                <Bars3Icon className="mobile-nav-toggle-icon" aria-hidden />
              )}
            </button>
          </div>
        ) : null}
        <div className="page-body">{children}</div>
      </main>
    </div>
  );
}
