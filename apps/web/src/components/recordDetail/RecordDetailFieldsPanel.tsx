import type { FileRow, ScrapeMetaView } from "../../types";
import type { DetailField } from "./types";
import { formatFieldValue, mosaicLabel } from "./detailFields";
import { FieldSourceBadge } from "./FieldSourceBadge";

type Props = {
  file: FileRow;
  meta: ScrapeMetaView | null;
  detailFields: DetailField[];
  highlightSource: string | null;
  onHighlightSource: (source: string | null) => void;
};

export function RecordDetailFieldsPanel({
  file,
  meta,
  detailFields,
  highlightSource,
  onHighlightSource,
}: Props) {
  const fs = meta?.fieldSources ?? {};

  return (
    <section className="record-detail-panel">
      <h2 className="record-detail-section-title">详细数据</h2>
      <div className="record-detail-table">
        {detailFields.length ? (
          detailFields.map((row) => {
            const hasCode = Boolean(meta?.code || file.code);
            const source =
              (row.sourceKey && fs[row.sourceKey]) ||
              (row.key === "code" && hasCode ? "系统解析" : undefined) ||
              (row.key === "mosaic" && !fs.mosaic
                ? mosaicLabel(meta?.mosaic || file.mosaic) !== "—"
                  ? "系统解析"
                  : undefined
                : undefined);
            const val = row.value;
            const text = formatFieldValue(val);
            return (
              <div
                key={row.key}
                className={`record-detail-row${row.multiline ? " is-multiline" : ""}`}
              >
                <div className="record-detail-row-label">{row.label}</div>
                <div
                  className={`record-detail-row-value${row.multiline ? " is-multiline" : ""}`}
                >
                  {row.isTags && Array.isArray(val) && val.length ? (
                    <div className="record-detail-inline-tags">
                      {val.map((tag) => (
                        <span key={String(tag)} className="record-detail-tag sm">
                          {String(tag)}
                        </span>
                      ))}
                    </div>
                  ) : row.key === "actors" && Array.isArray(val) && val.length ? (
                    <span>{val.map(String).join("、")}</span>
                  ) : row.isLink && typeof val === "string" && text !== "—" ? (
                    <a
                      href={val}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="record-detail-link record-detail-url"
                    >
                      {val}
                    </a>
                  ) : (
                    text
                  )}
                </div>
                <div className="record-detail-row-src">
                  {source ? (
                    <FieldSourceBadge
                      source={source}
                      active={highlightSource === source}
                      onClick={() =>
                        onHighlightSource(highlightSource === source ? null : source)
                      }
                    />
                  ) : null}
                </div>
              </div>
            );
          })
        ) : (
          <p className="hint">尚无刮削缓存</p>
        )}
      </div>
    </section>
  );
}
