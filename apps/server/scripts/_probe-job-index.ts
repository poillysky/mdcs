import { loadLibrariesConfig, pickKinds } from "../src/config/loadConfig.js";
import { openDatabase } from "../src/db/init.js";
import { computeJobFileStats } from "../src/jobs/fileStats.js";
import { resolveKindScanAbs } from "../src/jobs/scanner.js";
import { normalizeJobOptions } from "../src/jobs/options.js";
import { organizeWalkFilter, walkVideoFiles } from "../src/library/scanFilter.js";
import { PROJECT_ROOT } from "../src/paths.js";
import type { JobRecord } from "../src/types.js";

function rowToJob(row: Record<string, unknown>): JobRecord {
  const options = normalizeJobOptions(row.options_json ? JSON.parse(String(row.options_json)) : {});
  return {
    id: String(row.id),
    kinds: JSON.parse(String(row.kinds)) as JobRecord["kinds"],
    mode: row.mode as JobRecord["mode"],
    dryRun: Boolean(row.dry_run),
    options: Object.keys(options).length ? options : undefined,
    triggerSource: String(row.trigger_source) === "monitor" ? "monitor" : "manual",
    status: row.status as JobRecord["status"],
    total: Number(row.total),
    processed: Number(row.processed),
    failed: Number(row.failed),
    skipped: Number(row.skipped),
    message: row.message ? String(row.message) : undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

const db = openDatabase();
const jobs = db
  .prepare(`SELECT * FROM jobs ORDER BY created_at DESC LIMIT 5`)
  .all() as Array<Record<string, unknown>>;

if (!jobs.length) {
  console.log("no jobs");
  process.exit(0);
}

const filter = organizeWalkFilter(loadLibrariesConfig().organize);

for (const row of jobs) {
  const job = rowToJob(row);
  const fs = computeJobFileStats(job);
  const scanPath = job.options?.scanPath?.trim() ?? "";
  console.log("\n---", job.id, job.status, job.mode);
  console.log("  scanPath:", scanPath || "(whole kind root)");
  console.log("  job.total:", job.total, " job.skipped:", job.skipped);
  console.log("  fileStats.total:", fs.total, " success:", fs.success, " queued:", fs.queued);

  let walkCount = 0;
  let scanAbs = "";
  try {
    const kinds = pickKinds(job.kinds);
    const kind = kinds[0];
    if (kind) {
      scanAbs = scanPath ? resolveKindScanAbs(kind, scanPath) : kind.sourceAbs ?? "";
      if (scanAbs) walkCount = walkVideoFiles(scanAbs, filter).length;
    }
  } catch (e) {
    console.log("  walk error:", e instanceof Error ? e.message : e);
  }
  console.log("  scanAbs:", scanAbs);
  console.log("  walkVideoFiles:", walkCount);

  if (scanPath) {
    const rel = scanPath.replace(/\\/g, "/");
    const placeholders = job.kinds.map(() => "?").join(",");
    const dbInScope = db
      .prepare(
        `SELECT COUNT(*) AS c FROM files WHERE kind IN (${placeholders})
         AND (source_path = ? OR source_path LIKE ?)`,
      )
      .get(...job.kinds, rel, `${rel}/%`) as { c: number };
    console.log("  db files in scope:", dbInScope.c);

    const jobIdCount = db
      .prepare(`SELECT COUNT(*) AS c FROM files WHERE job_id = ?`)
      .get(job.id) as { c: number };
    console.log("  files with job_id:", jobIdCount.c);
  }
}
