import type { CSSProperties } from "react";

type Props = {
  src?: string | null;
  alt?: string;
  className?: string;
  style?: CSSProperties;
};

/** 封面懒加载：进入视口再请求 */
export function LazyCover({ src, alt = "", className, style }: Props) {
  if (!src) {
    return (
      <div className={className} style={{ ...style, background: "var(--surface-2, #222)" }} aria-hidden />
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
    />
  );
}
