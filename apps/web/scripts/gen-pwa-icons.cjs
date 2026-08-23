const sharp = require("../../../apps/server/node_modules/sharp");
const fs = require("fs");
const path = require("path");

const out = path.join(__dirname, "../public/icons");
fs.mkdirSync(out, { recursive: true });

async function make(size, name) {
  const r = Math.round(size * 0.22);
  const font = Math.round(size * 0.42);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="#3D5C63"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
    font-family="Segoe UI, Helvetica Neue, Arial, sans-serif" font-weight="600"
    font-size="${font}" fill="#ffffff">S</text>
</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(out, name));
}

(async () => {
  await make(180, "apple-touch-icon.png");
  await make(192, "icon-192.png");
  await make(512, "icon-512.png");
  console.log("generated", fs.readdirSync(out));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
