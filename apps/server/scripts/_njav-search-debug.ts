import { readFileSync } from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "../src/paths.js";

const html = readFileSync(path.join(PROJECT_ROOT, "data/_debug/njav-search-SONE-001.html"), "utf8");
for (const pat of ["box-item", "card", "result", "sone-001", "grid__item", "video-card"]) {
  const re = new RegExp(pat, "gi");
  const m = re.exec(html);
  if (m) console.log(pat, "count", (html.match(re) || []).length, "sample", html.slice(m.index, m.index + 180).replace(/\s+/g, " "));
}
