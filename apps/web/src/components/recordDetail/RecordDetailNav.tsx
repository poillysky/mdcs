import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import type { FileRow } from "../../types";
import { fullNavLabel, shortNavLabel } from "./detailFields";

type Props = {
  prevItem: FileRow | null;
  nextItem: FileRow | null;
  onNavigate: (id: number) => void;
  onClose: () => void;
};

export function RecordDetailNav({ prevItem, nextItem, onNavigate, onClose }: Props) {
  return (
    <nav className="record-detail-nav" aria-label="详情导航">
      <button
        type="button"
        className="record-detail-nav-side"
        disabled={!prevItem}
        title={prevItem ? fullNavLabel(prevItem) : undefined}
        onClick={() => prevItem && onNavigate(prevItem.id)}
      >
        <ChevronLeftIcon aria-hidden />
        <span>{prevItem ? shortNavLabel(prevItem) : "—"}</span>
      </button>
      <button type="button" className="record-detail-nav-back" onClick={onClose}>
        返回列表
      </button>
      <button
        type="button"
        className="record-detail-nav-side record-detail-nav-side--next"
        disabled={!nextItem}
        title={nextItem ? fullNavLabel(nextItem) : undefined}
        onClick={() => nextItem && onNavigate(nextItem.id)}
      >
        <span>{nextItem ? shortNavLabel(nextItem) : "—"}</span>
        <ChevronRightIcon aria-hidden />
      </button>
    </nav>
  );
}
