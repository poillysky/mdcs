import { Router } from "express";
import {
  createEmbyClientFromActorsConfig,
  listEmbyLibraries,
  testEmbyConnection,
} from "../ops/embyClient.js";
import { runEmbyActorSync } from "../ops/embyActorSync.js";
import { loadOpsConfig } from "../ops/loadOps.js";
import { sendFail, sendOk } from "./respond.js";

export const embyActorsRouter = Router();

function actorsFromBodyOrConfig(body: unknown) {
  const cfg = loadOpsConfig().actors;
  if (!body || typeof body !== "object") return cfg;
  const b = body as Record<string, unknown>;
  return {
    ...cfg,
    embyUrl: typeof b.embyUrl === "string" ? b.embyUrl : cfg.embyUrl,
    embyApiKey: typeof b.embyApiKey === "string" ? b.embyApiKey : cfg.embyApiKey,
    embyUserId: typeof b.embyUserId === "string" ? b.embyUserId : cfg.embyUserId,
  };
}

embyActorsRouter.post("/test", async (req, res) => {
  try {
    const actors = actorsFromBodyOrConfig(req.body);
    const client = createEmbyClientFromActorsConfig(actors);
    const info = await testEmbyConnection(client);
    sendOk(res, info);
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 400);
  }
});

embyActorsRouter.get("/libraries", async (req, res) => {
  try {
    const cfg = loadOpsConfig().actors;
    const url = typeof req.query.embyUrl === "string" ? req.query.embyUrl : cfg.embyUrl;
    const apiKey = typeof req.query.embyApiKey === "string" ? req.query.embyApiKey : cfg.embyApiKey;
    const userId = typeof req.query.embyUserId === "string" ? req.query.embyUserId : cfg.embyUserId;
    const client = createEmbyClientFromActorsConfig({ embyUrl: url, embyApiKey: apiKey, embyUserId: userId });
    const libraries = await listEmbyLibraries(client);
    sendOk(res, { libraries });
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 400);
  }
});

embyActorsRouter.post("/sync", async (req, res) => {
  try {
    const cfg = loadOpsConfig().actors;
    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const actors = {
      ...cfg,
      ...(typeof body.embyUrl === "string" ? { embyUrl: body.embyUrl } : {}),
      ...(typeof body.embyApiKey === "string" ? { embyApiKey: body.embyApiKey } : {}),
      ...(typeof body.embyUserId === "string" ? { embyUserId: body.embyUserId } : {}),
      ...(Array.isArray(body.libraryIds)
        ? { libraryIds: body.libraryIds.filter((x): x is string => typeof x === "string") }
        : {}),
      ...(typeof body.scrapeMetadata === "boolean" ? { scrapeMetadata: body.scrapeMetadata } : {}),
      ...(typeof body.scrapeImages === "boolean" ? { scrapeImages: body.scrapeImages } : {}),
      ...(body.metadataOverwrite === "all" || body.metadataOverwrite === "missing"
        ? { metadataOverwrite: body.metadataOverwrite as "all" | "missing" }
        : {}),
      ...(typeof body.refreshLibraryAfterScrape === "boolean"
        ? { refreshLibraryAfterScrape: body.refreshLibraryAfterScrape }
        : {}),
      ...(typeof body.autoScrapeRecentDays === "number"
        ? { autoScrapeRecentDays: body.autoScrapeRecentDays }
        : {}),
    };
    const logs: string[] = [];
    const result = await runEmbyActorSync({
      actors,
      onProgress: (t) => logs.push(t),
    });
    sendOk(res, { ...result, logs });
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 400);
  }
});
