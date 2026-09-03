type Props = {
  colCount: number;
  rowCount?: number;
};

export function TableSkeleton({ colCount, rowCount = 6 }: Props) {
  return (
    <>
      {Array.from({ length: rowCount }, (_, row) => (
        <tr key={row} className="table-skeleton-row" aria-hidden>
          {Array.from({ length: colCount }, (__, col) => (
            <td key={col}>
              <span className="ui-skeleton" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
