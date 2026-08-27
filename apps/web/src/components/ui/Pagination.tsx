type PaginationProps = {
  page: number;
  pageCount: number;
  total?: number;
  onPageChange: (page: number) => void;
  className?: string;
  metaClassName?: string;
};

export function Pagination({
  page,
  pageCount,
  total,
  onPageChange,
  className = "pagination",
  metaClassName,
}: PaginationProps) {
  if (pageCount <= 1 && (total ?? 0) <= 0) return null;

  const meta =
    total != null ? (
      <span className={metaClassName}>
        共 {total} 条{pageCount > 1 ? ` · 第 ${page}/${pageCount} 页` : ""}
      </span>
    ) : null;

  return (
    <footer className={className}>
      {meta}
      <div className="pagination-controls">
        <button
          type="button"
          className="btn sm ghost"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          上一页
        </button>
        <span className="records-page-indicator">{page}</span>
        <button
          type="button"
          className="btn sm ghost"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          下一页
        </button>
      </div>
    </footer>
  );
}
