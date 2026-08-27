import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "../src/paths.js";

const id = process.argv[2] || "4962908";
const html = fs.readFileSync(path.join(PROJECT_ROOT, `data/_debug/fd2ppv-search-${id}.html`), "utf8");
console.log("len", html.length);
const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]!);
const interesting = [...new Set(hrefs)].filter(
  (h) =>
    h.includes(id) ||
    /\/(articles?|works?|videos?|item|w)\//i.test(h) ||
    /detail|product/i.test(h),
);
console.log("interesting hrefs", interesting.slice(0, 40));
console.log("id mentions", (html.match(new RegExp(id, "g")) || []).length);
// card-like blocks
const idx = html.indexOf(id);
console.log("first id context:\n", html.slice(Math.max(0, idx - 300), idx + 400));
