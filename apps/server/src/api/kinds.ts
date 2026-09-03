import { Router } from "express";
import {
  listEnabledKinds,
  listIndexFolders,
  listResolvedKinds,
  loadLibrariesConfig,
  pickKinds,
  updateKindConfig,
  updateOrganizeConfig,
} from "../config/loadConfig.js";
import { countFilesByKind, syncKindsFromConfig } from "../db/init.js";
import { scanKind, resolveKindScanAbs } from "../jobs/scanner.js";
import { PROJECT_ROOT } from "../paths.js";
import type { KindId } from "../types.js";
import { API_CODES } from "./codes.js";
import { sendFail, sendOk } from "./respond.js";

function kindForApi(k: ReturnType<typeof listResolvedKinds>[number]) {
  const { sourceAbs: _s, libraryAbs: _l, ...rest } = k;
  return { ...rest, stats: countFilesByKind(k.id) };
}

export const kindsRouter = Router();

kindsRouter.get("/", (_req, res) => {
  syncKindsFromConfig();
  const config = loadLibrariesConfig();
  const kinds = listResolvedKinds(config).map(kindForApi);
  sendOk(res, {
    organize: config.organize,
    indexRoot: config.indexRoot || "index",
    kinds,
  });
});

kindsRouter.put("/organize", (req, res) => {
  try {
    const organize = updateOrganizeConfig(req.body ?? {});
    sendOk(res, { organize });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    sendFail(res, msg, 400, API_CODES.bad_request);
  }
});

kindsRouter.get("/folders", (req, res) => {
  const parent = String(req.query.parent ?? "");
  try {
    sendOk(res, listIndexFolders(parent));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = msg.includes("不在允许范围内")
      ? API_CODES.path_not_allowed
      : API_CODES.bad_request;
    sendFail(res, msg, 400, code);
  }
});

kindsRouter.get("/:kindId", (req, res) => {
  const kindId = req.params.kindId as KindId;
  const kinds = listResolvedKinds();
  const kind = kinds.find((k) => k.id === kindId);
  if (!kind) return sendFail(res, `未知分区: ${kindId}`, 404, "kind_not_found");
  sendOk(res, { kind: kindForApi(kind), stats: countFilesByKind(kindId) });
});

kindsRouter.put("/:kindId", (req, res) => {
  const kindId = req.params.kindId as KindId;
  try {
    const kind = updateKindConfig(kindId, req.body ?? {});
    syncKindsFromConfig();
    sendOk(res, { kind, stats: countFilesByKind(kindId) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = msg.includes("不在允许范围内")
      ? API_CODES.path_not_allowed
      : API_CODES.kind_update_invalid;
    sendFail(res, msg, 400, code);
  }
});

kindsRouter.post("/:kindId/scan", async (req, res) => {
  const kindId = req.params.kindId as KindId;
  const kinds = pickKinds([kindId]);
  if (!kinds.length) return sendFail(res, `分区不可用: ${kindId}`, 404, "kind_unavailable");
  try {
    const scanPath = typeof req.body?.path === "string" ? req.body.path.trim() : "";
    const scanAbs = scanPath ? resolveKindScanAbs(kinds[0], scanPath) : undefined;
    const result = scanKind(kinds[0], PROJECT_ROOT, { scanAbs });
    sendOk(res, result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = msg.includes("不在") || msg.includes("不存在") ? API_CODES.bad_request : "scan_failed";
    sendFail(res, msg, 400, code);
  }
});

kindsRouter.get("/meta/enabled", (_req, res) => {
  sendOk(res, { kinds: listEnabledKinds() });
});
