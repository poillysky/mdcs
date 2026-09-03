import { useEffect, useState, type ReactNode } from "react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/solid";
import { useSharedIndexAll } from "../hooks/useSharedIndexAll";
import { NAV_ICONS } from "../lib/navIcons";
import { lockBodyScroll } from "../lib/lockBodyScroll";
import { NAV_ITEMS } from "../lib/routes";
import type { RouteId } from "../lib/routes";

/** 与 styles 中 960px 断点对齐：>960 为桌面 */
const DESKTOP_MQ = "(min-width: 961px)";
const WIDE_KEY = "mdcs.wideMode";

type Props = {
  route: RouteId;
  onNavigate: (path: string) => void;
  children: ReactNode;
};

function getIsDesktop() {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia(DESKTOP_MQ).matches;
}

function readWideMode(): boolean {
  try {
    return localStorage.getItem(WIDE_KEY) === "1";
  } catch {
    return false;
  }
}

function NavButton({
  itemId,
  label,
  path,
  active,
  onNavigate,
  busy,
  busyTitle,
}: {
  itemId: RouteId;
  label: string;
  path: string;
  active: boolean;
  onNavigate: (path: string) => void;
  busy?: boolean;
  busyTitle?: string;
}) {
  const Icon = NAV_ICONS[itemId];
  return (
    <button
      type="button"
      className={`nav-item${active ? " active" : ""}${busy ? " nav-item--busy" : ""}`}
      title={busy && busyTitle ? busyTitle : label}
      onClick={() => onNavigate(path)}
    >
      <span className="nav-icon" aria-hidden>
        <Icon />
      </span>
      <span className="nav-label">{label}</span>
      {busy ? <span className="nav-busy-dot" aria-hidden /> : null}
    </button>
  );
}

export function AppShell({ route, onNavigate, children }: Props) {
  const [isDesktop, setIsDesktop] = useState(getIsDesktop);
  const [open, setOpen] = useState(getIsDesktop);
  const [wide, setWide] = useState(readWideMode);
  const { indexStatus, indexingAll } = useSharedIndexAll();
  const indexHint =
    indexStatus?.message?.trim() ||
    (indexStatus?.discovered
      ? `全量索引中，已发现 ${indexStatus.discovered} 个文件`
      : "全量索引进行中");
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

  useEffect(() => {
    document.documentElement.classList.toggle("is-wide", wide);
    try {
      localStorage.setItem(WIDE_KEY, wide ? "1" : "0");
    } catch {
      /* private mode */
    }
  }, [wide]);

  function go(path: string) {
    onNavigate(path);
    if (!isDesktop) setOpen(false);
  }

  return (
    <div
      className={`app-shell${open ? " nav-open" : ""}${isDesktop ? " is-desktop" : " is-mobile"}${wide ? " is-wide" : ""}`}
    >
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
              busy={item.id === "files" && indexingAll}
              busyTitle={item.id === "files" && indexingAll ? indexHint : undefined}
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

        <div className="sidebar-foot">
          <button
            type="button"
            className={`nav-item nav-pref${wide ? " active" : ""}`}
            title={wide ? "关闭宽屏模式" : "开启宽屏模式"}
            aria-pressed={wide}
            onClick={() => setWide((v) => !v)}
          >
            <span className="nav-label">{wide ? "宽屏模式 · 开" : "宽屏模式 · 关"}</span>
          </button>
        </div>
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
