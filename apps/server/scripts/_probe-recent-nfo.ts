import { openDatabase } from "../src/db/init.js";
import fs from "node:fs";
import path from "node:path";
import { loadLibrariesConfig, resolveKind } from "../src/config/loadConfig.js";
import { readScrapeCache } from "../src/scrape/cache.js";
import { resolveNfoAbsBesideVideo, resolveStoredTargetAbs } from "../src/organize/libraryPaths.js";
import { buildPlanForFile } from "../src/organize/plan.js";
import { PROJECT_ROOT } from "../src/paths.js";

const db = openDatabase();
const config = loadLibrariesConfig();

const rows = db
  .prepare(
    `SELECT id, code, kind, status, target_path, source_path, file_name, error, scraped_at, organized_at
     FROM files
     WHERE status IN ('done','scraped','indexed','failed')
       AND code IS NOT NULL
     ORDER BY COALESCE(organized_at, scraped_at, id) DESC
     LIMIT 20`,
  )
  .all() as Array<Record<string, unknown>>;

console.log("=== recent records ===\n");
for (const row of rows) {
  const kind = resolveKind(String(row.kind) as never, config);
  const meta = readScrapeCache(String(row.code), String(row.kind) as never);
  let nfoPath = "";
  let nfoExists = false;
  const tp = String(row.target_path || "").trim();
  if (kind && tp) {
    nfoPath = resolveNfoAbsBesideVideo(resolveStoredTargetAbs(kind, tp), "", PROJECT_ROOT);
    nfoExists = fs.existsSync(nfoPath);
  } else if (kind && row.code) {
    const plan = buildPlanForFile(
      {
        id: Number(row.id),
        kind: String(row.kind) as never,
        source_path: String(row.source_path),
        file_name: String(row.file_name),
        code: String(row.code),
        status: String(row.status),
      },
      kind,
      { projectRoot: PROJECT_ROOT, onConflict: "overwrite" },
    );
    if (plan) {
      nfoPath = plan.nfoAbs;
      nfoExists = fs.existsSync(nfoPath);
    }
  }
  console.log(
    `#${row.id} ${row.code} status=${row.status} meta.ok=${meta?.ok ?? false} nfo=${nfoExists ? "YES" : "NO"}`,
  );
  if (tp) console.log(`  target_path: ${tp}`);
  if (nfoPath) console.log(`  nfo path: ${nfoPath}`);
  if (row.error) console.log(`  error: ${row.error}`);
  console.log();
}
