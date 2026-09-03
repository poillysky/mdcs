import { useEffect, useRef, useState } from "react";
import { fetchFileDetail, updateFileMeta } from "../../../api";
import { useJobEvents } from "../../../hooks/useJobEvents";
import type { NotifyFn } from "../../../lib/notify";
import type { FileRow, ScrapeMetaView } from "../../../types";
import { buildRecordsPath, type RecordsUrlScope } from "../recordsScope";

type Args = {
  urlScope: RecordsUrlScope;
  locationSearch: string;
  onNavigate: (path: string) => void;
  notify: NotifyFn;
  load: () => Promise<void>;
};

export function useRecordsDetail({
  urlScope,
  locationSearch,
  onNavigate,
  notify,
  load,
}: Args) {
  const [detailId, setDetailId] = useState<number | null>(() => urlScope.detailId);
  const [detailFile, setDetailFile] = useState<FileRow | null>(null);
  const [detailMeta, setDetailMeta] = useState<ScrapeMetaView | null>(null);
  const [detailLoading, setDetailLoading] = useState(() => urlScope.detailId != null);
  const [highlightSource, setHighlightSource] = useState<string | null>(null);
  const detailIdRef = useRef<number | null>(detailId);
  detailIdRef.current = detailId;

  useJobEvents({
    onFileChange: (change) => {
      const id = detailIdRef.current;
      if (id != null && change.ids.includes(id)) {
        void fetchFileDetail(id)
          .then((data) => {
            if (detailIdRef.current !== id) return;
            setDetailFile(data.file);
            setDetailMeta(data.meta);
          })
          .catch(() => {
            /* 静默失败，避免轮询与 WS 叠加弹 toast */
          });
      }
    },
  });

  useEffect(() => {
    const urlId = urlScope.detailId;
    if (urlId == null) {
      setDetailId(null);
      setDetailFile(null);
      setDetailMeta(null);
      setDetailLoading(false);
      setHighlightSource(null);
      return;
    }
    let cancelled = false;
    setDetailId(urlId);
    setHighlightSource(null);
    setDetailLoading(true);
    void fetchFileDetail(urlId)
      .then((data) => {
        if (cancelled) return;
        setDetailFile(data.file);
        setDetailMeta(data.meta);
      })
      .catch((e) => {
        if (cancelled) return;
        notify("error", e, "加载详情失败");
        setDetailFile(null);
        setDetailMeta(null);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [urlScope.detailId, notify]);

  function openDetail(id: number) {
    onNavigate(buildRecordsPath(locationSearch, id));
  }

  function closeDetail() {
    onNavigate(buildRecordsPath(locationSearch, null));
  }

  async function reloadDetail(id: number) {
    setDetailLoading(true);
    try {
      const data = await fetchFileDetail(id);
      setDetailFile(data.file);
      setDetailMeta(data.meta);
    } catch (e) {
      notify("error", e, "加载详情失败");
      setDetailFile(null);
      setDetailMeta(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function saveDetailMeta(
    fields: Record<string, { value: string; source: string }>,
  ) {
    if (detailId == null) return;
    try {
      const data = await updateFileMeta(detailId, fields);
      setDetailMeta(data.meta);
      notify("ok", "元数据已保存");
      void load();
    } catch (e) {
      notify("error", e, "保存元数据失败");
      throw e;
    }
  }

  async function refreshDetailFile() {
    if (detailId == null) return;
    try {
      const data = await fetchFileDetail(detailId);
      setDetailFile(data.file);
      setDetailMeta(data.meta);
    } catch (e) {
      notify("error", e, "刷新详情失败");
    }
  }

  return {
    detailId,
    detailFile,
    detailMeta,
    detailLoading,
    highlightSource,
    setHighlightSource,
    setDetailMeta,
    openDetail,
    closeDetail,
    reloadDetail,
    saveDetailMeta,
    refreshDetailFile,
  };
}
