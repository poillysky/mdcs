import {
  ArrowPathIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon,
  StopIcon,
  TrashIcon,
} from "@heroicons/react/20/solid";
import { RecordsMenuDropdown } from "../../components/RecordsMenuDropdown";
import {
  RECORD_COLUMN_DEFS,
  type RecordColumnKey,
} from "../../lib/recordsColumns";
import { RECORDS_STATUS_OPTIONS } from "./recordsDisplay";

type Props = {
  titleScopeLabel: string;
  total: number;
  searchInput: string;
  setSearchInput: (v: string) => void;
  scoped: boolean;
  status: string;
  statusLabel: string;
  setStatus: (v: string) => void;
  visibleColumns: Set<RecordColumnKey>;
  toggleColumn: (key: RecordColumnKey) => void;
  selectedCount: number;
  selectAllMatching: boolean;
  selectAllMatchingRecords: () => void;
  loading: boolean;
  batchActing: boolean;
  onBatchStop: () => void;
  onBatchRetry: () => void;
  onBatchDelete: () => void;
};

export function RecordsPageHeader({
  titleScopeLabel,
  total,
  searchInput,
  setSearchInput,
  scoped,
  status,
  statusLabel,
  setStatus,
  visibleColumns,
  toggleColumn,
  selectedCount,
  selectAllMatching,
  selectAllMatchingRecords,
  loading,
  batchActing,
  onBatchStop,
  onBatchRetry,
  onBatchDelete,
}: Props) {
  return (
    <header className="records-page-head">
      <div className="records-page-title-row">
        <h1 className="records-page-title">
          <span className="records-page-title-main">刮削记录</span>
          {titleScopeLabel ? (
            <span className="records-page-title-suffix" title={titleScopeLabel}>
              — {titleScopeLabel}
            </span>
          ) : null}
        </h1>
        <span className="records-page-count">
          共 <strong>{total}</strong> 条记录
        </span>
      </div>

      <div className="records-page-head-bar">
        <div className="records-page-search">
          <MagnifyingGlassIcon className="records-page-search-icon" aria-hidden />
          <input
            className="records-page-search-input"
            placeholder="搜索番号, 目录, 演员"
            value={searchInput}
            disabled={scoped}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <RecordsMenuDropdown
          className="records-menu--status"
          closeOnSelect
          label={
            <>
              <span className="records-menu-trigger-prefix">任务状态:</span>
              <span className="records-menu-trigger-value">{statusLabel}</span>
              <ChevronDownIcon className="records-menu-chevron" aria-hidden />
            </>
          }
          items={RECORDS_STATUS_OPTIONS.map((o) => ({
            id: o.value,
            label: o.label,
            checked: status === o.value,
          }))}
          onSelect={(id) => {
            setStatus(id);
          }}
        />

        <RecordsMenuDropdown
          className="records-menu--columns"
          panelClassName="records-menu-panel--columns"
          align="right"
          label={
            <>
              <Cog6ToothIcon className="records-menu-trigger-icon" aria-hidden />
              <span>列设置</span>
              <ChevronDownIcon className="records-menu-chevron" aria-hidden />
            </>
          }
          items={RECORD_COLUMN_DEFS.map((col) => ({
            id: col.key,
            label: col.label,
            checked: visibleColumns.has(col.key),
            disabled: col.locked,
          }))}
          onSelect={(id) => toggleColumn(id as RecordColumnKey)}
        />

        <div className="records-page-head-meta">
          {selectedCount > 0 ? (
            <span className="records-page-selection-text">
              已选中 <strong>{selectedCount}</strong> 个条目
              {!selectAllMatching && selectedCount < total ? (
                <>
                  {" "}
                  <button
                    type="button"
                    className="records-page-select-all-link"
                    onClick={selectAllMatchingRecords}
                  >
                    选中全部 {total} 个?
                  </button>
                </>
              ) : null}
            </span>
          ) : null}
          <div className="records-page-actions">
            <button
              type="button"
              className="records-icon-btn"
              title="停止任务"
              disabled={loading || batchActing || selectedCount === 0}
              onClick={onBatchStop}
            >
              <StopIcon aria-hidden />
            </button>
            <button
              type="button"
              className="records-icon-btn"
              title="重新整理"
              disabled={loading || batchActing || selectedCount === 0}
              onClick={onBatchRetry}
            >
              <ArrowPathIcon aria-hidden />
            </button>
            <button
              type="button"
              className="records-icon-btn records-icon-btn--danger"
              title="删除"
              disabled={loading || batchActing || selectedCount === 0}
              onClick={onBatchDelete}
            >
              <TrashIcon aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
