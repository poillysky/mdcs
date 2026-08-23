/**
 * 统一生成默认水印角标：胶囊标 640×320，分辨率标 360×320。
 * 风格：微立体渐变 + 顶光 + 白字描影，透明底。
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const sharp = require(path.join(ROOT, "apps/server/node_modules/sharp"));

const OUT_DIRS = [
  path.join(ROOT, "assets/watermarks/default"),
  path.join(ROOT, "apps/web/public/watermarks/default"),
];
const FONT = "C:/Windows/Fonts/simhei.ttf";

const PILLS = [
  {
    file: "youma.png",
    text: "有码",
    c0: "#7A8FA8",
    c1: "#5A6E86",
    c2: "#44566C",
    shadow: "#2A3644",
  },
  {
    file: "wuma.png",
    text: "无码",
    c0: "#8B78E8",
    c1: "#6B56CB",
    c2: "#523FA8",
    shadow: "#2E2466",
  },
  {
    file: "umr.png",
    text: "破解",
    c0: "#FF4A42",
    c1: "#E91C16",
    c2: "#B80F0B",
    shadow: "#5C0806",
  },
  {
    file: "leak.png",
    text: "流出",
    c0: "#FFD84A",
    c1: "#E8BF00",
    c2: "#C49A00",
    shadow: "#6B5200",
  },
  {
    file: "sub.png",
    text: "字幕",
    c0: "#55D464",
    c1: "#2FBF40",
    c2: "#1F9A2E",
    shadow: "#0F4E18",
  },
];

function pillSvg(p) {
  const W = 640;
  const H = 320;
  const m = 12;
  const pw = W - m * 2;
  const ph = H - m * 2;
  const rx = ph / 2;
  const id = p.file.replace(".", "_");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <style type="text/css"><![CDATA[
      @font-face {
        font-family: 'BadgeCN';
        src: url('file:///${FONT}');
      }
    ]]></style>
    <linearGradient id="g_${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.c0}"/>
      <stop offset="48%" stop-color="${p.c1}"/>
      <stop offset="100%" stop-color="${p.c2}"/>
    </linearGradient>
    <linearGradient id="shine_${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.38"/>
      <stop offset="42%" stop-color="#ffffff" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <filter id="textShadow_${id}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="2.2" flood-color="${p.shadow}" flood-opacity="0.55"/>
    </filter>
    <clipPath id="clip_${id}">
      <rect x="${m}" y="${m}" width="${pw}" height="${ph}" rx="${rx}" ry="${rx}"/>
    </clipPath>
  </defs>
  <rect x="${m}" y="${m}" width="${pw}" height="${ph}" rx="${rx}" ry="${rx}"
    fill="url(#g_${id})" stroke="rgba(255,255,255,0.22)" stroke-width="2"/>
  <rect x="${m}" y="${m}" width="${pw}" height="${ph}" rx="${rx}" ry="${rx}"
    fill="url(#shine_${id})" clip-path="url(#clip_${id})"/>
  <text x="${W / 2}" y="${Math.round(H / 2 + 46)}"
    text-anchor="middle"
    font-family="BadgeCN, SimHei, 'Microsoft YaHei', sans-serif"
    font-size="128" font-weight="700" letter-spacing="8"
    fill="#ffffff" filter="url(#textShadow_${id})">${p.text}</text>
</svg>`;
}

function resSvg(kind) {
  const W = 360;
  const H = 320;
  const label = kind.toUpperCase();
  const id = kind;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <style type="text/css"><![CDATA[
      @font-face {
        font-family: 'BadgeCN';
        src: url('file:///${FONT}');
      }
    ]]></style>
    <linearGradient id="yg_${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFE566"/>
      <stop offset="55%" stop-color="#FFD400"/>
      <stop offset="100%" stop-color="#E6B800"/>
    </linearGradient>
    <linearGradient id="bk_${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2A2A2A"/>
      <stop offset="100%" stop-color="#0A0A0A"/>
    </linearGradient>
    <linearGradient id="kt_${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFF3A8"/>
      <stop offset="45%" stop-color="#FFD400"/>
      <stop offset="100%" stop-color="#C9A000"/>
    </linearGradient>
  </defs>
  <rect x="10" y="8" width="${W - 20}" height="${H - 20}" rx="36" ry="36"
    fill="url(#yg_${id})" stroke="rgba(255,255,255,0.35)" stroke-width="2"/>
  <rect x="34" y="28" width="${W - 68}" height="168" rx="22" ry="22"
    fill="url(#bk_${id})" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
  <text x="${W / 2}" y="148"
    text-anchor="middle"
    font-family="BadgeCN, Arial Black, Impact, sans-serif"
    font-size="108" font-weight="800" letter-spacing="2"
    fill="url(#kt_${id})">${label}</text>
  <text x="${W / 2}" y="258"
    text-anchor="middle"
    font-family="BadgeCN, Arial Black, Impact, sans-serif"
    font-size="34" font-weight="800" letter-spacing="3"
    fill="#1A1A1A">ULTRA HD</text>
</svg>`;
}

async function writeAll(file, svg, targetW, targetH) {
  const buf = await sharp(Buffer.from(svg), { density: 144 })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
  const meta = await sharp(buf).metadata();
  const out = await sharp(buf)
    .resize(targetW, targetH, { fit: "fill" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  for (const dir of OUT_DIRS) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, file), out);
  }
  console.log(
    file,
    `${targetW}x${targetH}`,
    `${(out.length / 1024).toFixed(1)}KB`,
    `(render ${meta.width}x${meta.height})`,
  );
}

(async () => {
  for (const p of PILLS) {
    await writeAll(p.file, pillSvg(p), 640, 320);
  }
  await writeAll("4k.png", resSvg("4k"), 360, 320);
  await writeAll("8k.png", resSvg("8k"), 360, 320);
  console.log("done");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
