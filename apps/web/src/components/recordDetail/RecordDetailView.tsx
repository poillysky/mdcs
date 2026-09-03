import { useEffect, useMemo, useState } from "react";
import { CoverCropModal } from "../CoverCropModal";
import { RecordMetaEditModal } from "../RecordMetaEditModal";
import { RecordTaskActionModal } from "../RecordTaskActionModal";
import { PanelSkeleton } from "../ui/PanelSkeleton";
import { fetchFilePipelineLog } from "../../api";
import type { RecordDetailViewProps } from "./types";
import { buildDetailFields } from "./detailFields";
import { useDetailGallery } from "./hooks/useDetailGallery";
import { usePipelineLog } from "./hooks/usePipelineLog";
import { RecordDetailFieldsPanel } from "./RecordDetailFieldsPanel";
import { RecordDetailGallery } from "./RecordDetailGallery";
import { RecordDetailHero } from "./RecordDetailHero";
import { RecordDetailLogPanel } from "./RecordDetailLogPanel";
import { RecordDetailNav } from "./RecordDetailNav";

export function RecordDetailView({
  file,
  meta,
  loading,
  detailId,
  listItems,
  kinds,
  highlightSource,
  onHighlightSource,
  onClose,
  onNavigate,
  onTaskAction,
  onDelete,
  onMetaSave,
  onMetaRefresh,
  onFileRefresh,
}: RecordDetailViewProps) {
  const [metaEditOpen, setMetaEditOpen] = useState(false);
  const [coverCropOpen, setCoverCropOpen] = useState(false);
  const [coverVersion, setCoverVersion] = useState(0);
  const [taskActionOpen, setTaskActionOpen] = useState(false);

  const libraryRoot = useMemo(
    () => kinds?.find((k) => k.id === file?.kind)?.libraryRoot,
    [kinds, file?.kind],
  );

  const { galleryImages } = useDetailGallery(detailId, file, meta);
  const {
    pipelineSteps,
    setPipelineSteps,
    selectedRunId,
    setSelectedRunId,
    logRunOptions,
    selectedLogRun,
    latestLogRun,
    logSteps,
    startPipelinePoll,
    stopPipelinePoll,
    applyPipelineLog,
    pipelineWaitRefreshRef,
  } = usePipelineLog(detailId, file, meta, libraryRoot);

  useEffect(() => {
    setMetaEditOpen(false);
    setCoverCropOpen(false);
    setCoverVersion(0);
    setTaskActionOpen(false);
  }, [detailId]);

  const index = listItems.findIndex((f) => f.id === detailId);
  const prevItem = index > 0 ? listItems[index - 1] : null;
  const nextItem = index >= 0 && index < listItems.length - 1 ? listItems[index + 1] : null;

  const detailFields = useMemo(
    () => (file ? buildDetailFields(file, meta) : []),
    [file, meta],
  );

  if (loading && !file) {
    return (
      <div className="record-detail">
        <div className="record-detail-nav">
          <button type="button" className="record-detail-nav-back" onClick={onClose}>
            返回列表
          </button>
        </div>
        <PanelSkeleton label="加载详情…" lines={8} />
      </div>
    );
  }

  if (!file) {
    return (
      <div className="record-detail">
        <div className="record-detail-nav">
          <button type="button" className="record-detail-nav-back" onClick={onClose}>
            返回列表
          </button>
        </div>
        <div className="empty-block">记录不存在</div>
      </div>
    );
  }

  return (
    <div className="record-detail">
      <RecordDetailNav
        prevItem={prevItem}
        nextItem={nextItem}
        onNavigate={onNavigate}
        onClose={onClose}
      />

      <RecordDetailHero
        file={file}
        meta={meta}
        coverVersion={coverVersion}
        onEditMeta={() => setMetaEditOpen(true)}
        onCropCover={() => setCoverCropOpen(true)}
        onDelete={onDelete}
        onTaskAction={() => setTaskActionOpen(true)}
      />

      <RecordDetailGallery images={galleryImages} />

      <div className="record-detail-grid">
        <RecordDetailFieldsPanel
          file={file}
          meta={meta}
          detailFields={detailFields}
          highlightSource={highlightSource}
          onHighlightSource={onHighlightSource}
        />

        <RecordDetailLogPanel
          logRunOptions={logRunOptions}
          pipelineSteps={pipelineSteps}
          selectedRunId={selectedRunId}
          selectedLogRun={selectedLogRun}
          latestLogRun={latestLogRun}
          logSteps={logSteps}
          highlightSource={highlightSource}
          onSelectRun={(id) => {
            setSelectedRunId(id);
            setPipelineSteps(null);
          }}
        />
      </div>

      <RecordMetaEditModal
        open={metaEditOpen}
        file={file}
        meta={meta}
        onClose={() => setMetaEditOpen(false)}
        onSave={onMetaSave}
        onMetaRefresh={onMetaRefresh}
      />

      <CoverCropModal
        open={coverCropOpen}
        file={file}
        onClose={() => setCoverCropOpen(false)}
        onDone={(updatedAt) => {
          setCoverVersion(updatedAt);
          void onFileRefresh?.();
        }}
      />

      <RecordTaskActionModal
        open={taskActionOpen}
        file={file}
        onClose={() => setTaskActionOpen(false)}
        onConfirm={(opts) => {
          setTaskActionOpen(false);
          setPipelineSteps([]);
          setSelectedRunId("__live__");
          startPipelinePoll(file.id);
          void (async () => {
            try {
              await onTaskAction(opts);
            } finally {
              stopPipelinePoll();
              try {
                const p = await fetchFilePipelineLog(file.id);
                if (applyPipelineLog(p)) startPipelinePoll(file.id);
              } catch {
                setPipelineSteps(null);
              }
              pipelineWaitRefreshRef.current = true;
            }
          })();
        }}
      />
    </div>
  );
}
