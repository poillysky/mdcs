import { useState } from "react";
import {
  cancelJob,
  deleteFiles,
  reorganizeFiles,
  retryFiles,
  stopFiles,
} from "../../../api";
import type {
  RecordsBatchActionKind,
  RecordsBatchRetryMode,
} from "../../../components/RecordsBatchActionModal";
import type { NotifyFn } from "../../../lib/notify";
import type { RecordsUrlScope } from "../recordsScope";

type Args = {
  urlScope: RecordsUrlScope;
  resolveSelectedIds: () => Promise<number[]>;
  clearSelection: () => void;
  load: () => Promise<void>;
  onNavigate: (path: string) => void;
  notify: NotifyFn;
};

export function useRecordsBatch({
  urlScope,
  resolveSelectedIds,
  clearSelection,
  load,
  onNavigate,
  notify,
}: Args) {
  const [batchActing, setBatchActing] = useState(false);
  const [batchModal, setBatchModal] = useState<RecordsBatchActionKind | null>(null);

  async function executeBatchStop() {
    if (urlScope.jobId) {
      setBatchActing(true);
      try {
        await cancelJob(urlScope.jobId);
        notify("ok", "任务已停止");
        onNavigate("/records");
      } catch (e) {
        notify("error", e, "停止任务失败");
      } finally {
        setBatchActing(false);
      }
      return;
    }

    try {
      const ids = await resolveSelectedIds();
      if (!ids.length) return;
      setBatchActing(true);
      const r = await stopFiles(ids);
      notify("ok", r.updated ? `已停止 ${r.updated} 条处理中的记录` : "没有可停止的处理中记录");
      clearSelection();
      void load();
    } catch (e) {
      notify("error", e, "停止任务失败");
    } finally {
      setBatchActing(false);
    }
  }

  async function executeBatchRetry(retryMode: RecordsBatchRetryMode) {
    try {
      const ids = await resolveSelectedIds();
      if (!ids.length) return;
      setBatchActing(true);
      if (retryMode === "reorganize") {
        const r = await reorganizeFiles(ids);
        notify(
          "ok",
          r.updated ? `已加入重新整理队列 ${r.updated} 条` : "所选记录无法重新整理（需有番号）",
        );
      } else {
        const r = await retryFiles(ids);
        notify(
          "ok",
          r.updated
            ? r.merged
              ? `已插队优先重刮 ${r.updated} 条（并入当前任务）`
              : r.resumed
                ? `已拉起原任务重刮 ${r.updated} 条，完成后自动暂停`
                : `已回退等待队列 ${r.updated} 条`
            : r.error === "no_origin_job"
              ? "找不到原任务，无法重刮"
              : "没有可重试的记录（仅失败或已取消可重试）",
        );
      }
      clearSelection();
      void load();
    } catch (e) {
      notify("error", e, retryMode === "reorganize" ? "重新整理失败" : "重试失败");
    } finally {
      setBatchActing(false);
    }
  }

  async function executeBatchDelete() {
    try {
      const ids = await resolveSelectedIds();
      if (!ids.length) return;
      setBatchActing(true);
      const r = await deleteFiles(ids);
      const parts: string[] = [];
      if (r.reverted) parts.push(`已回退等待 ${r.reverted} 条`);
      if (r.skipped) parts.push(`已跳过等待中 ${r.skipped} 条`);
      notify("ok", parts.length ? parts.join("，") : "没有可处理的记录");
      clearSelection();
      void load();
    } catch (e) {
      notify("error", e, "删除失败");
    } finally {
      setBatchActing(false);
    }
  }

  async function confirmBatchAction(opts: {
    action: RecordsBatchActionKind;
    retryMode?: RecordsBatchRetryMode;
  }) {
    setBatchModal(null);
    if (opts.action === "stop") {
      await executeBatchStop();
      return;
    }
    if (opts.action === "retry") {
      await executeBatchRetry(opts.retryMode ?? "rescrape");
      return;
    }
    await executeBatchDelete();
  }

  return {
    batchActing,
    batchModal,
    setBatchModal,
    confirmBatchAction,
  };
}
