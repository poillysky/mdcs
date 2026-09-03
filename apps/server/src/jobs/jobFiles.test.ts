import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openDatabase } from "../db/init.js";
import { writeScrapeCache } from "../scrape/cache.js";
import { reconcileJobFilesAfterAbort, releaseInflightFileState, releaseStuckInflightFileState, recoverStaleInflightStatuses, reconcileScrapeCacheSuccessStates, failJobScrapedWithoutDone, revertOrphanPipelineFiles, deleteOrRevertFileRecord } from "./jobFiles.js";

describe("jobFiles abort reconcile", () => {
  it("取消任务时未完成条目回退等待并解除 job_id", () => {
    const db = openDatabase();
    const code = "JOB-ABORT-OK";
    writeScrapeCache({
      code,
      kind: "japan_censored",
      ok: true,
      title: "t",
      source: "javdb",
      actors: [],
      genres: [],
      sourcesTried: ["javdb"],
      fieldSources: {},
      scrapedAt: new Date().toISOString(),
    });
    db.prepare(
      `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, code, status, job_id, scraped_at)
       VALUES ('japan_censored', 'test/job-abort-ok.mp4', 'job-abort-ok.mp4', 1, 1, ?, 'scraped', 'job_abort_ok', 1000)`,
    ).run(code);

    reconcileJobFilesAfterAbort("job_abort_ok", { detachJobId: true });

    const row = db
      .prepare(`SELECT status, job_id, error, scraped_at FROM files WHERE source_path = 'test/job-abort-ok.mp4'`)
      .get() as { status: string; job_id: string | null; error: string | null; scraped_at: number | null };
    assert.equal(row.status, "indexed");
    assert.equal(row.job_id, null);
    assert.equal(row.error, null);
    assert.equal(row.scraped_at, null);

    db.prepare(`DELETE FROM files WHERE source_path = 'test/job-abort-ok.mp4'`).run();
  });

  it("中断 organizing 时回退 indexed", () => {
    const db = openDatabase();
    db.prepare(
      `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, code, status, job_id, scraped_at)
       VALUES ('japan_censored', 'test/job-abort-org.mp4', 'job-abort-org.mp4', 1, 1, 'JOB-ORG', 'organizing', 'job_abort_org', 1000)`,
    ).run();
    const { id } = db
      .prepare(`SELECT id FROM files WHERE source_path = 'test/job-abort-org.mp4'`)
      .get() as { id: number };

    releaseInflightFileState(id);

    const row = db
      .prepare(`SELECT status, scraped_at FROM files WHERE id = ?`)
      .get(id) as { status: string; scraped_at: number | null };
    assert.equal(row.status, "indexed");
    assert.equal(row.scraped_at, null);

    db.prepare(`DELETE FROM files WHERE id = ?`).run(id);
  });

  it("中断 scraping 时不写入任务中断错误", () => {
    const db = openDatabase();
    db.prepare(
      `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, code, status, job_id)
       VALUES ('japan_censored', 'test/job-abort-scraping.mp4', 'job-abort-scraping.mp4', 1, 1, 'JOB-SCRAPING', 'scraping', 'job_abort_scraping')`,
    ).run();
    const { id } = db
      .prepare(`SELECT id FROM files WHERE source_path = 'test/job-abort-scraping.mp4'`)
      .get() as { id: number };

    releaseInflightFileState(id);

    const row = db
      .prepare(`SELECT status, error FROM files WHERE id = ?`)
      .get(id) as { status: string; error: string | null };
    assert.equal(row.status, "indexed");
    assert.equal(row.error, null);

    db.prepare(`DELETE FROM files WHERE id = ?`).run(id);
  });

  it("recoverStaleInflightStatuses 修复 scraping 残留", () => {
    const db = openDatabase();
    db.prepare(
      `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, code, status, scraped_at)
       VALUES ('japan_censored', 'test/stale-inflight.mp4', 'stale.mp4', 1, 1, 'STALE', 'scraping', 1000)`,
    ).run();
    const n = recoverStaleInflightStatuses();
    assert.ok(n >= 1);
    const row = db
      .prepare(`SELECT status FROM files WHERE source_path = 'test/stale-inflight.mp4'`)
      .get() as { status: string };
    assert.equal(row.status, "scraped");
    db.prepare(`DELETE FROM files WHERE source_path = 'test/stale-inflight.mp4'`).run();
  });

  it("reconcileScrapeCacheSuccessStates 同步 indexed + cache 为 scraped", () => {
    const db = openDatabase();
    const code = "JOB-CACHE-SYNC";
    writeScrapeCache({
      code,
      kind: "japan_censored",
      ok: true,
      title: "t",
      source: "javdb",
      actors: [],
      genres: [],
      sourcesTried: ["javdb"],
      fieldSources: {},
      scrapedAt: new Date().toISOString(),
    });
    db.prepare(
      `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, code, status)
       VALUES ('japan_censored', 'test/job-cache-sync.mp4', 'job-cache-sync.mp4', 1, 1, ?, 'indexed')`,
    ).run(code);

    const n = reconcileScrapeCacheSuccessStates();
    assert.ok(n >= 1);

    const row = db
      .prepare(`SELECT status, scraped_at FROM files WHERE source_path = 'test/job-cache-sync.mp4'`)
      .get() as { status: string; scraped_at: number | null };
    assert.equal(row.status, "scraped");
    assert.ok(row.scraped_at);

    db.prepare(`DELETE FROM files WHERE source_path = 'test/job-cache-sync.mp4'`).run();
  });

  it("revertOrphanPipelineFiles 回收已删除任务上的 scraped", () => {
    const db = openDatabase();
    db.prepare(
      `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, code, status, job_id, scraped_at)
       VALUES ('japan_censored', 'test/orphan-scraped.mp4', 'orphan.mp4', 1, 1, 'ORPHAN-1', 'scraped', 'job_deleted_orphan', 1000)`,
    ).run();
    const { id } = db
      .prepare(`SELECT id FROM files WHERE source_path = 'test/orphan-scraped.mp4'`)
      .get() as { id: number };

    const n = revertOrphanPipelineFiles();
    assert.ok(n >= 1);

    const row = db
      .prepare(`SELECT status, job_id, scraped_at FROM files WHERE id = ?`)
      .get(id) as { status: string; job_id: string | null; scraped_at: number | null };
    assert.equal(row.status, "indexed");
    assert.equal(row.job_id, null);
    assert.equal(row.scraped_at, null);

    db.prepare(`DELETE FROM files WHERE id = ?`).run(id);
  });

  it("deleteOrRevertFileRecord 等待中跳过、其他状态回退 indexed", () => {
    const db = openDatabase();
    const suffix = String(Date.now());
    const waitPath = `test/del-wait-${suffix}.mp4`;
    const donePath = `test/del-done-${suffix}.mp4`;
    db.prepare(
      `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, code, status)
       VALUES ('japan_censored', ?, 'w.mp4', 1, 1, 'DEL-W', 'indexed')`,
    ).run(waitPath);
    db.prepare(
      `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, code, status, scraped_at)
       VALUES ('japan_censored', ?, 'd.mp4', 1, 1, 'DEL-D', 'done', 1000)`,
    ).run(donePath);
    const wait = db.prepare(`SELECT id FROM files WHERE source_path = ?`).get(waitPath) as { id: number };
    const done = db.prepare(`SELECT id FROM files WHERE source_path = ?`).get(donePath) as { id: number };

    assert.equal(deleteOrRevertFileRecord(wait.id), "skipped");
    assert.equal(deleteOrRevertFileRecord(done.id), "reverted");

    assert.equal(
      (db.prepare(`SELECT COUNT(*) AS c FROM files WHERE source_path = ?`).get(waitPath) as { c: number }).c,
      1,
    );
    const row = db
      .prepare(`SELECT status, scraped_at, job_id FROM files WHERE id = ?`)
      .get(done.id) as { status: string; scraped_at: number | null; job_id: string | null };
    assert.equal(row.status, "indexed");
    assert.equal(row.scraped_at, null);
    assert.equal(row.job_id, null);

    db.prepare(`DELETE FROM files WHERE id IN (?, ?)`).run(wait.id, done.id);
  });

  it("releaseStuckInflightFileState 仅回收 scraping/organizing 卡住项", () => {
    const db = openDatabase();
    const suffix = String(Date.now());
    db.prepare(
      `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, code, status, scraped_at)
       VALUES ('japan_censored', ?, 'scraped.mp4', 1, 1, 'STUCK-S', 'scraped', 1000)`,
    ).run(`test/stuck-scraped-${suffix}.mp4`);
    db.prepare(
      `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, code, status)
       VALUES ('japan_censored', ?, 'scraping.mp4', 1, 1, 'STUCK-P', 'scraping')`,
    ).run(`test/stuck-scraping-${suffix}.mp4`);
    const scraped = db
      .prepare(`SELECT id FROM files WHERE source_path = ?`)
      .get(`test/stuck-scraped-${suffix}.mp4`) as { id: number };
    const scraping = db
      .prepare(`SELECT id FROM files WHERE source_path = ?`)
      .get(`test/stuck-scraping-${suffix}.mp4`) as { id: number };

    assert.equal(releaseStuckInflightFileState(scraped.id), false);
    assert.equal(releaseStuckInflightFileState(scraping.id), true);

    const scrapedRow = db
      .prepare(`SELECT status FROM files WHERE id = ?`)
      .get(scraped.id) as { status: string };
    const scrapingRow = db
      .prepare(`SELECT status FROM files WHERE id = ?`)
      .get(scraping.id) as { status: string };
    assert.equal(scrapedRow.status, "scraped");
    assert.equal(scrapingRow.status, "indexed");

    db.prepare(`DELETE FROM files WHERE id IN (?, ?)`).run(scraped.id, scraping.id);
  });

  it("failJobScrapedWithoutDone 将任务内 scraped/planned 标为失败", () => {
    const db = openDatabase();
    db.prepare(
      `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, code, status, job_id, scraped_at)
       VALUES ('japan_censored', 'test/job-stranded-scraped.mp4', 'a.mp4', 1, 1, 'STRAND-A', 'scraped', 'job_stranded', 1000)`,
    ).run();
    db.prepare(
      `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, code, status, job_id)
       VALUES ('japan_censored', 'test/job-stranded-planned.mp4', 'b.mp4', 1, 1, 'STRAND-B', 'planned', 'job_stranded')`,
    ).run();
    db.prepare(
      `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, code, status, job_id)
       VALUES ('japan_censored', 'test/job-stranded-done.mp4', 'c.mp4', 1, 1, 'STRAND-C', 'done', 'job_stranded')`,
    ).run();

    const n = failJobScrapedWithoutDone("job_stranded");
    assert.equal(n, 2);

    const scraped = db
      .prepare(`SELECT status, error FROM files WHERE source_path = 'test/job-stranded-scraped.mp4'`)
      .get() as { status: string; error: string };
    assert.equal(scraped.status, "failed");
    assert.match(scraped.error, /整理阶段未完成/);

    const done = db
      .prepare(`SELECT status FROM files WHERE source_path = 'test/job-stranded-done.mp4'`)
      .get() as { status: string };
    assert.equal(done.status, "done");

    db.prepare(`DELETE FROM files WHERE job_id = 'job_stranded'`).run();
  });
});
