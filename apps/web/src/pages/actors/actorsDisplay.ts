import type { ActorRow } from "../../types";
import type { EmbyActorRow } from "./types";

export function parseActorsTab(path: string): "local" | "emby" {
  return path.startsWith("/actors/emby") ? "emby" : "local";
}

export function parseActorName(search: string): string {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(raw).get("name")?.trim() ?? "";
}

export function formatActorTime(ms?: number | null): string {
  if (!ms) return "—";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function actorInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed.slice(0, 1);
}

export function localStatusClass(status: ActorRow["profileStatus"]): string {
  if (status === "scraped") return "records-pill records-pill--success";
  return "records-pill records-pill--muted";
}

export function localStatusLabel(status: ActorRow["profileStatus"]): string {
  if (status === "scraped") return "已刮削";
  return "未刮削";
}

export function embyStatusClass(status: EmbyActorRow["status"]): string {
  if (status === "success") return "records-pill records-pill--success";
  if (status === "failed") return "records-pill records-pill--error";
  return "records-pill records-pill--muted";
}

export function embyStatusLabel(status: EmbyActorRow["status"]): string {
  if (status === "success") return "成功";
  if (status === "failed") return "失败";
  return "跳过";
}

export function parseEmbySyncRows(result: {
  updatedMeta: number;
  updatedImage: number;
  skipped: number;
  failed: number;
  errors?: string[];
  logs?: string[];
}): EmbyActorRow[] {
  const rows: EmbyActorRow[] = [];
  for (const log of result.logs ?? []) {
    const text = log.trim();
    if (!text) continue;
    const failed = /失败|error|fail/i.test(text);
    const skipped = /跳过|skip/i.test(text);
    rows.push({
      id: `log-${rows.length}-${text.slice(0, 24)}`,
      name: text.replace(/^\[.*?\]\s*/, "").slice(0, 80) || text,
      status: failed ? "failed" : skipped ? "skipped" : "success",
      detail: text,
      error: failed ? text : "",
    });
  }
  for (const err of result.errors ?? []) {
    const text = err.trim();
    if (!text) continue;
    rows.push({
      id: `err-${rows.length}-${text.slice(0, 24)}`,
      name: text.slice(0, 80),
      status: "failed",
      detail: "同步失败",
      error: text,
    });
  }
  if (rows.length) return rows;
  if (result.updatedMeta || result.updatedImage) {
    rows.push({
      id: "summary-ok",
      name: "媒体库演员",
      status: "success",
      detail: `元数据 ${result.updatedMeta} · 图片 ${result.updatedImage}`,
      error: "",
    });
  }
  if (result.skipped) {
    rows.push({
      id: "summary-skip",
      name: "已跳过",
      status: "skipped",
      detail: `${result.skipped} 条`,
      error: "",
    });
  }
  if (result.failed) {
    rows.push({
      id: "summary-fail",
      name: "同步失败",
      status: "failed",
      detail: `${result.failed} 条`,
      error: "",
    });
  }
  return rows;
}
