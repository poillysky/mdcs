/**
 * 对 scraped 记录试跑 completeScrapeWithNfo
 * 用法: npx tsx scripts/_probe-nfo-write.ts [fileId]
 */
import fs from "node:fs";
import { openDatabase } from "../src/db/init.js";
import { completeScrapeWithNfo } from "../src/organize/runner.js";

const fileId = Number(process.argv[2] || "90097");
const db = openDatabase();
const row = db
  .prepare(`SELECT id, code, status, target_path FROM files WHERE id = ?`)
  .get(fileId) as { id: number; code: string; status: string; target_path: string | null } | undefined;

if (!row) {
  console.error("file not found", fileId);
  process.exit(1);
}

console.log("before:", row);
const out = await completeScrapeWithNfo(fileId, {
  jobOptions: {
    useGlobal: { organize: false, nfo: true, watermark: true, download: true },
    organize: { onConflict: "overwrite" },
  },
});
const after = db
  .prepare(`SELECT id, code, status, target_path, error FROM files WHERE id = ?`)
  .get(fileId);
console.log("result:", out);
console.log("after:", after);
