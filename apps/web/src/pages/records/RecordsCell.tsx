import { columnClassName, type RecordColumnKey } from "../../lib/recordsColumns";
import type { FileRow, KindRow } from "../../types";
import { RecordsRowMenu } from "./RecordsRowMenu";
import {
  recordTableStatusLabel,
  formatRecordTime,
  organizeModeForFile,
  recordStatusClass,
  triggerLabel,
  triggerPillClass,
} from "./recordsDisplay";

type Paths = { source: string; target?: string; title: string };

type Props = {
  col: RecordColumnKey;
  file: FileRow;
  paths: Paths;
  kinds: KindRow[];
  onView: () => void;
  onRetry: () => void;
  onStop: () => void;
  onReorganize: () => void;
  onDelete: () => void;
};

export function RecordsCell({
  col,
  file: f,
  paths,
  kinds,
  onView,
  onRetry,
  onStop,
  onReorganize,
  onDelete,
}: Props) {
  switch (col) {
    case "index":
      return (
        <td className={columnClassName(col)}>
          {f.id}
        </td>
      );
    case "code":
      return (
        <td className={columnClassName(col)}>
          <span className="records-code-link" title={f.code || undefined}>
            {f.code || "—"}
          </span>
        </td>
      );
    case "actors":
      return (
        <td className={columnClassName(col)} title={f.actors || undefined}>
          {f.actors || "—"}
        </td>
      );
    case "path":
      return (
        <td className={columnClassName(col)}>
          <div className="records-path-cell" title={paths.title}>
            {paths.target ? (
              <>
                <span className="records-path-part">{paths.source}</span>
                <span className="records-path-arrow"> → </span>
                <span className="records-path-part records-path-part--target">{paths.target}</span>
              </>
            ) : (
              <span className="records-path-part">{paths.source}</span>
            )}
          </div>
        </td>
      );
    case "trigger":
      return (
        <td className={columnClassName(col)}>
          <span className={triggerPillClass(f)}>{triggerLabel(f)}</span>
        </td>
      );
    case "mode":
      return (
        <td className={columnClassName(col)}>
          <span className="records-pill records-pill--mode">{organizeModeForFile(f, kinds)}</span>
        </td>
      );
    case "time":
      return (
        <td className={columnClassName(col)}>
          {formatRecordTime(f.scraped_at ?? f.file_mtime)}
        </td>
      );
    case "duration":
      return (
        <td className={columnClassName(col)}>
          {f.duration || "—"}
        </td>
      );
    case "status":
      return (
        <td className={columnClassName(col)}>
          <span className={recordStatusClass(f.status, f)}>
            {recordTableStatusLabel(f.status, f)}
          </span>
        </td>
      );
    case "title":
      return (
        <td className={columnClassName(col)} title={f.title || f.file_name}>
          {f.title || f.file_name || "—"}
        </td>
      );
    case "titleZh":
      return (
        <td className={columnClassName(col)} title={f.titleZh || undefined}>
          {f.titleZh || "—"}
        </td>
      );
    case "premiered":
      return <td className={columnClassName(col)}>—</td>;
    case "coverSource":
      return (
        <td className={columnClassName(col)}>
          {f.scrape_source || "—"}
        </td>
      );
    case "op":
      return (
        <td className={columnClassName(col)}>
          <RecordsRowMenu
            file={f}
            onView={onView}
            onRetry={onRetry}
            onStop={onStop}
            onReorganize={onReorganize}
            onDelete={onDelete}
          />
        </td>
      );
    default:
      return null;
  }
}
