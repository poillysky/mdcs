import {
  deleteFiles,
  reorganizeFiles,
  runFileTaskAction,
  retryFiles,
  stopFiles,
} from "../../../api";
import { isFilePipelineWaiting } from "../../../lib/filePipelineStatus";
import type { RecordTaskActionOptions } from "../../../components/RecordTaskActionModal";
import type { NotifyFn } from "../../../lib/notify";
import type { FileRow } from "../../../types";

type Args = {
  detailId: number | null;
  closeDetail: () => void;
  reloadDetail: (id: number) => Promise<void>;
  load: () => Promise<void>;
  notify: NotifyFn;
};

export function useRecordsRowActions({
  detailId,
  closeDetail,
  reloadDetail,
  load,
  notify,
}: Args) {
  async function retryOne(id: number) {
    try {
      const r = await retryFiles([id]);
      if (!r.updated) {
        notify(
          "warn",
          r.error === "no_origin_job"
            ? "找不到原任务，无法重刮"
            : "没有可重试的记录（仅失败或已取消可重试）",
        );
        return;
      }
      notify(
        "ok",
        r.merged
          ? "已插队优先重刮（并入当前任务）"
          : r.resumed
            ? "已拉起原任务，完成后自动暂停"
            : "已回退等待队列",
      );
      void load();
    } catch (e) {
      notify("error", e, "重试失败");
    }
  }

  async function stopOne(id: number) {
    try {
      const r = await stopFiles([id]);
      notify("ok", r.updated ? "已终止" : "没有可终止的处理中记录");
      void load();
    } catch (e) {
      notify("error", e, "终止失败");
    }
  }

  async function reorganizeOne(id: number) {
    try {
      const r = await reorganizeFiles([id]);
      notify("ok", r.updated ? "已加入重新整理队列" : "无法重新整理（需有番号）");
      void load();
    } catch (e) {
      notify("error", e, "重新整理失败");
    }
  }

  async function deleteOne(id: number, status?: string) {
    if (status && isFilePipelineWaiting(status)) {
      notify("warn", "等待中的记录无需删除");
      return;
    }
    if (!window.confirm("将清除刮削结果并回退为等待中。确定继续？")) return;
    try {
      const r = await deleteFiles([id]);
      if (r.reverted) {
        notify("ok", "已回退为等待中");
      } else if (r.skipped) {
        notify("warn", "等待中的记录无需删除");
      } else {
        notify("warn", "记录不存在");
      }
      if (detailId === id) closeDetail();
      void load();
    } catch (e) {
      notify("error", e, "删除失败");
    }
  }

  async function doTaskAction(id: number, opts: RecordTaskActionOptions) {
    notify("ok", opts.mode === "reorganize" ? "已开始重新整理…" : "已开始重新刮削…");
    try {
      const r = await runFileTaskAction(id, { ...opts, force: true });
      if (opts.mode === "reorganize") {
        notify(r.organized ? "ok" : "warn", r.message || (r.organized ? "已重新整理" : "整理未完成"));
      } else if (!r.meta?.ok) {
        notify("warn", r.message || r.meta?.message || "重刮未成功");
      } else if (r.organized) {
        notify("ok", r.message || "已重新刮削并更新封面与 NFO");
      } else {
        notify("warn", r.message || "刮削成功，NFO 未写入");
      }
      void load();
      if (detailId === id) void reloadDetail(id);
    } catch (e) {
      notify("error", e, opts.mode === "reorganize" ? "重新整理失败" : "重刮失败");
    }
  }

  return { retryOne, stopOne, reorganizeOne, deleteOne, doTaskAction };
}
