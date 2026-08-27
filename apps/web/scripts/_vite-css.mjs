import { createServer } from "vite";
import fs from "node:fs";

const s = await createServer({
  root: process.cwd(),
  logLevel: "info",
  server: { middlewareMode: true },
});
try {
  const r = await s.transformRequest("/src/styles.css");
  const c = String(r?.code || "");
  const empty = c.includes('__vite__css = ""');
  fs.writeFileSync(
    "scripts/_vite-css-out.txt",
    `len=${c.length}\nempty=${empty}\nhead=\n${c.slice(0, 800)}\n`,
    "utf8",
  );
  console.log("len", c.length, "empty", empty);
} catch (e) {
  console.error(e);
  fs.writeFileSync("scripts/_vite-css-out.txt", String(e?.stack || e), "utf8");
} finally {
  await s.close();
}
