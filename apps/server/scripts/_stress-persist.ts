import { openDatabase } from "../src/db/init.js";
import { writeScrapeCache } from "../src/scrape/cache.js";

const db = openDatabase();
const prefix = `NOLOCK-${Date.now()}`;
let errors = 0;
const codes = Array.from({ length: 30 }, (_, i) => `${prefix}-${i}`);

await Promise.all(
  codes.map(async (code, i) => {
    try {
      writeScrapeCache({
        code,
        kind: "japan_censored",
        ok: true,
        title: `t${i}`,
        source: "javbus",
        actors: [],
        genres: [],
        sourcesTried: ["javbus"],
        fieldSources: {},
        scrapedAt: new Date().toISOString(),
      });
      db.prepare(
        `INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, code, status)
         VALUES ('japan_censored', ?, ?, 1, 1, ?, 'scraped')`,
      ).run(`test/${code}.mp4`, `${code}.mp4`, code);
    } catch (e) {
      errors += 1;
      console.error(String(e));
    }
  }),
);

console.log(JSON.stringify({ mode: "no-lock", errors, total: codes.length }));

for (const code of codes) {
  db.prepare(`DELETE FROM files WHERE source_path = ?`).run(`test/${code}.mp4`);
  db.prepare(`DELETE FROM scrape_cache WHERE code = ? AND kind = 'japan_censored'`).run(code);
}
