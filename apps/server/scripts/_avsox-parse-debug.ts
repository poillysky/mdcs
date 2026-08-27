import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "../src/paths.js";

const html = fs.readFileSync(
  path.join(PROJECT_ROOT, "data/_debug/avsox-detail-010117-339.html"),
  "utf8",
);
const actress = html.match(/class=["']actresses[\s\S]{0,3000}/i)?.[0] || "";
console.log("actress block", actress.slice(0, 1500));
const genre = html.match(/detail-label[^>]*>\s*类别[\s\S]{0,1500}/i)?.[0] || "";
console.log("genre block", genre.slice(0, 800));
