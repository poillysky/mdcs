import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "../src/paths.js";

const html = fs.readFileSync(path.join(PROJECT_ROOT, "data/_debug/fc2-hub-detail-4962908.html"), "utf8");
const i = html.indexOf('class="col-8"');
console.log(html.slice(i, i + 1200));
console.log("\n--- seller links ---");
for (const m of html.matchAll(/href=["']([^"']*\/seller\/[^"']+)["'][^>]*>([^<]*)</gi)) {
  console.log(m[1], "|", m[2]?.trim());
}
