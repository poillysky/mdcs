import fs from "node:fs";
const h = fs.readFileSync("scripts/_avheat-dump/detail_office_play.html", "utf8");
for (const l of [
  "识别码",
  "識別碼",
  "Release Date",
  "发行时间",
  "發行時間",
  "Studio",
  "制作商",
  "製作商",
  "Director",
  "导演",
  "導演",
  "Categories",
  "类别",
  "系列",
  "Length",
  "长度",
  "長度",
  "movie-name",
  "movie-meta",
  "poster-image",
  "actress-name",
  "actor-name",
  "class=\"movie-detail\"",
  "q-img__image",
  "samples",
]) {
  const i = h.indexOf(l);
  console.log(
    l,
    i >= 0 ? h.slice(Math.max(0, i - 80), i + 220).replace(/\s+/g, " ").slice(0, 300) : "MISS",
  );
}
