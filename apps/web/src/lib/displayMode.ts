/** iOS Safari 主屏幕 / 各端 PWA 独立窗口检测 */

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches
  );
}

/** iPhone / iPad（含桌面模式请求的 iPad） */
export function isIosDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  if (!isIosDevice()) return false;
  const ua = window.navigator.userAgent;
  const webkit = /WebKit/i.test(ua);
  const notOther = !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua);
  return webkit && notOther;
}

const DISMISS_KEY = "scrap.iosHomeHint.dismissed";

export function shouldShowIosHomeHint(): boolean {
  if (typeof window === "undefined") return false;
  if (!isIosSafari() || isStandaloneDisplay()) return false;
  try {
    return localStorage.getItem(DISMISS_KEY) !== "1";
  } catch {
    return true;
  }
}

export function dismissIosHomeHint(): void {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** 给 html 打标，供 CSS / 调试使用 */
export function applyDisplayModeClass(): () => void {
  const root = document.documentElement;
  const sync = () => {
    root.classList.toggle("is-standalone", isStandaloneDisplay());
    root.classList.toggle("is-ios", isIosDevice());
  };
  sync();
  const mql1 = window.matchMedia("(display-mode: standalone)");
  const mql2 = window.matchMedia("(display-mode: fullscreen)");
  mql1.addEventListener("change", sync);
  mql2.addEventListener("change", sync);
  return () => {
    mql1.removeEventListener("change", sync);
    mql2.removeEventListener("change", sync);
  };
}

/**
 * iOS 全屏 / 主屏幕模式下禁止手捏缩放（Safari 对 viewport user-scalable 不完全生效）。
 */
export function installIosNoPinchZoom(): () => void {
  if (typeof window === "undefined" || !isIosDevice()) return () => {};

  const preventGesture = (e: Event) => {
    if (!isStandaloneDisplay()) return;
    e.preventDefault();
  };

  const preventMultiTouch = (e: TouchEvent) => {
    if (!isStandaloneDisplay()) return;
    if (e.touches.length > 1) e.preventDefault();
  };

  const opts: AddEventListenerOptions = { passive: false };
  document.addEventListener("gesturestart", preventGesture, opts);
  document.addEventListener("gesturechange", preventGesture, opts);
  document.addEventListener("gestureend", preventGesture, opts);
  document.addEventListener("touchmove", preventMultiTouch, opts);

  return () => {
    document.removeEventListener("gesturestart", preventGesture);
    document.removeEventListener("gesturechange", preventGesture);
    document.removeEventListener("gestureend", preventGesture);
    document.removeEventListener("touchmove", preventMultiTouch);
  };
}
