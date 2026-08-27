"""Split RecordDetailView.tsx into recordDetail/ modules."""
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "src" / "components" / "RecordDetailView.tsx"
OUT = Path(__file__).resolve().parents[1] / "src" / "components" / "recordDetail"
lines = SRC.read_text(encoding="utf-8").splitlines(keepends=True)
OUT.mkdir(parents=True, exist_ok=True)

# Keep body of main component (lines 566-1197, 1-indexed) = indices 565:
main_body = "".join(lines[565:])  # export function RecordDetailView... through end

(OUT / "types.ts").write_text(
    '''import type { RecordTaskActionOptions } from "../RecordTaskActionModal";
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
''',
    encoding="utf-8",
)

# detailFields: lines 155-288 (1-indexed) = 154:288
detail_body = "".join(lines[154:288]).replace("function ", "export function ", 8)
# Only first occurrences of each function - do carefully
detail_funcs = "".join(lines[154:288])
for name in (
    "formatFieldValue",
    "formatRuntime",
    "formatRating",
    "mosaicLabel",
    "sourceBadgeClass",
    "fullNavLabel",
    "shortNavLabel",
    "detectResolutionLabel",
    "buildDetailFields",
):
    detail_funcs = detail_funcs.replace(f"function {name}", f"export function {name}", 1)

(OUT / "detailFields.ts").write_text(
    '''import {
  resolveCoverUrl,
  resolveRemotePosterUrl,
  resolvePublishNumber,
} from "../../lib/metaDisplay";
import type { FileRow, ScrapeMetaView } from "../../types";
import type { DetailField } from "./types";

'''
    + detail_funcs,
    encoding="utf-8",
)

# pipelineLog: lines 57-134 + 290-544
pipe_head = "".join(lines[56:134])  # PIPELINE_KIND_LABELS through toLogRunOption
pipe_tail = "".join(lines[289:544])  # formatMs through buildLogSteps
for name in (
    "formatPipelineAt",
    "pipelineRunLabel",
    "sortLogRunsChronological",
    "pickLatestLogRun",
    "parseScrapedAtMs",
    "sanitizePipelineLogText",
    "toLogRunOption",
    "formatMs",
    "codeSearchVariants",
    "isNonCriticalSourceError",
    "sourceRunTone",
    "buildLogSteps",
):
    pipe_head = pipe_head.replace(f"function {name}", f"export function {name}", 1)
    pipe_tail = pipe_tail.replace(f"function {name}", f"export function {name}", 1)
pipe_head = pipe_head.replace(
    "const PIPELINE_KIND_LABELS",
    "export const PIPELINE_KIND_LABELS",
    1,
)

(OUT / "pipelineLog.ts").write_text(
    '''import { kindLabel } from "../../lib/labels";
import { displayRelativePath, looksAbsolutePath } from "../../lib/paths";
import type { PipelineRunKind, PipelineRunView } from "../../api";
import type { FileRow, ScrapeMetaView } from "../../types";
import type { LogItem, LogRunOption, LogStep, LogTone } from "./types";

'''
    + pipe_head
    + pipe_tail,
    encoding="utf-8",
)

(OUT / "FieldSourceBadge.tsx").write_text(
    '''import { displayFieldSource } from "../../lib/labels";
import { sourceBadgeClass } from "./detailFields";

export function FieldSourceBadge({
  source,
  active,
  onClick,
}: {
  source: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${sourceBadgeClass(source)}${active ? " is-active" : ""}`}
      onClick={onClick}
    >
      {displayFieldSource(source)}
    </button>
  );
}
''',
    encoding="utf-8",
)

# Main view: replace Props with RecordDetailViewProps and fix imports
main = main_body.replace("}: Props)", "}: RecordDetailViewProps)")
main = main.replace(
    "export function RecordDetailView({",
    "export function RecordDetailView({",
)

(OUT / "RecordDetailView.tsx").write_text(
    '''import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import {
  ArrowPathIcon,
  CheckIcon,
  PencilSquareIcon,
  PhotoIcon,
  StarIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";
import { useEffect, useMemo, useRef, useState } from "react";
import { LazyCover } from "../LazyCover";
import { CoverCropModal } from "../CoverCropModal";
import { RecordMetaEditModal } from "../RecordMetaEditModal";
import { RecordTaskActionModal } from "../RecordTaskActionModal";
import { FILE_STATUS_LABELS } from "../../lib/labels";
import {
  appendAssetCacheBust,
  resolveCoverImageSrc,
  resolveGalleryImageSrcs,
} from "../../lib/metaDisplay";
import { fetchFileGallery, fetchFilePipelineLog } from "../../api";
import type { LogRunOption, LogStep, RecordDetailViewProps } from "./types";
import {
  buildDetailFields,
  formatFieldValue,
  formatRating,
  formatRuntime,
  fullNavLabel,
  mosaicLabel,
  shortNavLabel,
} from "./detailFields";
import {
  buildLogSteps,
  parseScrapedAtMs,
  pickLatestLogRun,
  pipelineRunLabel,
  sanitizePipelineLogText,
  sortLogRunsChronological,
  toLogRunOption,
} from "./pipelineLog";
import { FieldSourceBadge } from "./FieldSourceBadge";

'''
    + main,
    encoding="utf-8",
)

(OUT / "index.ts").write_text(
    '''export { RecordDetailView } from "./RecordDetailView";
export type { RecordDetailViewProps } from "./types";
''',
    encoding="utf-8",
)

SRC.write_text('export { RecordDetailView } from "./recordDetail";\n', encoding="utf-8")
print("Split RecordDetailView complete")
