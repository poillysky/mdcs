import { columnClassName, type RecordColumnKey } from "../../lib/recordsColumns";
import { COPY } from "../../lib/messages";
import { TableSkeleton } from "../../components/ui/TableSkeleton";
import type { FileRow, KindRow } from "../../types";
import { RecordsCell } from "./RecordsCell";
import {
  formatRecordPathCells,
  isRecordsRowInteractiveTarget,
} from "./recordsDisplay";

type ColDef = { key: RecordColumnKey; label: string };

type Props = {
  files: FileRow[];
  loading: boolean;
  refreshing?: boolean;
  orderedColumns: ColDef[];
  kinds: KindRow[];
  allSelected: boolean;
  toggleAll: (checked: boolean) => void;
  isRowSelected: (id: number) => boolean;
  toggleOne: (id: number, checked: boolean) => void;
  openDetail: (id: number) => void;
  retryOne: (id: number) => void;
  stopOne: (id: number) => void;
  reorganizeOne: (id: number) => void;
  deleteOne: (id: number, status?: string) => void;
};

export function RecordsTable({
  files,
  loading,
  refreshing = false,
  orderedColumns,
  kinds,
  allSelected,
  toggleAll,
  isRowSelected,
  toggleOne,
  openDetail,
  retryOne,
  stopOne,
  reorganizeOne,
  deleteOne,
}: Props) {
  const colCount = orderedColumns.length + 1;

  return (
    <div className={`records-table-wrap${refreshing ? " is-refreshing" : ""}`}>
      <table className="records-table data-table">
        <colgroup>
          <col className="records-col-check" />
          {orderedColumns.map((col) => (
            <col key={col.key} className={columnClassName(col.key)} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="records-col-check">
              <input
                type="checkbox"
                aria-label="全选"
                checked={allSelected}
                onChange={(e) => toggleAll(e.target.checked)}
              />
            </th>
            {orderedColumns.map((col) => (
              <th key={col.key} className={columnClassName(col.key)}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && files.length === 0 ? (
            <TableSkeleton colCount={colCount} />
          ) : files.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="empty">
                {COPY.emptyRecords}
              </td>
            </tr>
          ) : (
            files.map((f) => {
              const paths = formatRecordPathCells(f, kinds);
              return (
                <tr
                  key={f.id}
                  className="records-row-clickable"
                  title="查看详情"
                  tabIndex={0}
                  onClick={(e) => {
                    if (isRecordsRowInteractiveTarget(e.target)) return;
                    void openDetail(f.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    if (isRecordsRowInteractiveTarget(e.target)) return;
                    e.preventDefault();
                    void openDetail(f.id);
                  }}
                >
                  <td className="records-col-check" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isRowSelected(f.id)}
                      onChange={(e) => toggleOne(f.id, e.target.checked)}
                    />
                  </td>
                  {orderedColumns.map((col) => (
                    <RecordsCell
                      key={col.key}
                      col={col.key}
                      file={f}
                      paths={paths}
                      kinds={kinds}
                      onView={() => void openDetail(f.id)}
                      onRetry={() => void retryOne(f.id)}
                      onStop={() => void stopOne(f.id)}
                      onReorganize={() => void reorganizeOne(f.id)}
                      onDelete={() => void deleteOne(f.id, f.status)}
                    />
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
