import { Router } from "express";
import { sendFail, sendOk } from "./respond.js";
import { loadOpsConfig, saveOpsConfig } from "../ops/loadOps.js";
import { handleQbCompleted, parseQbPayload } from "../ops/qb.js";
import {
  normalizeOpsConfig,
  newOpsId,
  type JobPreset,
} from "../ops/types.js";
import { dispatchWebhookEndpoint, type WebhookPayloadVars } from "../ops/webhook.js";
import { startMonitorService } from "../ops/monitor.js";

export const opsRouter = Router();

opsRouter.get("/config", (_req, res) => {
  try {
    sendOk(res, { config: loadOpsConfig() });
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 500);
  }
});

opsRouter.put("/config", (req, res) => {
  try {
    const saved = saveOpsConfig(normalizeOpsConfig(req.body?.config ?? req.body));
    startMonitorService();
    sendOk(res, { config: saved });
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 400);
  }
});

opsRouter.post("/webhook/test", async (req, res) => {
  try {
    const cfg = loadOpsConfig();
    const endpointId = String(req.body?.endpointId || "");
    const endpoint =
      cfg.webhook.endpoints.find((e) => e.id === endpointId) ||
      normalizeOpsConfig({ webhook: { enabled: true, endpoints: [req.body?.endpoint] } })
        .webhook.endpoints[0];
    if (!endpoint) {
      sendFail(res, "未找到 Endpoint");
      return;
    }
    const custom = (req.body?.vars || {}) as WebhookPayloadVars;
    const vars: WebhookPayloadVars = {
      event: "finished",
      timestamp: new Date().toISOString(),
      started_at: new Date().toISOString(),
      task_id: "test_job",
      duration: 1,
      number: "SSIS-001",
      title: "Webhook 测试标题",
      actor: "测试演员",
      first_actor: "测试演员",
      category: "japan_censored",
      outline: "测试简介",
      tags: "测试",
      thumb: "",
      poster: "",
      error_message: "",
      source_path: "",
      target_path: "",
      ...custom,
    };
    const result = await dispatchWebhookEndpoint(endpoint, vars);
    sendOk(res, result);
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 500);
  }
});

/** 导出预设 JSON */
opsRouter.get("/presets/export", (_req, res) => {
  try {
    const cfg = loadOpsConfig();
    sendOk(res, {
      version: 1,
      exportedAt: Date.now(),
      presets: cfg.presets,
    });
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 500);
  }
});

/** 导入预设：merge | replace */
opsRouter.post("/presets/import", (req, res) => {
  try {
    const mode = req.body?.mode === "replace" ? "replace" : "merge";
    const rawList = Array.isArray(req.body?.presets)
      ? req.body.presets
      : Array.isArray(req.body?.data?.presets)
        ? req.body.data.presets
        : null;
    if (!rawList) {
      sendFail(res, "缺少 presets 数组");
      return;
    }
    const cfg = loadOpsConfig();
    const imported = normalizeOpsConfig({ presets: rawList }).presets;
    if (!imported.length) {
      sendFail(res, "没有有效的预设可导入");
      return;
    }
    let next: JobPreset[];
    if (mode === "replace") {
      next = imported.map((p) => ({ ...p, id: newOpsId("preset"), updatedAt: Date.now() }));
    } else {
      const byName = new Map(cfg.presets.map((p) => [p.name.toLowerCase(), p]));
      next = [...cfg.presets];
      for (const p of imported) {
        const key = p.name.toLowerCase();
        const existing = byName.get(key);
        if (existing) {
          next = next.map((x) =>
            x.id === existing.id
              ? { ...p, id: existing.id, updatedAt: Date.now() }
              : x,
          );
        } else {
          const created = { ...p, id: newOpsId("preset"), updatedAt: Date.now() };
          next.push(created);
          byName.set(key, created);
        }
      }
    }
    const saved = saveOpsConfig({ ...cfg, presets: next });
    sendOk(res, { config: saved, imported: imported.length });
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 400);
  }
});

/** 新增/更新单个预设 */
opsRouter.post("/presets", (req, res) => {
  try {
    const cfg = loadOpsConfig();
    const normalized = normalizeOpsConfig({
      presets: [{ ...(req.body?.preset ?? req.body), id: req.body?.preset?.id || req.body?.id }],
    }).presets[0];
    if (!normalized) {
      sendFail(res, "预设无效（需要名称）");
      return;
    }
    const existingIdx = cfg.presets.findIndex((p) => p.id === normalized.id);
    let presets: JobPreset[];
    if (existingIdx >= 0) {
      presets = cfg.presets.map((p, i) =>
        i === existingIdx ? { ...normalized, id: p.id, updatedAt: Date.now() } : p,
      );
    } else {
      presets = [
        ...cfg.presets,
        { ...normalized, id: newOpsId("preset"), updatedAt: Date.now() },
      ];
    }
    const saved = saveOpsConfig({ ...cfg, presets });
    sendOk(res, { config: saved, preset: presets.find((p) => p.name === normalized.name) });
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 400);
  }
});

opsRouter.delete("/presets/:id", (req, res) => {
  try {
    const cfg = loadOpsConfig();
    const id = req.params.id;
    if (!cfg.presets.some((p) => p.id === id)) {
      sendFail(res, "预设不存在", 404);
      return;
    }
    const saved = saveOpsConfig({
      ...cfg,
      presets: cfg.presets.filter((p) => p.id !== id),
    });
    sendOk(res, { config: saved });
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 400);
  }
});

/** qBittorrent 完成钩子 */
opsRouter.post("/qb/completed", async (req, res) => {
  try {
    const payload = parseQbPayload(req.body, req.query as Record<string, unknown>);
    const result = await handleQbCompleted(payload);
    sendOk(res, result);
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 400);
  }
});

opsRouter.get("/qb/completed", async (req, res) => {
  try {
    const payload = parseQbPayload({}, req.query as Record<string, unknown>);
    const result = await handleQbCompleted(payload);
    sendOk(res, result);
  } catch (err) {
    sendFail(res, err instanceof Error ? err.message : String(err), 400);
  }
});
