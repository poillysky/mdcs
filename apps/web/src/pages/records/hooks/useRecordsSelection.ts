import { useEffect, useMemo, useState } from "react";
import { fetchFiles } from "../../../api";
import type { FileRow } from "../../../types";
import type { RecordsUrlScope } from "../recordsScope";

type ListFilters = {
  kind?: string;
  sourceRoot?: string;
  jobId?: string;
  status?: string;
  q?: string;
};

type Args = {
  files: FileRow[];
  total: number;
  page: number;
  status: string;
  q: string;
  urlScope: RecordsUrlScope;
  listFilters: ListFilters;
};

export function useRecordsSelection({
  files,
  total,
  page,
  status,
  q,
  urlScope,
  listFilters,
}: Args) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);

  useEffect(() => {
    setSelectAllMatching(false);
    setSelected(new Set());
  }, [status, q, urlScope.jobId, urlScope.sourceRoot, urlScope.kind]);

  useEffect(() => {
    if (selectAllMatching) return;
    setSelected(new Set());
  }, [page, selectAllMatching]);

  const idsOnPage = useMemo(() => files.map((f) => f.id), [files]);
  const selectedCount = selectAllMatching ? total : selected.size;
  const allSelected =
    selectAllMatching ||
    (idsOnPage.length > 0 && idsOnPage.every((id) => selected.has(id)));

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

  return {
    selectAllMatching,
    selectedCount,
    allSelected,
    toggleAll,
    toggleOne,
    clearSelection,
    selectAllMatchingRecords,
    isRowSelected,
    resolveSelectedIds,
  };
}
