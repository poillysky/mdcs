import type { ReactNode } from "react";
import { TableSkeleton } from "../../components/ui/TableSkeleton";

export function ActorsTable({
  loading,
  refreshing = false,
  emptyText,
  colCount,
  allSelected,
  onToggleAll,
  children,
}: {
  loading: boolean;
  refreshing?: boolean;
  emptyText: string;
  colCount: number;
  allSelected: boolean;
  onToggleAll: (checked: boolean) => void;
  children: ReactNode;
}) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <div className={`records-table-wrap${refreshing ? " is-refreshing" : ""}`}>
      <table className="records-table data-table actors-table">
        <colgroup>
          <col className="records-col-check" />
          <col className="records-col-index" />
          <col className="actors-col-avatar" />
          <col className="actors-col-name" />
          <col className="actors-col-status" />
          <col className="actors-col-backdrop" />
          <col className="actors-col-detail" />
          <col className="records-col-time" />
          <col className="records-col-time" />
          <col className="actors-col-error" />
          <col className="records-col-op" />
        </colgroup>
        <thead>
          <tr>
            <th className="records-col-check">
              <input
                type="checkbox"
                aria-label="全选"
                checked={allSelected}
                onChange={(e) => onToggleAll(e.target.checked)}
              />
            </th>
            <th className="records-col-index">#</th>
            <th className="actors-col-avatar">头像</th>
            <th className="actors-col-name">演员名称</th>
            <th className="actors-col-status">状态</th>
            <th className="actors-col-backdrop">背景图</th>
            <th className="actors-col-detail">详细信息</th>
            <th className="records-col-time">创建时间</th>
            <th className="records-col-time">完成时间</th>
            <th className="actors-col-error">错误信息</th>
            <th className="records-col-op">操作</th>
          </tr>
        </thead>
        <tbody>
          {loading && !hasRows ? (
            <TableSkeleton colCount={colCount} rowCount={8} />
          ) : !hasRows ? (
            <tr>
              <td colSpan={colCount} className="empty">
                {emptyText}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}
