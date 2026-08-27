import fs from "fs";
import path from "path";

const roots = [
  "e:/Mdcs/apps/server/src",
  "e:/Mdcs/apps/web/src",
  "e:/Mdcs/config",
  "e:/Mdcs/docs",
];
const re = /score|ratingValue|ratingMax|ratingSource|\*\s*2|\/\s*2|评分|criticrating|<rating/i;
const fileRe = /\.(ts|tsx|js|mjs|json|md)$/i;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".git") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (fileRe.test(ent.name)) out.push(p);
  }
  return out;
}

const hits = [];
for (const root of roots) {
  for (const file of walk(root)) {
    const text = fs.readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    lines.forEach((line, i) => {
      if (re.test(line)) {
        hits.push(`${file}:${i + 1}:${line.trim().slice(0, 160)}`);
      }
    });
  }
}
console.log(hits.join("\n"));
console.log("\nTOTAL", hits.length);
