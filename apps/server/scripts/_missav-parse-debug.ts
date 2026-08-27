import { readFileSync } from "node:fs";
import { parseMissAvDetailHtml } from "../src/scrape/providers/miss_av.js";

const html = readFileSync("../../data/_debug/missav-detail-sone001.html", "utf8");
const r = parseMissAvDetailHtml(html, "https://missav123.com/dm94/cn/sone-001", "SONE-001");
console.log(JSON.stringify(r, null, 2));
