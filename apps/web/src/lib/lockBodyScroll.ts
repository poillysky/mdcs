/** 弹窗/抽屉打开时锁住底层页面滚动（含 iOS 触摸穿透）。支持嵌套。 */

let lockCount = 0;
let savedScrollY = 0;
let savedBody: {
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  overflow: string;
} | null = null;
let savedHtmlOverflow = "";

export function lockBodyScroll(): () => void {
  lockCount += 1;
  if (lockCount === 1) {
    const body = document.body;
    const html = document.documentElement;
    savedScrollY = window.scrollY || window.pageYOffset || 0;
    savedBody = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    savedHtmlOverflow = html.style.overflow;

    html.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${savedScrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    html.classList.add("scroll-locked");
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount > 0 || !savedBody) return;

    const body = document.body;
    const html = document.documentElement;
    html.style.overflow = savedHtmlOverflow;
    body.style.position = savedBody.position;
    body.style.top = savedBody.top;
    body.style.left = savedBody.left;
    body.style.right = savedBody.right;
    body.style.width = savedBody.width;
    body.style.overflow = savedBody.overflow;
    html.classList.remove("scroll-locked");
    savedBody = null;

    const y = savedScrollY;
    savedScrollY = 0;
    window.scrollTo(0, y);
  };
}
