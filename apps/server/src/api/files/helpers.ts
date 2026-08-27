import { getPipelineHistory, type PipelineRunKind } from "../../scrape/pipelineProgress.js";

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
