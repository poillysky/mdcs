import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openDatabase } from "./init.js";
import { resetPersistLockForTests, withPersistLock } from "./persistLock.js";
import { readScrapeCache, writeScrapeCache } from "../scrape/cache.js";

describe("withPersistLock", () => {
  it("无锁时并发累加会丢计数", async () => {
    let count = 0;
    await Promise.all(
      Array.from({ length: 40 }, async () => {
        const cur = count;
        await new Promise((r) => setTimeout(r, 1));
        count = cur + 1;
      }),
    );
    assert.notEqual(count, 40);
  });

  it("加锁后并发累加不丢计数", async () => {
    resetPersistLockForTests();
    let count = 0;
    await Promise.all(
      Array.from({ length: 40 }, async () => {
        await withPersistLock(async () => {
          const cur = count;
          await new Promise((r) => setTimeout(r, 1));
          count = cur + 1;
        }, { staggerMs: 0 });
      }),
    );
    assert.equal(count, 40);
  });
  it("同一时刻仅一条入库逻辑在执行", async () => {
    resetPersistLockForTests();
    let inflight = 0;
    let maxInflight = 0;
    const order: number[] = [];

    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        withPersistLock(async () => {
          inflight += 1;
          maxInflight = Math.max(maxInflight, inflight);
          order.push(i);
          await new Promise((r) => setTimeout(r, 8));
          inflight -= 1;
        }, { staggerMs: 0 }),
      ),
    );

    assert.equal(maxInflight, 1);
    assert.equal(order.length, 12);
  });
});

describe("concurrent scrape_cache persist", () => {
  it("并行入库 20 条不同番号后均可读回", async () => {
    resetPersistLockForTests();
    const db = openDatabase();
    const prefix = `PERSIST-${Date.now()}`;
    const codes = Array.from({ length: 20 }, (_, i) => `${prefix}-${i}`);

    await Promise.all(
      codes.map((code, i) =>
        withPersistLock(() => {
          writeScrapeCache({
            code,
            kind: "japan_censored",
            ok: true,
            title: `title-${i}`,
            source: "javbus",
            actors: [],
            genres: [],
            sourcesTried: ["javbus"],
            fieldSources: { title: "javbus" },
            scrapedAt: new Date().toISOString(),
          });
          db.prepare(
            `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, code, status, scraped_at)
             VALUES ('japan_censored', ?, ?, 1, 1, ?, 'scraped', ?)`,
          ).run(`test/${code}.mp4`, `${code}.mp4`, code, Date.now());
        }, { staggerMs: 0 }),
      ),
    );

    for (const code of codes) {
      const meta = readScrapeCache(code, "japan_censored");
      assert.equal(meta?.title, `title-${codes.indexOf(code)}`);
      const row = db
        .prepare(`SELECT status FROM files WHERE source_path = ?`)
        .get(`test/${code}.mp4`) as { status: string } | undefined;
      assert.equal(row?.status, "scraped");
    }

    for (const code of codes) {
      db.prepare(`DELETE FROM files WHERE source_path = ?`).run(`test/${code}.mp4`);
      db.prepare(`DELETE FROM scrape_cache WHERE code = ? AND kind = 'japan_censored'`).run(code);
    }
  });
});
