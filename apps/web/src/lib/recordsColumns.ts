export type RecordColumnKey =
  | "index"
  | "code"
  | "actors"
  | "path"
  | "trigger"
  | "mode"
  | "time"
  | "duration"
  | "status"
  | "op"
  | "title"
  | "titleZh"
  | "premiered"
  | "coverSource";

export type RecordColumnDef = {
  key: RecordColumnKey;
  label: string;
  defaultVisible: boolean;
  locked?: boolean;
};

export const RECORD_COLUMN_DEFS: RecordColumnDef[] = [
  { key: "index", label: "#", defaultVisible: true, locked: true },
  { key: "code", label: "番号", defaultVisible: true },
  { key: "actors", label: "演员", defaultVisible: true },
  { key: "path", label: "目录", defaultVisible: true },
  { key: "trigger", label: "触发", defaultVisible: true },
  { key: "mode", label: "整理模式", defaultVisible: true },
  { key: "time", label: "创建时间", defaultVisible: true },
  { key: "duration", label: "用时", defaultVisible: true },
  { key: "status", label: "状态", defaultVisible: true },
  { key: "op", label: "操作", defaultVisible: true, locked: true },
  { key: "title", label: "标题", defaultVisible: false },
  { key: "titleZh", label: "原标题", defaultVisible: false },
  { key: "premiered", label: "发布日期", defaultVisible: false },
  { key: "coverSource", label: "海报来源", defaultVisible: false },
];

const STORAGE_KEY = "mdcs.records.columns";

export function loadVisibleColumns(): Set<RecordColumnKey> {
  const defaults = new Set(
    RECORD_COLUMN_DEFS.filter((col) => col.defaultVisible).map((col) => col.key),
  );
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as RecordColumnKey[];
    if (!Array.isArray(parsed)) return defaults;
    const next = new Set(parsed);
    for (const col of RECORD_COLUMN_DEFS) {
      if (col.locked) next.add(col.key);
    }
    return next.size ? next : defaults;
  } catch {
    return defaults;
  }
}

export function saveVisibleColumns(cols: Set<RecordColumnKey>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...cols]));
}

export function columnClassName(key: RecordColumnKey): string {
  return `records-col-${key}`;
}
