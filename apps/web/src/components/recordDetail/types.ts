import type { RecordTaskActionOptions } from "../RecordTaskActionModal";
import type { PipelineRunKind } from "../../api";
import type { FileRow, ScrapeMetaView } from "../../types";

export type DetailField = {
  key: string;
  label: string;
  value: unknown;
  sourceKey?: string;
  multiline?: boolean;
  isTags?: boolean;
  isLink?: boolean;
};

export type LogTone = "ok" | "warn" | "info" | "fail";

export type LogItem = { tone: LogTone; text: string };

export type LogStep = { title: string; done: boolean; items: LogItem[] };

export type LogRunOption = {
  id: string;
  kind: PipelineRunKind;
  at: number;
  steps: LogStep[];
};

export type RecordDetailViewProps = {
  file: FileRow | null;
  meta: ScrapeMetaView | null;
  loading: boolean;
  detailId: number;
  listItems: FileRow[];
  highlightSource: string | null;
  onHighlightSource: (source: string | null) => void;
  onClose: () => void;
  onNavigate: (id: number) => void;
  onTaskAction: (opts: RecordTaskActionOptions) => void | Promise<void>;
  onDelete: () => void;
  onMetaSave?: (
    fields: Record<string, { value: string; source: string }>,
  ) => void | Promise<void>;
  onMetaRefresh?: (meta: ScrapeMetaView) => void;
  onFileRefresh?: () => void | Promise<void>;
};
