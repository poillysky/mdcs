import fs from "node:fs";
import path from "node:path";
import { loadLibrariesConfig } from "../config/loadConfig.js";
import { loadScrapeConfig } from "../config/loadScrape.js";
import { openDatabase } from "../db/init.js";
import { classifyFromPath, resolveFileKind } from "../library/classify.js";
import { identifyFromFileName, stripJunkFilters } from "../library/identify.js";
import {
  organizeWalkFilter,
  passesMinSize,
  walkVideoFiles,
} from "../library/scanFilter.js";
import { toPosixRelative } from "../paths.js";
import type { KindId, ResolvedKind, ScanResult } from "../types.js";

const BATCH = 500;

export function shouldSkipScanEntry(
  existing: { file_mtime: number; file_size: number } | undefined,
  mtimeMs: number,
  size: number,
  force = false,
): boolean {
  if (force || !existing) return false;
  return existing.file_mtime === Math.floor(mtimeMs) && existing.file_size === size;
}

export function scanKind(
  kind: ResolvedKind,
  projectRoot: string,
  opts?: { force?: boolean; jobId?: string },
): ScanResult {
  if (!kind.sourceAbs) {
    return { kind: kind.id, scanned: 0, inserted: 0, updated: 0, skipped: 0 };
  }
  const libraries = loadLibrariesConfig();
  const org = libraries.organize;
  const filter = organizeWalkFilter(org);
  const junkFilters = org.junkFilters || [];
  const crackKeywords = org.crackKeywords || [];
  const recognitionWords = loadScrapeConfig().recognitionWords;
  const jobId = opts?.jobId?.trim() || null;

  const db = openDatabase();
  const files = walkVideoFiles(kind.sourceAbs, filter);
  const upsert = db.prepare(`
    INSERT INTO files (
      kind, source_path, file_name, file_size, file_mtime, code, cd_index, mosaic, status, job_id
    ) VALUES (
      @kind, @source_path, @file_name, @file_size, @file_mtime, @code, @cd_index, @mosaic, 'pending', @job_id
    )
    ON CONFLICT(source_path) DO UPDATE SET
      file_name = excluded.file_name,
      file_size = excluded.file_size,
      file_mtime = excluded.file_mtime,
      code = excluded.code,
      cd_index = excluded.cd_index,
      mosaic = excluded.mosaic,
      kind = excluded.kind,
      job_id = COALESCE(excluded.job_id, files.job_id)
  `);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files[i] ? files.slice(i, i + BATCH) : [];
    db.exec("BEGIN");
    try {
      for (const abs of batch) {
        const st = fs.statSync(abs);
        if (!passesMinSize(abs, filter.minBytes)) {
          skipped += 1;
          continue;
        }
        const rel = toPosixRelative(abs, projectRoot);
        const mtime = Math.floor(st.mtimeMs);
        const fileName = path.basename(abs);
        const cleanedName = stripJunkFilters(fileName, junkFilters);
        const { code, cdIndex } = identifyFromFileName(cleanedName);
        const classified = classifyFromPath(rel, fileName, code, crackKeywords, recognitionWords);
        const fileKind = resolveFileKind(kind.id as KindId, classified);
        const existing = db
          .prepare(`SELECT id, file_mtime, file_size, status FROM files WHERE source_path = ?`)
          .get(rel) as
          | { id: number; file_mtime: number; file_size: number; status: string }
          | undefined;

        if (shouldSkipScanEntry(existing, st.mtimeMs, st.size, Boolean(opts?.force))) {
          skipped += 1;
          continue;
        }

        upsert.run({
          kind: fileKind,
          source_path: rel,
          file_name: fileName,
          file_size: st.size,
          file_mtime: mtime,
          code,
          cd_index: cdIndex,
          mosaic: classified.mosaic,
          job_id: jobId,
        });

        if (!existing) inserted += 1;
        else updated += 1;
      }
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }

  return {
    kind: kind.id,
    scanned: files.length,
    inserted,
    updated,
    skipped,
  };
}
