import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchFiles,
  fetchIndexFolders,
  rescrapeFile,
  scrapeIndexedFiles,
  startIndexAll,
} from "../../../api";
import { setIndexAllRunning } from "../../../hooks/indexAllStore";
import { useSharedIndexAll } from "../../../hooks/useSharedIndexAll";
import { useSharedScrapeConfig } from "../../../hooks/useSharedScrapeConfig";
import { normalizeRelativePath } from "../../../lib/paths";
import type { FileRow, IndexFile, IndexFolder } from "../../../types";
import {
  buildBrowseFiles,
  filterBrowseFiles,
  kindCoveringPath,
  kindIdsForFolder,
  normalizeFolderPath,
  scrapeDisabledReason,
} from "../filesDisplay";
import {
  FILE_INDEX_PAGE_SIZE,
  FILE_PAGE_SIZE,
  FILES_DEFAULT_BROWSE_PATH,
  indexableKindIds,
  type CreateJobContext,
  type FilesPageProps,
} from "../types";

function sameFileList(a: FileRow[], b: FileRow[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = a[i];
    const right = b[i];
    if (
      left.id !== right.id ||
      left.status !== right.status ||
      left.code !== right.code ||
      left.file_name !== right.file_name ||
      left.file_mtime !== right.file_mtime
    ) {
      return false;
    }
  }
  return true;
}

type UseFilesPageArgs = Omit<FilesPageProps, "onNavigate" | "loading">;

async function fetchAllDirectIndexed(browsePath: string): Promise<FileRow[]> {
  const pageSize = FILE_INDEX_PAGE_SIZE;
  const first = await fetchFiles({
    sourceRoot: browsePath || undefined,
    directOnly: true,
    page: 1,
    pageSize,
  });
  if (first.total <= first.files.length) return first.files;
  const all = [...first.files];
  const pages = Math.ceil(first.total / pageSize);
  for (let page = 2; page <= pages; page++) {
    const next = await fetchFiles({
      sourceRoot: browsePath || undefined,
      directOnly: true,
      page,
      pageSize,
    });
    all.push(...next.files);
  }
  return all;
}

export function useFilesPage({ kinds, onChanged, notify }: UseFilesPageArgs) {
  const { config: scrapeConfig } = useSharedScrapeConfig({});
  const scrapeEnabled = Boolean(scrapeConfig?.enabled);
  const [browsePath, setBrowsePath] = useState(FILES_DEFAULT_BROWSE_PATH);
  const [treeParent, setTreeParent] = useState("");
  const [treeFolders, setTreeFolders] = useState<IndexFolder[]>([]);
  const [treeFiles, setTreeFiles] = useState<IndexFile[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [files, setFiles] = useState<FileRow[]>([]);
  const [filePage, setFilePage] = useState(1);
  const [fileStatus, setFileStatus] = useState("");
  const [filesLoading, setFilesLoading] = useState(false);
  const [scrapingId, setScrapingId] = useState<number | null>(null);
  const [scrapingAll, setScrapingAll] = useState(false);
  const [indexingSubmitting, setIndexingSubmitting] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createJobContext, setCreateJobContext] = useState<CreateJobContext>({});
  const filesLoadSeq = useRef(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("status");
    if (s) setFileStatus(s);
  }, []);

  const kindId = useMemo(
    () => kindCoveringPath(kinds, browsePath)?.id ?? "",
    [kinds, browsePath],
  );
  const kind = useMemo(
    () => (kindId ? kinds.find((k) => k.id === kindId) ?? null : null),
    [kinds, kindId],
  );
  const inKindScope = Boolean(kindId);

  const loadTree = useCallback(
    async (parent: string) => {
      setTreeLoading(true);
      try {
        const data = await fetchIndexFolders(parent);
        setTreeParent(data.parent);
        setTreeFolders(data.folders);
        setTreeFiles(data.files ?? []);
        setBrowsePath(normalizeRelativePath(data.parent || parent));
        setSelectedPaths(new Set());
      } catch (e) {
        notify("error", e, "读取目录失败");
      } finally {
        setTreeLoading(false);
      }
    },
    [notify],
  );

  const navigateToPath = useCallback(
    (path: string) => {
      const norm = normalizeRelativePath(path);
      setBrowsePath(norm);
      setFilePage(1);
      void loadTree(norm);
    },
    [loadTree],
  );

  useEffect(() => {
    void loadTree(FILES_DEFAULT_BROWSE_PATH);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFiles = useCallback(async (opts?: { silent?: boolean }) => {
    if (!kindId || !inKindScope) {
      setFiles([]);
      setFilesLoading(false);
      return;
    }
    const seq = ++filesLoadSeq.current;
    if (!opts?.silent) setFilesLoading(true);
    try {
      const direct = await fetchAllDirectIndexed(browsePath);
      if (seq !== filesLoadSeq.current) return;
      setFiles((prev) => (sameFileList(prev, direct) ? prev : direct));
    } catch (e) {
      if (seq !== filesLoadSeq.current) return;
      notify("error", e, "加载文件列表失败");
    } finally {
      if (seq === filesLoadSeq.current) setFilesLoading(false);
    }
  }, [kindId, browsePath, inKindScope, notify]);

  const handleIndexComplete = useCallback(() => {
    onChanged();
    if (inKindScope) {
      void loadFiles({ silent: true });
    }
  }, [onChanged, inKindScope, loadFiles]);

  const { indexStatus, indexingAll: indexRunning } = useSharedIndexAll({
    onComplete: handleIndexComplete,
  });
  const indexingAll = indexingSubmitting || indexRunning;

  useEffect(() => {
    if (treeLoading) return;
    void loadFiles();
  }, [loadFiles, treeLoading]);

  const browseFiles = useMemo(() => {
    if (!inKindScope) return [];
    const merged = buildBrowseFiles(treeFiles, files);
    return filterBrowseFiles(merged, fileStatus);
  }, [inKindScope, treeFiles, files, fileStatus]);
  const filePages = Math.max(1, Math.ceil(browseFiles.length / FILE_PAGE_SIZE));
  const pagedBrowseFiles = useMemo(() => {
    const start = (filePage - 1) * FILE_PAGE_SIZE;
    return browseFiles.slice(start, start + FILE_PAGE_SIZE);
  }, [browseFiles, filePage]);

  const crumbs = treeParent ? treeParent.split("/") : [];
  const selectedCount = selectedPaths.size;
  const allVisibleSelected =
    treeFolders.length > 0 && treeFolders.every((f) => selectedPaths.has(f.relative));

  function goCrumb(index: number) {
    if (index < 0) {
      navigateToPath("");
      return;
    }
    navigateToPath(crumbs.slice(0, index + 1).join("/"));
  }

  function toggleFolderSelect(relative: string) {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(relative)) next.delete(relative);
      else next.add(relative);
      return next;
    });
  }

  function openCreateJob(folderRelative?: string) {
    const folder = folderRelative ? normalizeFolderPath(folderRelative) : undefined;
    if (folder && !kindCoveringPath(kinds, folder)) {
      notify("warn", "该目录不在分区来源范围内，无法创建任务");
      return;
    }
    setCreateJobContext({
      folder,
      kindIds: folder ? kindIdsForFolder(kinds, folder) : undefined,
    });
    setCreateOpen(true);
  }

  function closeCreateJob() {
    setCreateOpen(false);
    setCreateJobContext({});
  }

  function handleJobCreated(_job?: import("../../../types").JobRow) {
    onChanged();
    if (inKindScope) {
      void loadFiles({ silent: true });
    }
  }

  async function indexAllLocal() {
    const kindIds = indexableKindIds(kinds);
    if (!kindIds.length) {
      notify("warn", "没有可索引的分区，请检查分区来源是否配置在本地索引下");
      return;
    }
    if (indexingAll) return;
    setIndexingSubmitting(true);
    try {
      const { index } = await startIndexAll(kindIds);
      setIndexAllRunning(index);
      notify("ok", `已开始全量索引（${kindIds.length} 个分区），后台扫描中…`);
      onChanged();
    } catch (e) {
      notify("error", e, "启动全量索引失败");
    } finally {
      setIndexingSubmitting(false);
    }
  }

  async function scrapeAllInScope() {
    if (!kind) return;
    if (!inKindScope) {
      notify("warn", "请先进入分区来源目录");
      return;
    }
    if (!scrapeEnabled) {
      notify("warn", "在线刮削未开启，请先在数据源设置中开启");
      return;
    }
    setScrapingAll(true);
    try {
      const r = await scrapeIndexedFiles({
        kind: kind.id,
        sourceRoot: browsePath || undefined,
      });
      if (!r.queued) {
        notify("warn", "当前范围内没有可刮削的已索引文件");
        return;
      }
      notify("ok", `已创建刮削任务，共 ${r.queued} 个文件`);
      onChanged();
      await loadFiles({ silent: true });
    } catch (e) {
      notify("error", e, "创建刮削任务失败");
    } finally {
      setScrapingAll(false);
    }
  }

  async function scrapeFileRow(file: FileRow) {
    const reason = scrapeDisabledReason(file, kinds, scrapeEnabled);
    if (reason) return;
    setScrapingId(file.id);
    try {
      const r = await rescrapeFile(file.id, true);
      notify(
        r.meta?.ok ? "ok" : "warn",
        r.meta?.ok ? "刮削完成" : r.meta?.message || "刮削未成功",
      );
      onChanged();
      await loadFiles({ silent: true });
    } catch (e) {
      notify("error", e, "刮削失败");
    } finally {
      setScrapingId(null);
    }
  }

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      setSelectedPaths(new Set());
      return;
    }
    setSelectedPaths(new Set(treeFolders.map((f) => f.relative)));
  }

  return {
    kind,
    kinds,
    browsePath,
    inKindScope,
    treeParent,
    treeLoading,
    selectedPaths,
    files,
    filePage,
    setFilePage,
    fileStatus,
    setFileStatus,
    filesLoading,
    scrapeEnabled,
    scrapingId,
    scrapingAll,
    indexingAll,
    indexingSubmitting,
    indexStatus,
    createOpen,
    createJobContext,
    crumbs,
    treeFolders,
    treeFiles,
    browseFiles,
    pagedBrowseFiles,
    filePages,
    selectedCount,
    allVisibleSelected,
    loadFiles,
    navigateToPath,
    goCrumb,
    toggleFolderSelect,
    openCreateJob,
    closeCreateJob,
    handleJobCreated,
    scrapeFileRow,
    scrapeAllInScope,
    indexAllLocal,
    toggleSelectAllVisible,
    onChanged,
    notify,
  };
}
