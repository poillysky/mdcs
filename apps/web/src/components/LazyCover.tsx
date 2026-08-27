import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

type Props = {
  src?: string | null;
  alt?: string;
  className?: string;
  style?: CSSProperties;
};

/** 封面懒加载：进入视口再请求；失败时显示浅色占位 */
export function LazyCover({ src, alt = "", className, style }: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`lazy-cover-placeholder${className ? ` ${className}` : ""}`}
        style={style}
        aria-label={alt || "无封面"}
        role="img"
      />
    );
  }

  const proxied = src.startsWith("/api/");

  return (
    <img
      key={src}
      src={src}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      decoding="async"
      referrerPolicy={proxied ? undefined : "no-referrer"}
      onError={() => setFailed(true)}
    />
  );
}
