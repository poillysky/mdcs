import fs from "node:fs";
const h = fs.readFileSync("scripts/_avheat-dump/detail_office_play.html", "utf8");
const cover = h.match(/q-img__image[^>]*src="([^"]+)"/)?.[1];
console.log("cover", cover);
const id = h.match(/detail-label">识别码:<\/span><span[^>]*>([^<]+)/)?.[1];
console.log("id", id);
