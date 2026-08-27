/**
 * S6.4 抽样压测：验证 shouldSkipScanEntry 增量跳过吞吐。
 * 用法：npm run bench:scan --prefix apps/server -- [count]
 */
import assert from "node:assert/strict";
import { shouldSkipScanEntry } from "../src/jobs/scanner.js";

const count = Math.min(200_000, Math.max(1_000, Number(process.argv[2] || 10_000)));
const existing = { file_mtime: 1_700_000_000_000, file_size: 1_024_000_000 };

const t0 = Date.now();
let skipped = 0;
for (let i = 0; i < count; i++) {
  if (shouldSkipScanEntry(existing, existing.file_mtime, existing.file_size)) skipped += 1;
}
const ms = Date.now() - t0;

assert.equal(skipped, count);
const perSec = Math.floor((count / Math.max(ms, 1)) * 1000);
console.log(
  JSON.stringify(
    {
      count,
      skipped,
      ms,
      perSec,
      ok: true,
      note: "纯增量判定吞吐；真实扫盘受磁盘 IO 约束",
    },
    null,
    2,
  ),
);
