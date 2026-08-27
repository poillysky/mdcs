import { getJob } from "../../jobs/scheduler.js";

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
