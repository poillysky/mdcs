import fs from "node:fs";
import sharp from "sharp";

// 当前文件已是方图/半身，再取上方 55% 紧裁成头像
const src = "e:/Mdcs/data/actors/波多野結衣/avatar.jpg";
const meta = await sharp(src).metadata();
const w = meta.width || 512;
const h = meta.height || 512;
const side = Math.floor(Math.min(w, h) * 0.55);
const left = Math.floor((w - side) / 2);
const top = Math.floor(h * 0.02);
const out = await sharp(src)
  .extract({ left, top, width: side, height: side })
  .resize(512, 512)
  .jpeg({ quality: 90 })
  .toBuffer();
fs.writeFileSync(src, out);
console.log({ w, h, side, left, top, size: out.length });
