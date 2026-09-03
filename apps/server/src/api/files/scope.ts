import { buildJobFilesScopeWhere, jobHasBoundedFileScope } from "../../jobs/jobFilesScope.js";
import { getJob } from "../../jobs/scheduler.js";

export function applyJobFilesScope(
  jobId: string,
  where: string[],
  params: (string | number)[],
): { ok: true } | { ok: false; message: string } {
  const job = getJob(jobId);
  if (!job) return { ok: false, message: "任务不存在" };

  if (jobHasBoundedFileScope(job)) {
    const scope = buildJobFilesScopeWhere(job, "f");
    if (!scope) return { ok: false, message: "任务范围无效" };
    where.push(`(${scope.sql})`);
    params.push(...scope.params);
    return { ok: true };
  }

  where.push("f.job_id = ?");
  params.push(jobId);
  return { ok: true };
}
