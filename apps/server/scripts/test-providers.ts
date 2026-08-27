/**
 * 逐源探活 + 已实现源刮削冒烟。
 * 用法（apps/server 目录）:
 *   npx tsx scripts/test-providers.ts
 *   npx tsx scripts/test-providers.ts --probe-only
 *   npx tsx scripts/test-providers.ts --id=javbus
 */
import { SOURCE_CATALOG } from "../src/scrape/providers/catalog.js";
import { getProvider } from "../src/scrape/providers/index.js";
import { probeProvider } from "../src/scrape/probe.js";

const args = process.argv.slice(2);
const probeOnly = args.includes("--probe-only");
const onlyId = args.find((a) => a.startsWith("--id="))?.slice(5);

/** 各源冒烟番号（够跑通解析即可，不保证永远在线） */
const SMOKE_CODES: Record<string, { code: string; kind: string }> = {
  javbus: { code: "SSIS-001", kind: "japan_censored" },
  javdb: { code: "SSIS-001", kind: "japan_censored" },
  jav321: { code: "SSIS-001", kind: "japan_censored" },
  libredmm: { code: "SSIS-001", kind: "japan_censored" },
  sevenmmtv: { code: "SSIS-001", kind: "japan_censored" },
  airav: { code: "SSIS-001", kind: "japan_censored" },
  airav_io: { code: "SSIS-001", kind: "japan_censored" },
  iqqtv: { code: "SSIS-001", kind: "japan_censored" },
  freejavbt: { code: "SSIS-001", kind: "japan_censored" },
  avsox: { code: "021015_001", kind: "japan_uncensored" },
  carib: { code: "010115-001", kind: "japan_uncensored" },
  fc2: { code: "FC2-PPV-1000000", kind: "fc2" },
  fc2_hub: { code: "FC2-PPV-1000000", kind: "fc2" },
  fd2ppv: { code: "FC2-PPV-1000000", kind: "fc2" },
  madou: { code: "MD-0260", kind: "china" },
  madouqu: { code: "MD-0260", kind: "china" },
  theporndb: { code: "blacked.20.01.01", kind: "western" },
};

type Row = {
  id: string;
  group: string;
  implemented: boolean;
  probeOk: boolean;
  probeMs: number;
  probeMsg: string;
  scrapeOk?: boolean;
  scrapeMs?: number;
  scrapeMsg?: string;
  fields?: string;
};

async function main() {
  const list = SOURCE_CATALOG.filter((e) => (onlyId ? e.id === onlyId : true));
  const rows: Row[] = [];

  console.log(`=== Provider 测试 ${list.length} 源 ===\n`);

  for (const entry of list) {
    process.stdout.write(`[probe] ${entry.id.padEnd(16)} ... `);
    const probe = await probeProvider(entry.id, { timeoutSec: 12 });
    const row: Row = {
      id: entry.id,
      group: entry.group,
      implemented: entry.implemented,
      probeOk: probe.ok,
      probeMs: probe.ms,
      probeMsg: probe.message.slice(0, 80),
    };
    console.log(probe.ok ? `OK ${probe.ms}ms` : `FAIL ${probe.message.slice(0, 60)}`);

    if (!probeOnly && entry.implemented) {
      const sample = SMOKE_CODES[entry.id];
      if (sample) {
        process.stdout.write(`[scrape] ${entry.id.padEnd(15)} ${sample.code} ... `);
        const provider = getProvider(entry.id);
        const started = Date.now();
        try {
          const result = await provider!.scrape({
            code: sample.code,
            kind: sample.kind as never,
            signal: AbortSignal.timeout(90_000),
          });
          const ms = result?.ms ?? Date.now() - started;
          const keys = Object.keys(result?.fields || {}).filter(
            (k) => (result!.fields as Record<string, unknown>)[k],
          );
          const ok = Boolean(result && !result.error && keys.length > 0);
          row.scrapeOk = ok;
          row.scrapeMs = ms;
          row.scrapeMsg = result?.error || (ok ? "ok" : "无字段");
          row.fields = keys.slice(0, 8).join(",");
          console.log(ok ? `OK ${ms}ms [${row.fields}]` : `FAIL ${row.scrapeMsg}`);
        } catch (err) {
          row.scrapeOk = false;
          row.scrapeMs = Date.now() - started;
          row.scrapeMsg = err instanceof Error ? err.message : String(err);
          console.log(`FAIL ${row.scrapeMsg.slice(0, 80)}`);
        }
      }
    }

    rows.push(row);
  }

  console.log("\n=== 汇总 ===");
  console.log(
    `${"id".padEnd(16)} ${"grp".padEnd(8)} ${"impl".padEnd(5)} ${"probe".padEnd(6)} ${"scrape".padEnd(8)} note`,
  );
  for (const r of rows) {
    const scrape =
      r.scrapeOk === undefined ? "-" : r.scrapeOk ? "OK" : "FAIL";
    const note = r.scrapeOk === false ? r.scrapeMsg : r.probeOk ? "" : r.probeMsg;
    console.log(
      `${r.id.padEnd(16)} ${r.group.padEnd(8)} ${String(r.implemented).padEnd(5)} ${
        r.probeOk ? "OK" : "FAIL"
      }`.padEnd(16) +
        ` ${scrape.padEnd(8)} ${(note || "").slice(0, 50)}`,
    );
  }

  const probeFail = rows.filter((r) => !r.probeOk).length;
  const scrapeFail = rows.filter((r) => r.scrapeOk === false).length;
  console.log(`\n探活失败 ${probeFail}/${rows.length}；刮削失败 ${scrapeFail}/${rows.filter((r) => r.scrapeOk !== undefined).length}`);
  if (probeFail || scrapeFail) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
