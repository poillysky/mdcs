import { useMemo, useRef, useState, type ReactNode, type UIEvent } from "react";

type Props<T> = {
  items: T[];
  rowHeight?: number;
  maxHeight?: number;
  overscan?: number;
  className?: string;
  renderRow: (item: T, index: number) => ReactNode;
  getKey: (item: T, index: number) => string;
};

/** 轻量窗口虚拟列表（大表格不卡） */
export function VirtualList<T>({
  items,
  rowHeight = 44,
  maxHeight = 480,
  overscan = 8,
  className,
  renderRow,
  getKey,
}: Props<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const { start, end, offsetY, totalHeight } = useMemo(() => {
    const visible = Math.ceil(maxHeight / rowHeight);
    const startIdx = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const endIdx = Math.min(items.length, startIdx + visible + overscan * 2);
    return {
      start: startIdx,
      end: endIdx,
      offsetY: startIdx * rowHeight,
      totalHeight: items.length * rowHeight,
    };
  }, [items.length, maxHeight, overscan, rowHeight, scrollTop]);

  function onScroll(e: UIEvent<HTMLDivElement>) {
    setScrollTop(e.currentTarget.scrollTop);
  }

  if (items.length <= 40) {
    return (
      <div className={className}>
        {items.map((item, i) => (
          <div key={getKey(item, i)}>{renderRow(item, i)}</div>
        ))}
      </div>
    );
  }

  const slice = items.slice(start, end);

  return (
    <div
      ref={ref}
      className={className}
      style={{ maxHeight, overflow: "auto", position: "relative" }}
      onScroll={onScroll}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {slice.map((item, i) => {
            const index = start + i;
            return (
              <div key={getKey(item, index)} style={{ height: rowHeight }}>
                {renderRow(item, index)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
