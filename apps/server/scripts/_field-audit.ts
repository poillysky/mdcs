/**
 * 对照 debug HTML：页面可见字段 vs parser 输出
 *   npx tsx scripts/_field-audit.ts carib avsox miss_av
 */
import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "../src/paths.js";
import { parseCaribDetailHtml } from "../src/scrape/providers/carib.js";
import { parseAvsoxDetailHtml } from "../src/scrape/providers/avsox.js";
import { parseMissAvDetailHtml } from "../src/scrape/providers/miss_av.js";

type AuditCase = {
  id: string;
  code: string;
  dump: string;
  url: string;
  parse: (html: string, url: string, code: string) => { fields: Record<string, unknown> } | null;
  hints: Array<{ field: string; patterns: RegExp[] }>;
};

const CASES: AuditCase[] = [
  {
    id: "carib",
    code: "CARIB-010117-339",
    dump: "data/_debug/carib-detail-010117-339.html",
    url: "https://www.caribbeancom.com/moviepages/010117-339/index.html",
    parse: parseCaribDetailHtml,
    hints: [
      { field: "ratingValue", patterns: [/ユーザー評価/i, /meta-rating/i, /★/] },
      { field: "website", patterns: [/moviepages\/\d{6}-\d{3}/i] },
      { field: "runtime", patterns: [/itemprop=["']duration["']/i, /収録時間/i] },
    ],
  },
  {
    id: "avsox",
    code: "CARIB-010117-339",
    dump: "data/_debug/avsox-detail-010117-339.html",
    url: "https://avsox.click/cn/movies/kxawewn",
    parse: parseAvsoxDetailHtml,
    hints: [
      { field: "plot", patterns: [/detail-label[^>]*>\s*简介\s*:/i] },
      { field: "director", patterns: [/detail-label[^>]*>\s*导演\s*:[\s\S]{0,80}detail-value[^>]*>(?!-)/i] },
      { field: "trailer", patterns: [/sample.*\.mp4/i, /trailer.*\.mp4/i] },
    ],
  },
  {
    id: "miss_av",
    code: "SONE-001",
    dump: "data/_debug/missav-detail-sone001.html",
    url: "https://missav123.com/cn/sone-001",
    parse: parseMissAvDetailHtml,
    hints: [
      { field: "premiered", patterns: [/发行日期/i, /og:video:release_date/i] },
      { field: "runtime", patterns: [/og:video:duration/i, /时长/i, /分钟/i] },
      { field: "plot", patterns: [/og:description/i, /line-clamp/i] },
      { field: "trailer", patterns: [/\.m3u8/i, /preview.*\.mp4/i] },
      { field: "rating", patterns: [/detail-label[^>]*>\s*评分/i, /aggregateRating/i] },
    ],
  },
];

function hasVal(v: unknown): boolean {
  if (v === undefined || v === null || v === "") return false;
  if (Array.isArray(v) && v.length === 0) return false;
  return true;
}

function main() {
  const only = new Set(process.argv.slice(2));
  for (const c of CASES) {
    if (only.size && !only.has(c.id)) continue;
    const abs = path.join(PROJECT_ROOT, c.dump);
    if (!fs.existsSync(abs)) {
      console.log(`\n=== ${c.id} SKIP (no dump) ===`);
      continue;
    }
    const html = fs.readFileSync(abs, "utf8");
    const hit = c.parse(html, c.url, c.code);
    console.log(`\n=== ${c.id} (${c.code}) ===`);
    if (!hit) {
      console.log("  parser returned null");
      continue;
    }
    const gaps: string[] = [];
    for (const { field, patterns } of c.hints) {
      const parsed = (hit.fields as Record<string, unknown>)[field];
      const pageHas = patterns.some((p) => p.test(html));
      if (pageHas && !hasVal(parsed)) gaps.push(field);
    }
    const collected = Object.entries(hit.fields).filter(([, v]) => hasVal(v)).map(([k]) => k);
    console.log(`  collected: ${collected.join(", ")}`);
    if (gaps.length) console.log(`  ⚠ page hints but parser empty: ${gaps.join(", ")}`);
    else console.log("  ✓ no obvious hint gaps");
  }
}

main();
