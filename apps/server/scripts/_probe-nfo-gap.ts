/**
 * 诊断：status=done 但片库无 NFO，或 NFO 路径与预期不一致
 * 用法: npx tsx scripts/_probe-nfo-gap.ts [code]
 */
import fs from "node:fs";
import path from "node:path";
import { openDatabase } from "../src/db/init.js";
import { loadLibrariesConfig, resolveKind, resolveOrganizeForKind } from "../src/config/loadConfig.js";
import { readScrapeCache } from "../src/scrape/cache.js";
import { PROJECT_ROOT } from "../src/paths.js";
import { buildPlanForFile, type FileOrganizeRow } from "../src/organize/plan.js";
import { resolveNfoAbsBesideVideo, resolveStoredTargetAbs } from "../src/organize/libraryPaths.js";

const codeFilter = process.argv[2]?.trim();
const db = openDatabase();
const config = loadLibrariesConfig();

function listNfosInDir(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".nfo"));
}

const where = codeFilter
  ? `WHERE code LIKE '%' || ? || '%' OR source_path LIKE '%' || ? || '%'`
  : `WHERE status IN ('done', 'scraped')`;
const params = codeFilter ? [codeFilter, codeFilter] : [];

const rows = db
  .prepare(
    `SELECT id, kind, code, status, target_path, source_path, file_name, organized_at, scraped_at, error
     FROM files ${where}
     ORDER BY id DESC LIMIT ${codeFilter ? 20 : 50}`,
  )
  .all(...params) as Array<{
  id: number;
  kind: string;
  code: string;
  status: string;
  target_path: string | null;
  source_path: string;
  file_name: string;
  organized_at: number | null;
  scraped_at: number | null;
  error: string | null;
}>;

console.log(`=== NFO gap probe (${rows.length} rows) ===\n`);

let gapCount = 0;

for (const row of rows) {
  const kind = resolveKind(row.kind as never, config);
  const organize = kind ? resolveOrganizeForKind(row.kind as never, config) : null;
  const meta = row.code ? readScrapeCache(row.code, row.kind as never) : null;

  const fileRow: FileOrganizeRow = {
    id: row.id,
    kind: row.kind as never,
    source_path: row.source_path,
    file_name: row.file_name,
    code: row.code,
    status: row.status,
  };
  const plan = kind
    ? buildPlanForFile(fileRow, kind, {
        projectRoot: PROJECT_ROOT,
        onConflict: organize?.onConflict ?? "overwrite",
        organize: organize ?? undefined,
      })
    : null;

  const targetPath = row.target_path?.trim() || plan?.targetRel || null;
  const expectedFromPlan = plan?.nfoAbs ?? null;
  const expectedFromTarget =
    targetPath && kind
      ? resolveNfoAbsBesideVideo(
          resolveStoredTargetAbs(kind, targetPath),
          organize?.metadataDir,
          PROJECT_ROOT,
        )
      : null;

  const videoDir = targetPath && kind
    ? path.dirname(resolveStoredTargetAbs(kind, targetPath))
    : plan?.targetAbs
      ? path.dirname(plan.targetAbs)
      : null;

  const nfosBesideVideo = videoDir ? listNfosInDir(videoDir) : [];
  const planNfoExists = expectedFromPlan ? fs.existsSync(expectedFromPlan) : false;
  const targetNfoExists = expectedFromTarget ? fs.existsSync(expectedFromTarget) : false;

  const showsSuccess = row.status === "done";
  const hasAnyNfo = planNfoExists || targetNfoExists || nfosBesideVideo.length > 0;
  const isGap = showsSuccess && !hasAnyNfo;

  if (codeFilter || isGap || row.status === "scraped") {
    console.log(`#${row.id} ${row.code} status=${row.status} meta.ok=${meta?.ok ?? false}`);
    console.log(`  target_path: ${row.target_path ?? "(null)"}`);
    console.log(`  expected nfo (plan): ${expectedFromPlan ?? "(none)"} exists=${planNfoExists}`);
    console.log(`  expected nfo (target): ${expectedFromTarget ?? "(none)"} exists=${targetNfoExists}`);
    console.log(`  nfos beside video [${videoDir ?? "?"}]: ${nfosBesideVideo.join(", ") || "(none)"}`);
    if (row.error) console.log(`  error: ${row.error}`);
    if (isGap) {
      gapCount += 1;
      console.log(`  >>> GAP: done but no NFO on disk`);
    }
    if (row.status === "scraped" && meta?.ok) {
      console.log(`  >>> STUCK: scraped with meta but not done`);
    }
    console.log();
  }
}

console.log(`done-without-nfo gaps in sample: ${gapCount}`);
