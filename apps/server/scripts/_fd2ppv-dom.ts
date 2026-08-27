import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "../src/paths.js";

const id = process.argv[2] || "3275049";
const html = fs.readFileSync(path.join(PROJECT_ROOT, `data/_debug/fd2-art-${id}.html`), "utf8");
console.log("len", html.length);
for (const c of [
  "work-brief",
  "work-meta-label",
  "work-meta-value",
  "work-tags",
  "work-photos",
  "work-original-photos",
  "artist-info",
  "xximgs",
  "og:image",
  "og:title",
  "販売者",
  "配信日",
  "タグ",
]) {
  console.log(c, (html.match(new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")) || []).length);
}
console.log("title", html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim().slice(0, 100));
console.log("og:image", html.match(/property=["']og:image["'][^>]*content=["']([^"']+)/i)?.[1]);
console.log("og:title", html.match(/property=["']og:title["'][^>]*content=["']([^"']+)/i)?.[1]?.slice(0, 80));

// sample body classes
const classes = [...html.matchAll(/class=["']([^"']+)["']/gi)].flatMap((m) => m[1]!.split(/\s+/));
const top = Object.entries(
  classes.reduce((a: Record<string, number>, c) => {
    if (c.includes("work") || c.includes("meta") || c.includes("tag") || c.includes("photo") || c.includes("artist"))
      a[c] = (a[c] || 0) + 1;
    return a;
  }, {}),
)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 40);
console.log("relevant classes", top);
