const sharp = require("../../../apps/server/node_modules/sharp");
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "../public/logo.png");
const out = path.join(__dirname, "../public/icons");
fs.mkdirSync(out, { recursive: true });

async function make(size, name) {
  await sharp(src)
    .resize(size, size, { fit: "cover", position: "centre" })
    .png()
    .toFile(path.join(out, name));
}

(async () => {
  if (!fs.existsSync(src)) {
    console.error("missing logo source:", src);
    process.exit(1);
  }
  await make(180, "apple-touch-icon.png");
  await make(192, "icon-192.png");
  await make(512, "icon-512.png");
  console.log("generated", fs.readdirSync(out));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
