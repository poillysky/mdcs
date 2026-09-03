import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openDatabase } from "../db/init.js";
import { computeJobFileStats } from "./fileStats.js";
import type { JobRecord } from "../types.js";

function job(partial: Partial<JobRecord> & Pick<JobRecord, "id" | "mode">): JobRecord {
  return {
    kinds: ["japan_censored"],
    dryRun: false,
    triggerSource: "manual",
    status: "running",
    total: 0,
    processed: 0,
    failed: 0,
    skipped: 0,
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  };
}

describe("computeJobFileStats", () => {
  it("无关联文件时回退 job.total / skipped", () => {
    const stats = computeJobFileStats(
      job({ id: "job_test_empty", mode: "full", total: 796, skipped: 3 }),
    );
    assert.equal(stats.total, 796);
    assert.equal(stats.success, 3);
    assert.equal(stats.queued, 0);
    assert.equal(stats.processing, 0);
    assert.equal(stats.skipped, 3);
  });

  it("total 固定为 job.total（扫描数）", () => {
    const stats = computeJobFileStats(
      job({ id: "job_test_scan", mode: "full", total: 31, skipped: 99 }),
    );
    assert.equal(stats.total, 31);
  });

  it("processing 不含 scraped_at 已写入的 scraping 残留", () => {
    const db = openDatabase();
    db.prepare(
      `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, status, job_id, scraped_at)
       VALUES ('japan_censored', 'test/stale-scraping-proc.mp4', 'stale.mp4', 1, 1, 'scraping', 'job_test_proc', 1000)`,
    ).run();
    const stats = computeJobFileStats(job({ id: "job_test_proc", mode: "full", total: 1, skipped: 0 }));
    assert.equal(stats.processing, 0);
    assert.equal(stats.success, 0);
    db.prepare(`DELETE FROM files WHERE job_id = 'job_test_proc'`).run();
  });

  it("job.total 已写入时显示 walk 完整规模（不受 touched 影响）", () => {
    const db = openDatabase();
    db.prepare(
      `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, status, job_id)
       VALUES ('japan_censored', 'test/live-index.mp4', 'live.mp4', 1, 1, 'indexed', 'job_test_live')`,
    ).run();
    db.prepare(
      `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, status, job_id)
       VALUES ('japan_censored', 'test/live-index-2.mp4', 'live2.mp4', 1, 1, 'indexed', 'job_test_live')`,
    ).run();
    const stats = computeJobFileStats(
      job({ id: "job_test_live", mode: "full", total: 500, skipped: 99 }),
    );
    assert.equal(stats.total, 500);
    assert.equal(stats.skipped, 99);
    db.prepare(`DELETE FROM files WHERE job_id = 'job_test_live'`).run();
  });

  it("full 模式成功仅计 done，scraped 计入处理中", () => {
    const db = openDatabase();
    const scanPath = "media/test-scope/success";
    db.prepare(`DELETE FROM files WHERE source_path LIKE ?`).run(`${scanPath}/%`);
    db.prepare(
      `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, status)
       VALUES ('japan_censored', ?, 'done.mp4', 1, 1, 'done')`,
    ).run(`${scanPath}/done.mp4`);
    db.prepare(
      `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, status, job_id)
       VALUES ('japan_censored', ?, 'todo.mp4', 1, 1, 'indexed', 'job_test_scope')`,
    ).run(`${scanPath}/todo.mp4`);
    db.prepare(
      `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, status)
       VALUES ('japan_censored', ?, 'mid.mp4', 1, 1, 'scraped')`,
    ).run(`${scanPath}/mid.mp4`);
    db.prepare(
      `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, status)
       VALUES ('japan_censored', ?, 'busy.mp4', 1, 1, 'scraping')`,
    ).run(`${scanPath}/busy.mp4`);

    const stats = computeJobFileStats(
      job({
        id: "job_test_scope",
        mode: "full",
        total: 4,
        skipped: 0,
        options: { scanPath },
      }),
    );
    assert.equal(stats.success, 1);
    assert.equal(stats.queued, 1);
    assert.equal(stats.processing, 2);

    db.prepare(`DELETE FROM files WHERE source_path LIKE ?`).run(`${scanPath}/%`);
  });

  it("scanPath 范围内纠正过小的 job.total", () => {
    const db = openDatabase();
    const scanPath = "media/test-scope/index-total";
    db.prepare(`DELETE FROM files WHERE source_path LIKE ?`).run(`${scanPath}/%`);
    for (let i = 0; i < 5; i++) {
      db.prepare(
        `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, status)
         VALUES ('japan_censored', ?, ?, 1, 1, 'indexed')`,
      ).run(`${scanPath}/f${i}.mp4`, `f${i}.mp4`);
    }
    const stats = computeJobFileStats(
      job({
        id: "job_test_index_total",
        mode: "full",
        total: 3,
        skipped: 0,
        options: { scanPath },
      }),
    );
    assert.equal(stats.total, 5);
    db.prepare(`DELETE FROM files WHERE source_path LIKE ?`).run(`${scanPath}/%`);
  });

  it("跳过扫描阶段时用 scanPath 库内数为索引 total", () => {
    const db = openDatabase();
    const scanPath = "media/test-scope/index-skipped";
    db.prepare(`DELETE FROM files WHERE source_path LIKE ?`).run(`${scanPath}/%`);
    for (let i = 0; i < 5; i++) {
      db.prepare(
        `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, status)
         VALUES ('japan_censored', ?, ?, 1, 1, 'indexed')`,
      ).run(`${scanPath}/f${i}.mp4`, `f${i}.mp4`);
    }
    const stats = computeJobFileStats(
      job({
        id: "job_test_index_skipped",
        mode: "full",
        total: 139,
        skipped: 0,
        options: { scanPath, resumeSkipPhases: ["scan"] },
      }),
    );
    assert.equal(stats.total, 5);
    db.prepare(`DELETE FROM files WHERE source_path LIKE ?`).run(`${scanPath}/%`);
  });

  it("scanPath 范围内 queued/processing 不依赖 job_id", () => {
    const db = openDatabase();
    const scanPath = "media/test-scope/progress";
    db.prepare(`DELETE FROM files WHERE source_path LIKE ?`).run(`${scanPath}/%`);
    db.prepare(
      `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, status)
       VALUES ('japan_censored', ?, 'todo.mp4', 1, 1, 'indexed')`,
    ).run(`${scanPath}/todo.mp4`);
    db.prepare(
      `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, status)
       VALUES ('japan_censored', ?, 'busy.mp4', 1, 1, 'scraping')`,
    ).run(`${scanPath}/busy.mp4`);

    const stats = computeJobFileStats(
      job({
        id: "job_test_scope_progress",
        mode: "full",
        total: 2,
        skipped: 0,
        options: { scanPath },
      }),
    );
    assert.equal(stats.queued, 1);
    assert.equal(stats.processing, 1);

    db.prepare(`DELETE FROM files WHERE source_path LIKE ?`).run(`${scanPath}/%`);
  });

  it("任务刚启动 job.total=0 时仍显示 scanPath 库内真实索引数", () => {
    const db = openDatabase();
    const scanPath = "media/test-scope/start-zero-total";
    db.prepare(`DELETE FROM files WHERE source_path LIKE ?`).run(`${scanPath}/%`);
    db.prepare(
      `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, status)
       VALUES ('japan_censored', ?, 'done.mp4', 1, 1, 'done')`,
    ).run(`${scanPath}/done.mp4`);
    for (let i = 0; i < 3; i++) {
      db.prepare(
        `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, status)
         VALUES ('japan_censored', ?, ?, 1, 1, 'indexed')`,
      ).run(`${scanPath}/f${i}.mp4`, `f${i}.mp4`);
    }
    const stats = computeJobFileStats(
      job({
        id: "job_test_start_zero",
        mode: "full",
        total: 0,
        skipped: 0,
        options: { scanPath },
      }),
    );
    assert.equal(stats.total, 4);
    assert.equal(stats.success, 1);
    assert.equal(stats.queued, 3);
    db.prepare(`DELETE FROM files WHERE source_path LIKE ?`).run(`${scanPath}/%`);
  });

  it("待处理含库内排队与磁盘无库记录（walk − 库内总数）", () => {
    const db = openDatabase();
    const scanPath = "media/test-scope/queued-derive";
    db.prepare(`DELETE FROM files WHERE source_path LIKE ?`).run(`${scanPath}/%`);
    db.prepare(
      `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, status)
       VALUES ('japan_censored', ?, 'done.mp4', 1, 1, 'done')`,
    ).run(`${scanPath}/done.mp4`);
    for (let i = 0; i < 3; i++) {
      db.prepare(
        `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, status)
         VALUES ('japan_censored', ?, ?, 1, 1, 'indexed')`,
      ).run(`${scanPath}/f${i}.mp4`, `f${i}.mp4`);
    }
    db.prepare(
      `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, status)
       VALUES ('japan_censored', ?, 'busy.mp4', 1, 1, 'scraping')`,
    ).run(`${scanPath}/busy.mp4`);

    const stats = computeJobFileStats(
      job({
        id: "job_test_queued_derive",
        mode: "full",
        total: 5,
        skipped: 1,
        options: { scanPath },
      }),
    );
    assert.equal(stats.total, 5);
    assert.equal(stats.success, 1);
    assert.equal(stats.processing, 1);
    assert.equal(stats.queued, 3);
    db.prepare(`DELETE FROM files WHERE source_path LIKE ?`).run(`${scanPath}/%`);
  });

  it("job.total 未写入时回退 touched + skipped", () => {
    const db = openDatabase();
    db.prepare(
      `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, status, job_id)
       VALUES ('japan_censored', 'test/fallback-index.mp4', 'fb.mp4', 1, 1, 'indexed', 'job_test_fb')`,
    ).run();
    const stats = computeJobFileStats(
      job({ id: "job_test_fb", mode: "full", total: 0, skipped: 2 }),
    );
    assert.equal(stats.total, 3);
    db.prepare(`DELETE FROM files WHERE job_id = 'job_test_fb'`).run();
  });
});
