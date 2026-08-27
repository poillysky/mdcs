import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowPathIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
  EllipsisVerticalIcon,
  MagnifyingGlassIcon,
  StopIcon,
  TrashIcon,
} from "@heroicons/react/20/solid";
import { RecordsMenuDropdown } from "../components/RecordsMenuDropdown";
import { RecordDetailView } from "../components/RecordDetailView";
import {
  RecordsBatchActionModal,
  type RecordsBatchActionKind,
  type RecordsBatchRetryMode,
} from "../components/RecordsBatchActionModal";
import type { RecordTaskActionOptions } from "../components/RecordTaskActionModal";
import {
  fetchFileDetail,
  fetchFiles,
  fetchJob,
  cancelJob,
  deleteFiles,
  reorganizeFiles,
  runFileTaskAction,
  retryFiles,
  stopFiles,
  updateFileMeta,
} from "../api";
import { FILE_STATUS_LABELS, kindLabel, ORGANIZE_MODE_LABELS } from "../lib/labels";
import { COPY } from "../lib/messages";
import { formatJobSummaryLine, jobShortId } from "../lib/jobDisplay";
import {
  RECORD_COLUMN_DEFS,
  columnClassName,
  loadVisibleColumns,
  saveVisibleColumns,
  type RecordColumnKey,
} from "../lib/recordsColumns";
import type { NotifyFn } from "../lib/notify";
import { displayRelativePath, formatRecordPaths, normalizeRelativePath } from "../lib/paths";
import type { FileRow, KindRow, ScrapeMetaView } from "../types";

type Props = {
  kinds: KindRow[];
  locationSearch: string;
  onNavigate: (path: string) => void;
  notify: NotifyFn;
};

const PAGE_SIZE = 30;

type RecordsUrlScope = {
  jobId: string;
  kind: string;
  sourceRoot: string;
  status: string;
  q: string;
  page: number;
  detailId: number | null;
};

function normalizeScopePath(path: string): string {
  return normalizeRelativePath(path);
}

function parseRecordsSearch(search: string): RecordsUrlScope {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  const jobId = params.get("jobId")?.trim() ?? "";
  const idRaw = params.get("id")?.trim() ?? "";
  const parsedId = idRaw ? parseInt(idRaw, 10) : NaN;
  const detailId = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null;
  return {
    jobId,
    kind: jobId ? "" : (params.get("kind")?.trim() ?? ""),
    sourceRoot: jobId ? "" : (params.get("sourceRoot")?.trim() ?? ""),
    status: jobId ? "" : (params.get("status") ?? ""),
    q: jobId ? "" : (params.get("q") ?? ""),
    page: Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1),
    detailId,
  };
}

function buildRecordsPath(search: string, detailId: number | null): string {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  if (detailId != null) {
    params.set("id", String(detailId));
  } else {
    params.delete("id");
  }
  const q = params.toString();
  return q ? `/records?${q}` : "/records";
}

function resolveScopedKind(kindId: string, sourceRoot: string, kinds: KindRow[]): string {
  if (kindId) return kindId;
  if (!sourceRoot) return "";
  const norm = normalizeScopePath(sourceRoot);
  const matched = kinds.find((k) => normalizeScopePath(k.sourceRoot || "") === norm);
  return matched?.id ?? "";
}

function resolveRecordsKind(scope: RecordsUrlScope, kinds: KindRow[]): string {
  if (scope.jobId) return "";
  if (scope.kind) return scope.kind;
  if (scope.sourceRoot) return resolveScopedKind("", scope.sourceRoot, kinds);
  return "";
}

function recordsListQuery(
  scope: RecordsUrlScope,
  resolvedKind: string,
  status: string,
  q: string,
  page: number,
) {
  return {
    kind: scope.jobId ? undefined : resolvedKind || undefined,
    sourceRoot: scope.jobId ? undefined : scope.sourceRoot || undefined,
    jobId: scope.jobId || undefined,
    status: scope.jobId ? undefined : status || undefined,
    q: scope.jobId ? undefined : q.trim() || undefined,
    page,
    pageSize: PAGE_SIZE,
  };
}

const RECORDS_STATUS_OPTIONS = [
  { value: "", label: "全部" },
  { value: "done", label: "成功" },
  { value: "failed", label: "失败" },
  { value: "skipped", label: "取消" },
  { value: "pending", label: "等待中" },
  { value: "scraping", label: "处理中" },
  { value: "planned", label: "重新整理排队中" },
  { value: "organizing", label: "重新整理中" },
] as const;

const RECORDS_TABLE_STATUS_LABELS: Record<string, string> = {
  ...FILE_STATUS_LABELS,
  done: "成功",
  failed: "失败",
  skipped: "取消",
  pending: "等待中",
  scraping: "处理中",
  scraped: "处理中",
  planned: "重新整理排队中",
  organizing: "重新整理中",
};

function formatRecordTime(ms?: number | null): string {
  if (!ms) return "—";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatRecordPathCells(f: FileRow): { text: string; title: string } {
  return formatRecordPaths(f.source_path, f.target_path ?? undefined);
}

function organizeModeForFile(f: FileRow, kinds: KindRow[]): string {
  const k = kinds.find((row) => row.id === f.kind);
  if (!k) return "—";
  return ORGANIZE_MODE_LABELS[k.organizeMode] ?? k.organizeMode;
}

function triggerLabel(f: FileRow, kinds: KindRow[]): string {
  const k = kinds.find((row) => row.id === f.kind);
  if (k?.enabled && k.sourceRoot?.trim()) return "监控";
  return "手动";
}

function recordStatusClass(status: string): string {
  if (status === "done") return "records-pill records-pill--success";
  if (status === "failed") return "records-pill records-pill--error";
  if (status === "pending" || status === "scraping" || status === "organizing" || status === "planned") {
    return "records-pill records-pill--processing";
  }
  return "records-pill records-pill--muted";
}

function isRecordsRowInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      'input, button, a, label, .records-actions-menu, .records-actions-dropdown, .records-col-check, .records-col-op',
    ),
  );
}

function isFileStopable(status: string): boolean {
  return (
    status === "pending" ||
    status === "scraping" ||
    status === "organizing" ||
    status === "planned"
  );
}

function isFileReorganizable(file: FileRow): boolean {
  return Boolean(file.code?.trim());
}

function isFileRetryable(status: string): boolean {
  return status === "failed" || status === "skipped";
}

type RowMenuProps = {
  file: FileRow;
  busy?: boolean;
  onView: () => void;
  onRetry: () => void;
  onStop: () => void;
  onReorganize: () => void;
  onDelete: () => void;
};

const RECORDS_DROPDOWN_GAP = 4;
const RECORDS_VIEWPORT_PAD = 8;

type DropdownPos = {
  top: number;
  left: number;
};

type RowMenuAction = "view" | "retry" | "stop" | "reorganize" | "delete";

function RecordsRowMenu({
  file,
  busy,
  onView,
  onRetry,
  onStop,
  onReorganize,
  onDelete,
}: RowMenuProps) {
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<DropdownPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const canStop = isFileStopable(file.status);
  const canReorganize = isFileReorganizable(file);
  const canRetry = isFileRetryable(file.status);

  const items: Array<{
    id: RowMenuAction;
    label: string;
    disabled?: boolean;
    title?: string;
  }> = [
    { id: "view", label: "查看", disabled: busy },
    { id: "retry", label: "重试", disabled: !canRetry || busy, title: canRetry ? undefined : "仅失败或已取消记录可重试" },
    {
      id: "stop",
      label: "终止",
      disabled: !canStop || busy,
      title: canStop ? undefined : "无进行中的任务",
    },
    {
      id: "reorganize",
      label: "重新整理",
      disabled: !canReorganize || busy,
      title: canReorganize ? undefined : "需有番号",
    },
    { id: "delete", label: "删除", disabled: busy },
  ];

  function run(action: RowMenuAction) {
    setOpen(false);
    if (action === "view") onView();
    if (action === "retry") onRetry();
    if (action === "stop") onStop();
    if (action === "reorganize") onReorganize();
    if (action === "delete") onDelete();
  }

  function updateDropdownPos() {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = dropdownRef.current?.offsetWidth ?? 128;
    const height = dropdownRef.current?.offsetHeight ?? 200;
    const left = Math.min(
      Math.max(RECORDS_VIEWPORT_PAD, rect.right - width),
      window.innerWidth - width - RECORDS_VIEWPORT_PAD,
    );
    const spaceBelow = window.innerHeight - rect.bottom - RECORDS_DROPDOWN_GAP;
    const spaceAbove = rect.top - RECORDS_DROPDOWN_GAP;
    const showAbove = spaceBelow < height && spaceAbove > spaceBelow;
    const top = showAbove
      ? rect.top - height - RECORDS_DROPDOWN_GAP
      : rect.bottom + RECORDS_DROPDOWN_GAP;
    setDropdownPos({ top, left });
  }

  useLayoutEffect(() => {
    if (!open) {
      setDropdownPos(null);
      return;
    }
    updateDropdownPos();
    const raf = requestAnimationFrame(updateDropdownPos);
    window.addEventListener("resize", updateDropdownPos);
    window.addEventListener("scroll", updateDropdownPos, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updateDropdownPos);
      window.removeEventListener("scroll", updateDropdownPos, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const dropdownMenu =
    open && dropdownPos
      ? createPortal(
          <div
            ref={dropdownRef}
            className="records-actions-dropdown is-portal"
            role="menu"
            style={{
              top: `${dropdownPos.top}px`,
              left: `${dropdownPos.left}px`,
            }}
          >
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className="records-actions-item"
                disabled={item.disabled}
                title={item.title}
                onClick={() => run(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className={`records-actions-menu${open ? " is-open" : ""}`}>
        <button
          ref={triggerRef}
          type="button"
          className="records-actions-trigger"
          aria-label="操作"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <EllipsisVerticalIcon aria-hidden />
        </button>
      </div>
      {dropdownMenu}
    </>
  );
}

export function RecordsPage({ kinds, locationSearch, onNavigate, notify }: Props) {
  const urlScope = useMemo(() => parseRecordsSearch(locationSearch), [locationSearch]);
  const scopedKind = useMemo(
    () => resolveScopedKind(urlScope.kind, urlScope.sourceRoot, kinds),
    [urlScope.kind, urlScope.sourceRoot, kinds],
  );

  const [status, setStatus] = useState(() => urlScope.status);
  const [q, setQ] = useState(() => urlScope.q);
  const [searchInput, setSearchInput] = useState(() => urlScope.q);
  const [jobScopeLabel, setJobScopeLabel] = useState("");
  const [page, setPage] = useState(() => urlScope.page);
  const [total, setTotal] = useState(0);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [batchActing, setBatchActing] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(() => urlScope.detailId);
  const [detailFile, setDetailFile] = useState<FileRow | null>(null);
  const [detailMeta, setDetailMeta] = useState<ScrapeMetaView | null>(null);
  const [detailLoading, setDetailLoading] = useState(() => urlScope.detailId != null);
  const [highlightSource, setHighlightSource] = useState<string | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Set<RecordColumnKey>>(() => loadVisibleColumns());
  const [batchModal, setBatchModal] = useState<RecordsBatchActionKind | null>(null);

  const resolvedKind = useMemo(
    () => resolveRecordsKind(urlScope, kinds),
    [urlScope, kinds],
  );
  const listQuery = useMemo(
    () => recordsListQuery(urlScope, resolvedKind, status, q, page),
    [urlScope, resolvedKind, status, q, page],
  );

  const scoped = Boolean(urlScope.jobId) || Boolean(urlScope.sourceRoot);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchFiles(listQuery);
      setFiles(data.files);
      setTotal(data.total);
    } catch (e) {
      notify("error", e, "加载刮削记录失败");
    } finally {
      setLoading(false);
    }
  }, [listQuery, notify]);

  useEffect(() => {
    setStatus(urlScope.status);
    setQ(urlScope.q);
    setSearchInput(urlScope.q);
    setPage(urlScope.page);
  }, [urlScope.jobId, urlScope.kind, urlScope.sourceRoot, urlScope.status, urlScope.q, urlScope.page]);

  useEffect(() => {
    if (!urlScope.jobId) {
      setJobScopeLabel("");
      return;
    }
    let cancelled = false;
    void fetchJob(urlScope.jobId)
      .then((data) => {
        if (!cancelled) setJobScopeLabel(formatJobSummaryLine(data.job));
      })
      .catch(() => {
        if (!cancelled) setJobScopeLabel(jobShortId(urlScope.jobId));
      });
    return () => {
      cancelled = true;
    };
  }, [urlScope.jobId]);

  useEffect(() => {
    if (searchInput.trim() === q) return;
    const t = setTimeout(() => {
      setQ(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput, q]);

  useEffect(() => {
    void load();
  }, [load]);

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

  useEffect(() => {
    setSelectAllMatching(false);
    setSelected(new Set());
  }, [status, q, urlScope.jobId, urlScope.sourceRoot, urlScope.kind]);

  useEffect(() => {
    if (selectAllMatching) return;
    setSelected(new Set());
  }, [page, selectAllMatching]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const idsOnPage = useMemo(() => files.map((f) => f.id), [files]);
  const selectedCount = selectAllMatching ? total : selected.size;
  const allSelected =
    selectAllMatching ||
    (idsOnPage.length > 0 && idsOnPage.every((id) => selected.has(id)));
  const listFilters = useMemo(() => {
    const { page: _page, pageSize: _pageSize, ...rest } = listQuery;
    return rest;
  }, [listQuery]);
  const orderedColumns = useMemo(
    () => RECORD_COLUMN_DEFS.filter((col) => visibleColumns.has(col.key)),
    [visibleColumns],
  );
  const colCount = 1 + orderedColumns.length;
  const statusLabel =
    RECORDS_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? "全部";

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

  async function collectMatchingIds(): Promise<number[]> {
    const ids: number[] = [];
    const pageSize = 200;
    let nextPage = 1;
    let pages = 1;
    do {
      const data = await fetchFiles({ ...listFilters, page: nextPage, pageSize });
      ids.push(...data.files.map((f) => f.id));
      pages = Math.max(1, Math.ceil(data.total / pageSize));
      nextPage += 1;
    } while (nextPage <= pages);
    return ids;
  }

  async function resolveSelectedIds(): Promise<number[]> {
    return selectAllMatching ? collectMatchingIds() : [...selected];
  }

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
      const r =
        retryMode === "reorganize" ? await reorganizeFiles(ids) : await retryFiles(ids);
      if (retryMode === "reorganize") {
        notify(
          "ok",
          r.updated ? `已加入重新整理队列 ${r.updated} 条` : "所选记录无法重新整理（需有番号）",
        );
      } else {
        notify("ok", r.updated ? `已重置 ${r.updated} 条为待处理` : "没有可重试的记录");
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
      notify("ok", `已删除 ${r.deleted} 条记录`);
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

  async function retryOne(id: number) {
    try {
      const r = await retryFiles([id]);
      notify("ok", r.updated ? "已重置为待处理" : "操作完成");
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
      notify(
        "ok",
        r.updated ? "已加入重新整理队列" : "无法重新整理（需有番号）",
      );
      void load();
    } catch (e) {
      notify("error", e, "重新整理失败");
    }
  }

  async function deleteOne(id: number) {
    if (!window.confirm("将删除该条刮削记录，确定继续？")) return;
    try {
      const r = await deleteFiles([id]);
      notify("ok", r.deleted ? "已删除" : "记录不存在");
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
        notify("ok", r.message || "已完整重刮并整理");
      } else {
        notify("warn", r.message || "刮削成功，整理未完成");
      }
      void load();
      if (detailId === id) void reloadDetail(id);
    } catch (e) {
      notify("error", e, opts.mode === "reorganize" ? "重新整理失败" : "重刮失败");
    }
  }

  function toggleAll(checked: boolean) {
    setSelectAllMatching(false);
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of idsOnPage) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function toggleOne(id: number, checked: boolean) {
    setSelectAllMatching(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setSelectAllMatching(false);
  }

  function selectAllMatchingRecords() {
    setSelectAllMatching(true);
    setSelected(new Set(idsOnPage));
  }

  function isRowSelected(id: number): boolean {
    return selectAllMatching || selected.has(id);
  }

  const titleScopeLabel = useMemo(() => {
    if (urlScope.jobId) return jobScopeLabel || jobShortId(urlScope.jobId);
    if (!urlScope.sourceRoot) return "";
    const label = scopedKind ? kindLabel(scopedKind) : "分区";
    return `${label} · ${displayRelativePath(urlScope.sourceRoot)}`;
  }, [urlScope.jobId, urlScope.sourceRoot, jobScopeLabel, scopedKind]);

  function renderRecordCell(
    col: RecordColumnKey,
    f: FileRow,
    paths: { text: string; title: string },
  ) {
    switch (col) {
      case "index":
        return (
          <td key={col} className={columnClassName(col)}>
            {f.id}
          </td>
        );
      case "code":
        return (
          <td key={col} className={columnClassName(col)}>
            <span className="records-code-link" title={f.code || undefined}>
              {f.code || "—"}
            </span>
          </td>
        );
      case "actors":
        return (
          <td key={col} className={columnClassName(col)} title={f.actors || undefined}>
            {f.actors || "—"}
          </td>
        );
      case "path":
        return (
          <td key={col} className={columnClassName(col)}>
            <div className="records-path-cell" title={paths.title}>
              {paths.text}
            </div>
          </td>
        );
      case "trigger":
        return (
          <td key={col} className={columnClassName(col)}>
            <span className="records-pill records-pill--trigger">{triggerLabel(f, kinds)}</span>
          </td>
        );
      case "mode":
        return (
          <td key={col} className={columnClassName(col)}>
            <span className="records-pill records-pill--mode">{organizeModeForFile(f, kinds)}</span>
          </td>
        );
      case "time":
        return (
          <td key={col} className={columnClassName(col)}>
            {formatRecordTime(f.scraped_at ?? f.file_mtime)}
          </td>
        );
      case "duration":
        return (
          <td key={col} className={columnClassName(col)}>
            {f.duration || "—"}
          </td>
        );
      case "status":
        return (
          <td key={col} className={columnClassName(col)}>
            <span className={recordStatusClass(f.status)}>
              {RECORDS_TABLE_STATUS_LABELS[f.status] ?? f.status}
            </span>
          </td>
        );
      case "title":
        return (
          <td key={col} className={columnClassName(col)} title={f.title || f.file_name}>
            {f.title || f.file_name || "—"}
          </td>
        );
      case "titleZh":
        return (
          <td key={col} className={columnClassName(col)} title={f.titleZh || undefined}>
            {f.titleZh || "—"}
          </td>
        );
      case "premiered":
        return (
          <td key={col} className={columnClassName(col)}>
            —
          </td>
        );
      case "coverSource":
        return (
          <td key={col} className={columnClassName(col)}>
            {f.scrape_source || "—"}
          </td>
        );
      case "op":
        return (
          <td key={col} className={columnClassName(col)}>
            <RecordsRowMenu
              file={f}
              onView={() => void openDetail(f.id)}
              onRetry={() => void retryOne(f.id)}
              onStop={() => void stopOne(f.id)}
              onReorganize={() => void reorganizeOne(f.id)}
              onDelete={() => void deleteOne(f.id)}
            />
          </td>
        );
      default:
        return null;
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

  if (detailId != null) {
    return (
      <RecordDetailView
        file={detailFile}
        meta={detailMeta}
        loading={detailLoading}
        detailId={detailId}
        listItems={files}
        highlightSource={highlightSource}
        onHighlightSource={setHighlightSource}
        onClose={closeDetail}
        onNavigate={(id) => void openDetail(id)}
        onTaskAction={(opts) => doTaskAction(detailId, opts)}
        onDelete={() => void deleteOne(detailId)}
        onMetaSave={(fields) => void saveDetailMeta(fields)}
        onMetaRefresh={setDetailMeta}
        onFileRefresh={() => void refreshDetailFile()}
      />
    );
  }

  return (
    <div className="records-page">
      <section className="panel records-shell">
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
                setPage(1);
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
                  onClick={() => setBatchModal("stop")}
                >
                  <StopIcon aria-hidden />
                </button>
                <button
                  type="button"
                  className="records-icon-btn"
                  title="重新整理"
                  disabled={loading || batchActing || selectedCount === 0}
                  onClick={() => setBatchModal("retry")}
                >
                  <ArrowPathIcon aria-hidden />
                </button>
                <button
                  type="button"
                  className="records-icon-btn records-icon-btn--danger"
                  title="删除"
                  disabled={loading || batchActing || selectedCount === 0}
                  onClick={() => setBatchModal("delete")}
                >
                  <TrashIcon aria-hidden />
                </button>
              </div>
            </div>
          </div>
        </header>

      <div className="records-table-wrap">
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
                <tr>
                  <td colSpan={colCount} className="empty">
                    加载中…
                  </td>
                </tr>
              ) : files.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="empty">
                    {COPY.emptyRecords}
                  </td>
                </tr>
              ) : (
                files.map((f) => {
                  const paths = formatRecordPathCells(f);
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
                      {orderedColumns.map((col) => renderRecordCell(col.key, f, paths))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {pageCount > 1 || total > 0 ? (
          <div className="pagination records-pagination">
            <button
              type="button"
              className="btn sm ghost"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </button>
            <span className="records-page-indicator">{page}</span>
            <button
              type="button"
              className="btn sm ghost"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </button>
          </div>
        ) : null}
      </section>

      <RecordsBatchActionModal
        open={batchModal != null}
        action={batchModal ?? "stop"}
        count={selectedCount}
        onClose={() => setBatchModal(null)}
        onConfirm={(opts) => void confirmBatchAction(opts)}
      />
    </div>
  );
}
