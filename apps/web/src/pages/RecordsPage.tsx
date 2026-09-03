import { RecordDetailView } from "../components/RecordDetailView";
import { RecordsBatchActionModal } from "../components/RecordsBatchActionModal";
import { Pagination } from "../components/ui/Pagination";
import type { NotifyFn } from "../lib/notify";
import type { KindRow } from "../types";
import { RecordsPageHeader } from "./records/RecordsPageHeader";
import { RecordsTable } from "./records/RecordsTable";
import { useRecordsBatch } from "./records/hooks/useRecordsBatch";
import { useRecordsDetail } from "./records/hooks/useRecordsDetail";
import { useRecordsList } from "./records/hooks/useRecordsList";
import { useRecordsRowActions } from "./records/hooks/useRecordsRowActions";
import { useRecordsSelection } from "./records/hooks/useRecordsSelection";

type Props = {
  kinds: KindRow[];
  locationSearch: string;
  onNavigate: (path: string) => void;
  notify: NotifyFn;
};

export function RecordsPage({ kinds, locationSearch, onNavigate, notify }: Props) {
  const list = useRecordsList(kinds, locationSearch, onNavigate, notify);
  const selection = useRecordsSelection({
    files: list.files,
    total: list.total,
    page: list.page,
    status: list.status,
    q: list.q,
    urlScope: list.urlScope,
    listFilters: list.listFilters,
  });
  const detail = useRecordsDetail({
    urlScope: list.urlScope,
    locationSearch,
    onNavigate,
    notify,
    load: list.load,
  });
  const batch = useRecordsBatch({
    urlScope: list.urlScope,
    resolveSelectedIds: selection.resolveSelectedIds,
    clearSelection: selection.clearSelection,
    load: list.load,
    onNavigate,
    notify,
  });
  const actions = useRecordsRowActions({
    detailId: detail.detailId,
    closeDetail: detail.closeDetail,
    reloadDetail: detail.reloadDetail,
    load: list.load,
    notify,
  });

  if (detail.detailId != null) {
    return (
      <RecordDetailView
        file={detail.detailFile}
        meta={detail.detailMeta}
        loading={detail.detailLoading}
        detailId={detail.detailId}
        kinds={kinds}
        listItems={list.files}
        highlightSource={detail.highlightSource}
        onHighlightSource={detail.setHighlightSource}
        onClose={detail.closeDetail}
        onNavigate={(id) => void detail.openDetail(id)}
        onTaskAction={(opts) => actions.doTaskAction(detail.detailId!, opts)}
        onDelete={() => void actions.deleteOne(detail.detailId!, detail.detailFile?.status)}
        onMetaSave={(fields) => void detail.saveDetailMeta(fields)}
        onMetaRefresh={detail.setDetailMeta}
        onFileRefresh={() => void detail.refreshDetailFile()}
      />
    );
  }

  return (
    <div className="records-page">
      <section className="panel records-shell">
        <RecordsPageHeader
          titleScopeLabel={list.titleScopeLabel}
          total={list.total}
          searchInput={list.searchInput}
          setSearchInput={list.setSearchInput}
          scoped={list.scoped}
          status={list.status}
          statusLabel={list.statusLabel}
          setStatus={list.setStatus}
          visibleColumns={list.visibleColumns}
          toggleColumn={list.toggleColumn}
          selectedCount={selection.selectedCount}
          selectAllMatching={selection.selectAllMatching}
          selectAllMatchingRecords={selection.selectAllMatchingRecords}
          loading={list.loading}
          batchActing={batch.batchActing}
          onBatchStop={() => batch.setBatchModal("stop")}
          onBatchRetry={() => batch.setBatchModal("retry")}
          onBatchDelete={() => batch.setBatchModal("delete")}
        />

        <RecordsTable
          files={list.files}
          loading={list.loading}
          refreshing={list.refreshing}
          orderedColumns={list.orderedColumns}
          kinds={kinds}
          allSelected={selection.allSelected}
          toggleAll={selection.toggleAll}
          isRowSelected={selection.isRowSelected}
          toggleOne={selection.toggleOne}
          openDetail={detail.openDetail}
          retryOne={actions.retryOne}
          stopOne={actions.stopOne}
          reorganizeOne={actions.reorganizeOne}
          deleteOne={actions.deleteOne}
        />

        <Pagination
          page={list.page}
          pageCount={list.pageCount}
          total={list.total}
          onPageChange={list.setPage}
          className="pagination records-pagination"
        />
      </section>

      <RecordsBatchActionModal
        open={batch.batchModal != null}
        action={batch.batchModal ?? "stop"}
        count={selection.selectedCount}
        onClose={() => batch.setBatchModal(null)}
        onConfirm={(opts) => void batch.confirmBatchAction(opts)}
      />
    </div>
  );
}
