import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { dismissIosHomeHint, shouldShowIosHomeHint } from "../lib/displayMode";

/** iOS Safari：引导「分享 → 添加到主屏幕」以进入独立全屏 */
export function IosHomeHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(shouldShowIosHomeHint());
  }, []);

  if (!visible || typeof document === "undefined") return null;

  return createPortal(
    <div className="ios-home-hint" role="note">
      <div className="ios-home-hint-body">
        <div className="ios-home-hint-title">添加到主屏幕 · 全屏使用</div>
        <p className="ios-home-hint-text">
          点 Safari 底部分享按钮，再选「添加到主屏幕」，即可去掉浏览器栏、全屏打开 MDCS。
        </p>
      </div>
      <button
        type="button"
        className="ios-home-hint-dismiss"
        aria-label="关闭提示"
        onClick={() => {
          dismissIosHomeHint();
          setVisible(false);
        }}
      >
        知道了
      </button>
    </div>,
    document.body,
  );
}
