import { Router } from "express";
import { getPipeline, getPipelineHistory } from "../../scrape/pipelineProgress.js";
import { API_CODES } from "../codes.js";
import { sendFail, sendOk } from "../respond.js";

export function registerPipelineRoutes(filesRouter: Router) {
filesRouter.get("/:id/pipeline-log", (req, res) => {
  const fileId = Number(req.params.id);
  if (!Number.isFinite(fileId)) {
    sendFail(res, "无效 id", 400, API_CODES.missing_code);
    return;
  }
  const state = getPipeline(fileId);
  sendOk(res, {
    active: state?.active ?? false,
    mode: state?.mode,
    kind: state?.kind,
    steps: state?.steps ?? [],
    runs: getPipelineHistory(fileId),
  });
});
}
