import fs from "node:fs";
import path from "node:path";
import { listCatalogIds } from "../src/scrape/providers/catalog.js";
import { PROJECT_ROOT } from "../src/paths.js";

const ids = listCatalogIds();
const reports: { id: string; rel: string }[] = [];

function walk(dir: string) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name === "e2e-report.json") {
      const m = p.match(/[\\/]_scrap[\\/]([^\\/]+)[\\/]/);
      if (m) reports.push({ id: m[1]!, rel: path.relative(PROJECT_ROOT, p).replace(/\\/g, "/") });
    }
  }
}

walk(path.join(PROJECT_ROOT, "media"));
const byId = new Map<string, string>();
for (const r of reports) {
  if (!byId.has(r.id)) byId.set(r.id, r.rel);
}

console.log("=== Catalog E2E 报告扫描 ===\n");
const miss: string[] = [];
for (const id of ids) {
  const hit = byId.get(id);
  if (hit) console.log(`OK   ${id.padEnd(16)} ${hit}`);
  else {
    console.log(`MISS ${id}`);
    miss.push(id);
  }
}
console.log(`\n已实现 ${ids.length} 源 · 有 e2e-report ${byId.size} · 缺 ${miss.length}`);
if (miss.length) console.log("缺报告:", miss.join(", "));
