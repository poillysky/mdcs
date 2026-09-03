import { openDatabase } from "../src/db/init.js";
import fs from "node:fs";
import path from "node:path";
import { loadLibrariesConfig, resolveKind } from "../src/config/loadConfig.js";
import { PROJECT_ROOT } from "../src/paths.js";
import { resolveNfoAbsBesideVideo, resolveStoredTargetAbs } from "../src/organize/libraryPaths.js";

const db = openDatabase();
const config = loadLibrariesConfig();

const stats = db
  .prepare(`SELECT status, COUNT(*) AS c FROM files GROUP BY status ORDER BY c DESC`)
  .all();
console.log("status counts:", stats);

const done = db
  .prepare(
    `SELECT id, code, kind, status, target_path FROM files WHERE status = 'done' ORDER BY organized_at DESC LIMIT 30`,
  )
  .all() as Array<Record<string, unknown>>;

let noTarget = 0;
let noNfo = 0;
for (const row of done) {
  const tp = String(row.target_path || "");
  if (!tp) {
    noTarget += 1;
    continue;
  }
  const kind = resolveKind(String(row.kind) as never, config);
  if (!kind) continue;
  const videoAbs = resolveStoredTargetAbs(kind, tp);
  const nfoAbs = resolveNfoAbsBesideVideo(videoAbs, "", PROJECT_ROOT);
  const has = fs.existsSync(nfoAbs);
  if (!has) {
    noNfo += 1;
    const dir = path.dirname(videoAbs);
    console.log(`NO NFO: #${row.id} ${row.code} nfo=${nfoAbs}`);
    if (fs.existsSync(dir)) console.log("  dir:", fs.readdirSync(dir).join(", "));
    else console.log("  dir missing:", dir);
  }
}
console.log(`\ndone sample=${done.length}, no target=${noTarget}, no nfo=${noNfo}`);
