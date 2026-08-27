import { DatabaseSync } from "node:sqlite";
import { listResolvedKinds, loadLibrariesConfig } from "../config/loadConfig.js";
import {
  DB_PATH,
  DATA_DIR,
  LEGACY_DB_PATH,
  ensureDir,
  pathExists,
  readTextFile,
  SCHEMA_PATH,
} from "../paths.js";
import type { KindId } from "../types.js";
import fs from "node:fs";

let db: DatabaseSync | null = null;

/** 首次启动时将旧库 scrap.db（及 WAL/SHM）重命名为 mdcs.db */
function migrateLegacyDatabaseFile(): void {
  if (pathExists(DB_PATH)) return;
  if (!pathExists(LEGACY_DB_PATH)) return;
  fs.renameSync(LEGACY_DB_PATH, DB_PATH);
  for (const suffix of ["-wal", "-shm"] as const) {
    const legacy = LEGACY_DB_PATH + suffix;
    const next = DB_PATH + suffix;
    if (pathExists(legacy) && !pathExists(next)) {
      fs.renameSync(legacy, next);
    }
  }
  console.log("[mdcs] 已迁移数据库 scrap.db → mdcs.db");
}

export function openDatabase(): DatabaseSync {
  if (db) return db;
  ensureDir(DATA_DIR);
  migrateLegacyDatabaseFile();
  db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(readTextFile(SCHEMA_PATH));
  migrateDatabase(db);
  syncKindsFromConfig();
  return db;
}

function migrateDatabase(database: DatabaseSync) {
  const jobCols = database.prepare("PRAGMA table_info(jobs)").all() as Array<{ name: string }>;
  if (!jobCols.some((c) => c.name === "options_json")) {
    database.exec(`ALTER TABLE jobs ADD COLUMN options_json TEXT NOT NULL DEFAULT '{}'`);
  }
  if (!jobCols.some((c) => c.name === "trigger_source")) {
    database.exec(`ALTER TABLE jobs ADD COLUMN trigger_source TEXT NOT NULL DEFAULT 'manual'`);
  }
  const fileCols = database.prepare("PRAGMA table_info(files)").all() as Array<{ name: string }>;
  if (!fileCols.some((c) => c.name === "mosaic")) {
    database.exec(`ALTER TABLE files ADD COLUMN mosaic TEXT NOT NULL DEFAULT ''`);
  }
  if (!fileCols.some((c) => c.name === "job_id")) {
    database.exec(`ALTER TABLE files ADD COLUMN job_id TEXT`);
  }
  database.exec(`CREATE INDEX IF NOT EXISTS idx_files_job_id ON files (job_id)`);
}

export function getDb(): DatabaseSync {
  return openDatabase();
}

export function syncKindsFromConfig(): void {
  if (!db) return;
  const database = db;
  const config = loadLibrariesConfig();
  const stmt = database.prepare(`
    INSERT INTO kinds (id, enabled, label, source_root, library_root, organize_mode, profile_json)
    VALUES (@id, @enabled, @label, @source_root, @library_root, @organize_mode, @profile_json)
    ON CONFLICT(id) DO UPDATE SET
      enabled = excluded.enabled,
      label = excluded.label,
      source_root = excluded.source_root,
      library_root = excluded.library_root,
      organize_mode = excluded.organize_mode,
      profile_json = excluded.profile_json
  `);

  for (const kind of listResolvedKinds(config)) {
    stmt.run({
      id: kind.id,
      enabled: kind.enabled ? 1 : 0,
      label: kind.label,
      source_root: kind.sourceRoot,
      library_root: kind.libraryRoot,
      organize_mode: kind.organizeMode,
      profile_json: JSON.stringify({
        organizeFallback: kind.organizeFallback,
      }),
    });
  }
}

export function countFilesByKind(kindId: KindId): Record<string, number> {
  const database = openDatabase();
  const rows = database
    .prepare(`SELECT status, COUNT(*) AS c FROM files WHERE kind = ? GROUP BY status`)
    .all(kindId) as Array<{ status: string; c: number }>;
  const out: Record<string, number> = { total: 0 };
  for (const row of rows) {
    out[row.status] = row.c;
    out.total += row.c;
  }
  return out;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
