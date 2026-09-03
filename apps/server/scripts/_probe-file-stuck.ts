import { openDatabase } from "../src/db/init.js";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../src/paths.js";

const code = process.argv[2]?.trim() || "HMN-246";
const db = openDatabase();

const rows = db
  .prepare(
    `SELECT id, code, status, error, job_id, scraped_at, organized_at, source_path, file_mtime
     FROM files
     WHERE code LIKE ? OR source_path LIKE ?
     ORDER BY id DESC LIMIT 5`,
  )
  .all(`%${code}%`, `%${code}%`) as Array<Record<string, unknown>>;

console.log("--- files matching", code);
for (const row of rows) {
  console.log(JSON.stringify(row, null, 2));

  const fileId = Number(row.id);
  const logDir = path.join(DATA_DIR, "pipeline-logs", String(fileId));
  if (fs.existsSync(logDir)) {
    const runs = fs
      .readdirSync(logDir)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .slice(-3);
    for (const run of runs) {
      const raw = JSON.parse(fs.readFileSync(path.join(logDir, run), "utf8")) as {
        runId?: string;
        active?: boolean;
        steps?: Array<{ id: string; label: string; status: string; detail?: string }>;
      };
      console.log(`\n  pipeline ${run}: active=${raw.active}`);
      for (const s of raw.steps ?? []) {
        console.log(`    [${s.status}] ${s.id}: ${s.label}${s.detail ? ` — ${s.detail}` : ""}`);
      }
    }
  } else {
    console.log("  (no pipeline logs)");
  }
}

const scraping = db
  .prepare(
    `SELECT COUNT(*) AS c FROM files WHERE status = 'scraping' AND scraped_at IS NULL`,
  )
  .get() as { c: number };
console.log("\n--- global scraping inflight:", scraping.c);
