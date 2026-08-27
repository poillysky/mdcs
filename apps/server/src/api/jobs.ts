import { Router } from "express";
import { openDatabase } from "../db/init.js";
import {
  cancelJob,
  createJob,
  deleteJob,
  getJob,
  pauseJob,
  queryJobs,
  resumeJob,
} from "../jobs/scheduler.js";
import type { JobMode } from "../types.js";
import { sendFail, sendOk } from "./respond.js";

export const jobsRouter = Router();

jobsRouter.get("/", (req, res) => {
  const result = queryJobs({
    status: req.query.status ? String(req.query.status) : undefined,
    mode: req.query.mode ? String(req.query.mode) : undefined,
    q: req.query.q ? String(req.query.q) : undefined,
    page: parseInt(String(req.query.page ?? "1"), 10) || 1,
    pageSize: parseInt(String(req.query.pageSize ?? "20"), 10) || 20,
  });
  sendOk(res, result);
});

jobsRouter.get("/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return sendFail(res, "任务不存在", 404, "job_not_found");
  sendOk(res, { job });
});

jobsRouter.post("/", async (req, res) => {
  try {
    const mode = (req.body?.mode ?? "scan_only") as JobMode;
    const job = await createJob({
      kinds: req.body?.kinds,
      mode,
      dryRun: Boolean(req.body?.dryRun),
      options: req.body?.options,
    });
    sendOk(res, { job });
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 400, "job_create_invalid");
  }
});

jobsRouter.post("/:id/pause", (req, res) => {
  const job = pauseJob(req.params.id);
  if (!job) return sendFail(res, "任务不存在", 404, "job_not_found");
  sendOk(res, { job });
});

jobsRouter.post("/:id/resume", (req, res) => {
  const job = resumeJob(req.params.id);
  if (!job) return sendFail(res, "任务不存在", 404, "job_not_found");
  sendOk(res, { job });
});

jobsRouter.post("/:id/cancel", (req, res) => {
  const job = cancelJob(req.params.id);
  if (!job) return sendFail(res, "任务不存在", 404, "job_not_found");
  sendOk(res, { job });
});

jobsRouter.delete("/:id", (req, res) => {
  try {
    const ok = deleteJob(req.params.id);
    if (!ok) return sendFail(res, "任务不存在", 404, "job_not_found");
    sendOk(res, { deleted: true });
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 400, "job_delete_invalid");
  }
});

jobsRouter.get("/:id/files-sample", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return sendFail(res, "任务不存在", 404, "job_not_found");
  const db = openDatabase();
  const rows = db
    .prepare(
      `SELECT id, kind, source_path, file_name, code, status FROM files ORDER BY id DESC LIMIT 20`,
    )
    .all();
  sendOk(res, { job, files: rows });
});
