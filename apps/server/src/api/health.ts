import { Router } from "express";
import { loadLibrariesConfig } from "../config/loadConfig.js";
import { openDatabase } from "../db/init.js";
import { CONFIG_DIR, DATA_DIR, PROJECT_ROOT } from "../paths.js";
import { sendOk } from "./respond.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  openDatabase();
  const config = loadLibrariesConfig();
  sendOk(res, {
    service: "mdcs-server",
    version: "0.1.0",
    phase: "2",
    projectRoot: PROJECT_ROOT,
    configDir: CONFIG_DIR,
    dataDir: DATA_DIR,
    kinds: Object.keys(config.kinds).length,
    organize: config.organize,
  });
});
