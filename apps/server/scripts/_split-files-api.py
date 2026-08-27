"""Split api/files.ts into modules under api/files/."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src" / "api"
SRC = ROOT / "files.ts"
OUT = ROOT / "files"

lines = SRC.read_text(encoding="utf-8").splitlines(keepends=True)
OUT.mkdir(parents=True, exist_ok=True)

COMMON_IMPORTS = '''import { Router } from "express";
import path from "node:path";
import { openDatabase } from "../../db/init.js";
import { readScrapeCache, writeScrapeCache } from "../../scrape/cache.js";
import { applyMetaFieldPatches } from "../../scrape/metaPatch.js";
import { ensureSourceSnapshots } from "../../scrape/orchestrator.js";
import type { KindId } from "../../types.js";
import { KIND_IDS } from "../../types.js";
import { API_CODES } from "../codes.js";
import {
  findCachedCoverAbs,
  findLibraryAssetAbs,
  galleryAssetUrl,
  listGalleryAssets,
  loadFileRow,
} from "../libraryAssets.js";
import { sendFail, sendOk } from "../respond.js";
import { FILE_LIST_JOINS, FILE_LIST_SELECT, mapFileListRow } from "../fileListMap.js";
import {
  beginPipeline,
  endPipeline,
  getPipeline,
  getPipelineHistory,
} from "../../scrape/pipelineProgress.js";
import {
  applyCoverCrop,
  listCoverCropBrowse,
  resolveCoverCropPreviewAbs,
  resolveCoverCropSource,
  saveCoverCropUpload,
  type CoverCropRequest,
} from "../../organize/coverCrop.js";
import { applyJobFilesScope } from "./scope.js";
import { sendRemoteImage } from "./remoteImage.js";
import { parseFileIds, parsePipelineRunKind } from "./helpers.js";
import { coverCropUploadParser } from "./parsers.js";
'''

(OUT / "scope.ts").write_text(
    '''import { getJob } from "../../jobs/scheduler.js";

export function applyJobFilesScope(
  jobId: string,
  where: string[],
  params: (string | number)[],
): { ok: true } | { ok: false; message: string } {
  const job = getJob(jobId);
  if (!job) return { ok: false, message: "任务不存在" };
  where.push("f.job_id = ?");
  params.push(jobId);
  return { ok: true };
}
''',
    encoding="utf-8",
)

remote = "".join(lines[132:172]).replace(
    "async function sendRemoteImage", "export async function sendRemoteImage"
)
(OUT / "remoteImage.ts").write_text(remote, encoding="utf-8")

(OUT / "helpers.ts").write_text(
    '''import { getPipelineHistory, type PipelineRunKind } from "../../scrape/pipelineProgress.js";

export function parseFileIds(body: unknown): number[] {
  if (!body || typeof body !== "object") return [];
  const ids = (body as { ids?: unknown }).ids;
  if (!Array.isArray(ids)) return [];
  return ids.map((x) => Number(x)).filter((n) => Number.isFinite(n));
}

const PIPELINE_RUN_KINDS = new Set<PipelineRunKind>([
  "initial",
  "retry",
  "rescrape",
  "reorganize",
]);

export function parsePipelineRunKind(
  fileId: number,
  raw: unknown,
  mode: "rescrape" | "reorganize",
): PipelineRunKind {
  if (mode === "reorganize") {
    if (typeof raw === "string" && PIPELINE_RUN_KINDS.has(raw as PipelineRunKind)) {
      return raw as PipelineRunKind;
    }
    return "reorganize";
  }
  const history = getPipelineHistory(fileId);
  if (!history.some((r) => r.kind === "initial")) return "initial";
  if (typeof raw === "string" && PIPELINE_RUN_KINDS.has(raw as PipelineRunKind)) {
    return raw as PipelineRunKind;
  }
  return "retry";
}
''',
    encoding="utf-8",
)

(OUT / "parsers.ts").write_text(
    '''import express from "express";

export const coverCropUploadParser = express.json({ limit: "12mb" });
''',
    encoding="utf-8",
)

chunks = [
    ("listRoutes.ts", "registerListRoutes", 52, 131),
    ("assetRoutes.ts", "registerAssetRoutes", 173, 415),
    ("detailRoutes.ts", "registerDetailRoutes", 416, 473),
    ("batchRoutes.ts", "registerBatchRoutes", 474, 491),
    ("batchRoutes.ts", "registerBatchRoutes", 499, 556, True),
    ("snapshotRoutes.ts", "registerSnapshotRoutes", 557, 581),
    ("pipelineRoutes.ts", "registerPipelineRoutes", 582, 597),
    ("actionRoutes.ts", "registerActionRoutes", 625, 733),
]

written: dict[str, list[str]] = {}
for item in chunks:
    append = len(item) > 4 and item[4]
    fname, fn_name, start, end = item[:4]
    body = "".join(lines[start:end])
    written.setdefault(fname, []).append(body)

for fname, bodies in written.items():
    fn_name = {
        "listRoutes.ts": "registerListRoutes",
        "assetRoutes.ts": "registerAssetRoutes",
        "detailRoutes.ts": "registerDetailRoutes",
        "batchRoutes.ts": "registerBatchRoutes",
        "snapshotRoutes.ts": "registerSnapshotRoutes",
        "pipelineRoutes.ts": "registerPipelineRoutes",
        "actionRoutes.ts": "registerActionRoutes",
    }[fname]
    body = "".join(bodies)
    content = (
        COMMON_IMPORTS
        + f"\nexport function {fn_name}(filesRouter: Router) {{\n"
        + body
        + "}\n"
    )
    (OUT / fname).write_text(content, encoding="utf-8")

(OUT / "index.ts").write_text(
    '''import { Router } from "express";
import { registerListRoutes } from "./listRoutes.js";
import { registerAssetRoutes } from "./assetRoutes.js";
import { registerDetailRoutes } from "./detailRoutes.js";
import { registerBatchRoutes } from "./batchRoutes.js";
import { registerSnapshotRoutes } from "./snapshotRoutes.js";
import { registerPipelineRoutes } from "./pipelineRoutes.js";
import { registerActionRoutes } from "./actionRoutes.js";

export { coverCropUploadParser } from "./parsers.js";

export const filesRouter = Router();

registerListRoutes(filesRouter);
registerAssetRoutes(filesRouter);
registerDetailRoutes(filesRouter);
registerBatchRoutes(filesRouter);
registerSnapshotRoutes(filesRouter);
registerPipelineRoutes(filesRouter);
registerActionRoutes(filesRouter);
''',
    encoding="utf-8",
)

SRC.write_text('export { filesRouter, coverCropUploadParser } from "./files/index.js";\n', encoding="utf-8")
print("Split complete:", len(written), "route modules")
