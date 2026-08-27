import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { filesRouter } from "./files.js";
import { healthRouter } from "./health.js";
import { jobsRouter } from "./jobs.js";
import { kindsRouter } from "./kinds.js";
import { scrapeRouter } from "./scrape.js";
import { organizeRouter } from "./organize.js";
import { opsRouter } from "./ops.js";
import { actorsRouter } from "./actors.js";
import { embyActorsRouter } from "./embyActors.js";
import { dashboardRouter } from "./dashboard.js";
import { optionalApiAuth } from "../security/auth.js";
import { PROJECT_ROOT } from "../paths.js";

function resolveWebDist(): string | null {
  const env = String(process.env.MDCS_WEB_DIST || "").trim();
  const candidates = [
    env,
    path.join(PROJECT_ROOT, "apps", "web", "dist"),
    path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "web", "dist"),
  ].filter(Boolean);
  for (const c of candidates) {
    if (c && fs.existsSync(path.join(c, "index.html"))) return c;
  }
  return null;
}

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Mdcs-Token",
    );
    if (_req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(optionalApiAuth);

  app.use(healthRouter);
  app.use("/api/kinds", kindsRouter);
  app.use("/api/jobs", jobsRouter);
  app.use("/api/files", filesRouter);
  app.use("/api/scrape", scrapeRouter);
  app.use("/api/organize", organizeRouter);
  app.use("/api/ops", opsRouter);
  app.use("/api/ops/actors/emby", embyActorsRouter);
  app.use("/api/actors", actorsRouter);
  app.use("/api/dashboard", dashboardRouter);

  const webDist = resolveWebDist();
  if (webDist) {
    app.use(express.static(webDist, { index: false }));
    app.get(/^(?!\/api(?:\/|$)|\/health(?:\/|$)).*/, (_req, res) => {
      res.sendFile(path.join(webDist, "index.html"));
    });
  }

  app.use((_req, res) => {
    res.status(404).json({ ok: false, code: "not_found", message: "Not Found" });
  });

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, code: "internal_error", message });
    },
  );

  return app;
}
