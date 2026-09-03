import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchFiles, fetchJob } from "../../../api";
import { useCachedQuery, listQueryKey } from "../../../hooks/useCachedQuery";
import { useJobEvents } from "../../../hooks/useJobEvents";
import { kindLabel } from "../../../lib/labels";
import { formatJobSummaryLine, jobShortId } from "../../../lib/jobDisplay";
import { displayRelativePath } from "../../../lib/paths";
import {
  RECORD_COLUMN_DEFS,
  loadVisibleColumns,
  saveVisibleColumns,
  type RecordColumnKey,
} from "../../../lib/recordsColumns";
import type { NotifyFn } from "../../../lib/notify";
import type { KindRow } from "../../../types";
import { RECORDS_STATUS_OPTIONS } from "../recordsDisplay";
import {
  RECORDS_PAGE_SIZE,
  buildRecordsListPath,
  parseRecordsSearch,
  recordsListQuery,
  resolveRecordsKind,
  resolveScopedKind,
} from "../recordsScope";

export function useRecordsList(
  kinds: KindRow[],
  locationSearch: string,
  onNavigate: (path: string) => void,
  notify: NotifyFn,
) {
  const urlScope = useMemo(() => parseRecordsSearch(locationSearch), [locationSearch]);
  const scopedKind = useMemo(
    () => resolveScopedKind(urlScope.kind, urlScope.sourceRoot, kinds),
    [urlScope.kind, urlScope.sourceRoot, kinds],
  );

  const status = urlScope.status;
  const q = urlScope.q;
  const page = urlScope.page;
  const [searchInput, setSearchInput] = useState(() => urlScope.q);
  const [jobScopeLabel, setJobScopeLabel] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<Set<RecordColumnKey>>(() => loadVisibleColumns());

  const resolvedKind = useMemo(
    () => resolveRecordsKind(urlScope, kinds),
    [urlScope, kinds],
  );
  const listQuery = useMemo(
    () => recordsListQuery(urlScope, resolvedKind, status, q, page),
    [urlScope, resolvedKind, status, q, page],
  );

  const cacheKey = useMemo(() => listQueryKey("records", listQuery), [listQuery]);
  const {
    data: listData,
    loading,
    refreshing,
    reload: reloadList,
  } = useCachedQuery({
    key: cacheKey,
    fetcher: async () => {
      const data = await fetchFiles(listQuery);
      return { files: data.files, total: data.total };
    },
    onError: (e) => notify("error", e, "加载刮削记录失败"),
  });
  const files = listData?.files ?? [];
  const total = listData?.total ?? 0;

  const scoped = Boolean(urlScope.jobId) || Boolean(urlScope.sourceRoot);

  const load = useCallback(async () => {
    await reloadList({ silent: Boolean(listData) });
  }, [reloadList, listData]);

  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jobIdRef = useRef(urlScope.jobId);
  jobIdRef.current = urlScope.jobId;

  const refreshJobScopeLabel = useCallback(async (jobId: string) => {
    try {
      const data = await fetchJob(jobId);
      setJobScopeLabel(formatJobSummaryLine(data.job));
    } catch {
      setJobScopeLabel(jobShortId(jobId));
    }
  }, []);

  useJobEvents({
    onJobUpdate: (job) => {
      if (jobIdRef.current && job.id === jobIdRef.current) {
        setJobScopeLabel(formatJobSummaryLine(job));
      }
    },
    onFileChange: (change) => {
      if (change.reason === "scan") return;
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = setTimeout(() => {
        reloadTimerRef.current = null;
        void reloadList({ silent: true });
        if (jobIdRef.current) void refreshJobScopeLabel(jobIdRef.current);
      }, 300);
    },
  });

  useEffect(() => {
    return () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setSearchInput(urlScope.q);
  }, [urlScope.q]);

  useEffect(() => {
    if (!urlScope.jobId) {
      setJobScopeLabel("");
      return;
    }
    void refreshJobScopeLabel(urlScope.jobId);
  }, [urlScope.jobId, refreshJobScopeLabel]);

  useEffect(() => {
    if (scoped) return;
    const nextQ = searchInput.trim();
    if (nextQ === q) return;
    const t = setTimeout(() => {
      onNavigate(buildRecordsListPath(locationSearch, { q: nextQ, page: 1 }));
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput, q, scoped, locationSearch, onNavigate]);

  const setStatus = useCallback(
    (next: string) => {
      onNavigate(buildRecordsListPath(locationSearch, { status: next, page: 1 }));
    },
    [locationSearch, onNavigate],
  );

  const setPage = useCallback(
    (next: number) => {
      onNavigate(buildRecordsListPath(locationSearch, { page: next }));
    },
    [locationSearch, onNavigate],
  );

  const pageCount = Math.max(1, Math.ceil(total / RECORDS_PAGE_SIZE));
  const listFilters = useMemo(() => {
    const { page: _page, pageSize: _pageSize, ...rest } = listQuery;
    return rest;
  }, [listQuery]);
  const orderedColumns = useMemo(
    () => RECORD_COLUMN_DEFS.filter((col) => visibleColumns.has(col.key)),
    [visibleColumns],
  );
  const statusLabel =
    RECORDS_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? "全部";

  const titleScopeLabel = useMemo(() => {
    if (urlScope.jobId) return jobScopeLabel || jobShortId(urlScope.jobId);
    if (!urlScope.sourceRoot) return "";
    const label = scopedKind ? kindLabel(scopedKind) : "分区";
    return `${label} · ${displayRelativePath(urlScope.sourceRoot)}`;
  }, [urlScope.jobId, urlScope.sourceRoot, jobScopeLabel, scopedKind]);

  function toggleColumn(key: RecordColumnKey) {
    const def = RECORD_COLUMN_DEFS.find((col) => col.key === key);
    if (def?.locked) return;
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      for (const col of RECORD_COLUMN_DEFS) {
        if (col.locked) next.add(col.key);
      }
      saveVisibleColumns(next);
      return next;
    });
  }

  return {
    urlScope,
    scopedKind,
    status,
    setStatus,
    q,
    searchInput,
    setSearchInput,
    page,
    setPage,
    total,
    files,
    loading,
    refreshing,
    load,
    scoped,
    listFilters,
    pageCount,
    orderedColumns,
    visibleColumns,
    toggleColumn,
    statusLabel,
    titleScopeLabel,
  };
}
