import { request } from "undici";
import type { JobRecord, KindId } from "../types.js";
import { loadOpsConfig } from "./loadOps.js";
import { renderTemplate, renderUrl } from "./template.js";
import type { WebhookEndpoint } from "./types.js";

export type WebhookPayloadVars = Record<string, string | number | undefined | null>;

export function buildJobWebhookVars(
  job: JobRecord,
  event: "finished" | "failed",
): WebhookPayloadVars {
  const durationSec =
    job.updatedAt && job.createdAt
      ? Math.max(0, Math.round((job.updatedAt - job.createdAt) / 1000))
      : 0;
  return {
    event,
    timestamp: new Date(job.updatedAt || Date.now()).toISOString(),
    started_at: new Date(job.createdAt).toISOString(),
    task_id: job.id,
    duration: durationSec,
    source_path: "",
    target_path: "",
    error_message: event === "failed" ? job.message || "" : "",
    number: "",
    title: "",
    actor: "",
    first_actor: "",
    category: (job.kinds || []).join(","),
    mosaic: "",
    tags: "",
    outline: "",
    thumb: "",
    poster: "",
    mode: job.mode,
    status: job.status,
    processed: job.processed,
    failed: job.failed,
    total: job.total,
  };
}

function kindsMatch(endpoint: WebhookEndpoint, jobKinds: KindId[]): boolean {
  if (!endpoint.kinds.length) return true;
  return jobKinds.some((k) => endpoint.kinds.includes(k));
}

export async function dispatchWebhookEndpoint(
  endpoint: WebhookEndpoint,
  vars: WebhookPayloadVars,
): Promise<{ ok: boolean; status?: number; message: string; ms: number }> {
  const started = Date.now();
  const url = renderUrl(endpoint.url, vars);
  const body = renderTemplate(endpoint.bodyTemplate, vars);
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
  };
  for (const h of endpoint.headers) {
    headers[h.key] = renderTemplate(h.value, vars);
  }

  let lastErr = "";
  const attempts = Math.max(1, endpoint.retries + 1);
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await request(url, {
        method: endpoint.method,
        headers,
        body: endpoint.method === "GET" ? undefined : body,
        signal: AbortSignal.timeout(endpoint.timeoutSec * 1000),
      });
      await res.body.dump();
      const ms = Date.now() - started;
      if (res.statusCode >= 200 && res.statusCode < 300) {
        return { ok: true, status: res.statusCode, message: `HTTP ${res.statusCode}`, ms };
      }
      lastErr = `HTTP ${res.statusCode}`;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
  }
  return { ok: false, message: lastErr || "派发失败", ms: Date.now() - started };
}

export async function dispatchJobWebhooks(job: JobRecord): Promise<void> {
  const cfg = loadOpsConfig();
  if (!cfg.webhook.enabled || !cfg.webhook.endpoints.length) return;

  const event: "finished" | "failed" =
    job.status === "failed" ? "failed" : job.status === "done" ? "finished" : "finished";
  if (job.status !== "done" && job.status !== "failed") return;

  const vars = buildJobWebhookVars(job, event);
  for (const ep of cfg.webhook.endpoints) {
    if (!ep.events.includes(event)) continue;
    if (!kindsMatch(ep, job.kinds)) continue;
    try {
      const r = await dispatchWebhookEndpoint(ep, vars);
      if (!r.ok) {
        console.warn(`[webhook] ${ep.name} 失败: ${r.message}`);
      }
    } catch (err) {
      console.warn(
        `[webhook] ${ep.name} 异常: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
