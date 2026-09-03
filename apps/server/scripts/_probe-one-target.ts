import { openDatabase } from "../src/db/init.js";
import fs from "node:fs";
import path from "node:path";
import { loadLibrariesConfig, resolveKind } from "../src/config/loadConfig.js";
import { PROJECT_ROOT, resolveFromRoot } from "../src/paths.js";
import { resolveStoredTargetAbs } from "../src/organize/libraryPaths.js";

const db = openDatabase();
const config = loadLibrariesConfig();

const row = db.prepare(`SELECT * FROM files WHERE id = 90096`).get() as Record<string, unknown>;
const kind = resolveKind(String(row.kind) as never, config)!;
const tp = String(row.target_path);
const wrong = resolveFromRoot(tp, PROJECT_ROOT);
const right = resolveStoredTargetAbs(kind, tp);
console.log("code", row.code, "status", row.status);
console.log("target_path DB:", tp);
console.log("wrong abs:", wrong, "exists", fs.existsSync(wrong));
console.log("right abs:", right, "exists", fs.existsSync(right));
const dir = path.dirname(right);
console.log("dir:", dir, "exists", fs.existsSync(dir));
if (fs.existsSync(dir)) console.log("files:", fs.readdirSync(dir));
