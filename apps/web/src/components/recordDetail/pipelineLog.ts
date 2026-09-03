import { kindLabel } from "../../lib/labels";
import { displayRelativePath, expandLibraryTargetPath, looksAbsolutePath, nfoFileNameForTarget } from "../../lib/paths";
import type { PipelineRunKind, PipelineRunView } from "../../api";
import type { FileRow, ScrapeMetaView } from "../../types";
import type { LogItem, LogRunOption, LogStep, LogTone } from "./types";

export const PIPELINE_KIND_LABELS: Record<PipelineRunKind, string> = {
  initial: "首次",
  retry: "重试",
  rescrape: "重新刮削",
  reorganize: "重新整理",
};

export function formatPipelineAt(at: number): string {
  if (!Number.isFinite(at) || at <= 0) return "";
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}

export function pipelineRunLabel(kind: PipelineRunKind, at: number): string {
  const date = formatPipelineAt(at);
  return date ? `${PIPELINE_KIND_LABELS[kind]} - ${date}` : PIPELINE_KIND_LABELS[kind];
}

/** 下拉：首次置顶，其余按时间正序（最旧→最新） */
export function sortLogRunsChronological<T extends { kind: PipelineRunKind; at: number }>(runs: T[]): T[] {
  return [...runs].sort((a, b) => {
    if (a.kind === "initial" && b.kind !== "initial") return -1;
    if (b.kind === "initial" && a.kind !== "initial") return 1;
    return a.at - b.at;
  });
}

export function pickLatestLogRun<T extends { at: number }>(runs: T[]): T | undefined {
  if (!runs.length) return undefined;
  return runs.reduce((best, r) => (r.at >= best.at ? r : best));
}

export function parseScrapedAtMs(file: FileRow, meta: ScrapeMetaView | null): number {
  if (typeof file.scraped_at === "number" && file.scraped_at > 0) return file.scraped_at;
  if (meta?.scrapedAt) {
    const t = Date.parse(meta.scrapedAt);
    if (Number.isFinite(t)) return t;
  }
  if (typeof file.organized_at === "number" && file.organized_at > 0) return file.organized_at;
  return Date.now();
}

/** 归档日志里旧绝对路径 → 相对路径；旧文案「封面已保存」→「封面缓存已保存」 */
export function sanitizePipelineLogText(text: string): string {
  let next = String(text || "");
  next = next.replace(/^封面已保存：/, "封面缓存已保存：");
  next = next.replace(/'([^']+)'/g, (_m, inner: string) => {
    const raw = String(inner || "").trim();
    if (!raw) return "''";
    if (looksAbsolutePath(raw) || /^[\\/]?(?:data|media|index)[\\/]/i.test(raw)) {
      const rel = displayRelativePath(raw);
      return `'${rel === "—" ? raw : rel}'`;
    }
    return `'${raw}'`;
  });
  return next;
}

export function toLogRunOption(run: PipelineRunView): LogRunOption {
  return {
    id: run.id,
    kind: run.kind,
    at: run.at,
    steps: (run.steps ?? []).map((step) => ({
      title: step.title,
      done: step.done,
      items: (step.items ?? []).map((item) => {
        const text = sanitizePipelineLogText(item.text);
        return {
          tone: normalizeLogItemTone(text, item.tone),
          text,
        };
      }),
    })),
  };
}
export function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0.000s";
  return `${(ms / 1000).toFixed(3)}s`;
}

export function codeSearchVariants(code: string): string[] {
  const raw = String(code || "").trim();
  const compact = raw.replace(/[-_\s]/g, "");
  return [...new Set([raw, compact].filter(Boolean))];
}

export function isCriticalSourceError(error?: string): boolean {
  const err = String(error || "").trim().toLowerCase();
  if (!err) return false;
  const patterns = ["timeout", "timed out", "time out", "abort", "cancelled", "canceled"];
  return patterns.some((p) => err.includes(p));
}

export function isNonCriticalSourceError(error?: string): boolean {
  const err = String(error || "").trim().toLowerCase();
  if (!err) return true;
  return !isCriticalSourceError(err);
}

export function sourceRunTone(ok: boolean, error?: string): LogTone {
  if (ok) return "ok";
  if (isCriticalSourceError(error)) return "fail";
  return "warn";
}

/** 归档日志里旧 tone 修正：单源未抓到数据默认黄灯 */
export function normalizeLogItemTone(text: string, tone: LogTone): LogTone {
  if (!text.startsWith("未抓取到数据")) return tone;
  const colon = text.indexOf(": ");
  const err = colon >= 0 ? text.slice(colon + 2) : "";
  if (isCriticalSourceError(err)) return "fail";
  return "warn";
}

export function expandPipelineLogText(text: string, libraryRoot?: string): string {
  let next = sanitizePipelineLogText(text);
  if (!libraryRoot?.trim()) return next;
  return next.replace(/'([^']+)'/g, (_m, inner: string) => {
    const raw = String(inner || "").trim();
    if (!raw) return "''";
    const expanded = expandLibraryTargetPath(raw, libraryRoot);
    if (expanded === raw) return `'${raw}'`;
    return `'${displayRelativePath(expanded)}'`;
  });
}

export function expandPipelineLogSteps(steps: LogStep[], libraryRoot?: string): LogStep[] {
  if (!libraryRoot?.trim()) return steps;
  return steps.map((step) => ({
    ...step,
    items: step.items.map((item) => ({
      ...item,
      text: expandPipelineLogText(item.text, libraryRoot),
    })),
  }));
}

const PIPELINE_STEP_ORDER = [
  "解析番号",
  "刮削数据",
  "创建目录",
  "下载图片",
  "转移文件",
  "生成 NFO",
] as const;

/**
 * 归档日志常只有刮削前两步；用当前文件状态补全后续整理步骤展示。
 * 已有归档条目的步骤优先保留（含实时源站明细）。
 */
export function mergeLogSteps(archived: LogStep[], synthesized: LogStep[]): LogStep[] {
  const archivedByTitle = new Map(archived.map((s) => [s.title, s]));
  const synthByTitle = new Map(synthesized.map((s) => [s.title, s]));
  const merged: LogStep[] = [];

  for (const title of PIPELINE_STEP_ORDER) {
    const arch = archivedByTitle.get(title);
    const synth = synthByTitle.get(title);
    if (arch?.items.length) {
      merged.push(arch);
    } else if (synth) {
      merged.push(synth);
    } else if (arch) {
      merged.push(arch);
    }
  }

  const failStep = synthesized.find((s) => s.title === "任务失败");
  if (failStep) merged.push(failStep);

  return merged.length ? merged : synthesized;
}

export function buildLogSteps(
  file: FileRow,
  meta: ScrapeMetaView | null,
  libraryRoot?: string,
): LogStep[] {
  const runs = meta?.sourceRuns ?? [];
  const tried = meta?.sourcesTried ?? [];
  const snapshots = meta?.sourceSnapshots ?? {};
  const fieldSources = meta?.fieldSources ?? {};
  const code = file.code || meta?.code || "";
  const targetFull = file.target_path ? expandLibraryTargetPath(file.target_path, libraryRoot) : "";
  const targetRel = targetFull ? displayRelativePath(targetFull) : "";
  const nfoFileName = nfoFileNameForTarget(file.target_path ?? undefined, libraryRoot);
  const sourceRel = displayRelativePath(file.source_path);
  const hasCover = Boolean(meta?.coverUrl || meta?.coverLocal || file.cover_url);
  const fanartCount =
    (meta?.extrafanartLocal?.length || 0) || (meta?.extrafanartUrls?.length || 0);
  const organized = file.status === "done" || Boolean(file.organized_at);
  const pipelineDone = file.status === "done";
  const scrapeDone = Boolean(meta?.ok);
  const nfoDone = pipelineDone;
  const dirDone = organized;
  const imageDone = organized && hasCover;
  const transferDone = organized && Boolean(targetRel);

  // 1. 解析番号
  const parseDone = Boolean(code);
  const parseItems: LogItem[] = [
    { tone: "ok", text: "MDCS 刮削引擎" },
    { tone: "ok", text: `文件路径：'${sourceRel}'` },
    {
      tone: parseDone ? "ok" : "fail",
      text: parseDone ? `番号识别结果：'${code}'` : "未能识别番号",
    },
  ];
  if (file.kind) {
    parseItems.push({ tone: "ok", text: `路径分类：${kindLabel(file.kind)}` });
  }

  // 2. 刮削数据
  const scrapeItems: LogItem[] = [];
  const sourceIds =
    tried.length > 0
      ? tried
      : runs.length > 0
        ? runs.map((r) => r.id)
        : Object.keys(snapshots);
  if (sourceIds.length) {
    scrapeItems.push({
      tone: "ok",
      text: `正在从 ${sourceIds.length} 个站点刮削数据：${sourceIds.join(", ")}`,
    });
  }
  const runById = new Map(runs.map((r) => [r.id, r]));
  for (const id of sourceIds) {
    const run = runById.get(id);
    const snap = snapshots[id];
    const ok = run ? run.ok : Boolean(snap && !snap.error);
    if (ok) {
      scrapeItems.push({
        tone: "ok",
        text: `成功抓取到数据，用时 ${formatMs(run?.ms ?? 0)} <${id}>`,
      });
    } else {
      const err = run?.error || snap?.error;
      scrapeItems.push({
        tone: sourceRunTone(false, err),
        text: `未抓取到数据 <${id}>${err ? `: ${err}` : ""}`,
      });
    }
  }
  const fieldPairs = Object.entries(fieldSources);
  if (fieldPairs.length) {
    const summary = fieldPairs
      .slice(0, 8)
      .map(([field, source]) => `${field}←${source}`)
      .join(" · ");
    scrapeItems.push({
      tone: "ok",
      text: `字段来源：${summary}${fieldPairs.length > 8 ? " …" : ""}`,
    });
  }
  if (meta?.ok) {
    scrapeItems.push({ tone: "ok", text: "元数据获取成功" });
  } else if (meta?.message) {
    scrapeItems.push({ tone: "fail", text: meta.message });
  } else if (!scrapeItems.length) {
    scrapeItems.push({ tone: "warn", text: "暂无源请求记录（可能来自旧缓存）" });
  }

  // 3. 创建目录（字幕搜索 + 目录）
  const dirItems: LogItem[] = [];
  if (code) {
    const variants = codeSearchVariants(code);
    dirItems.push({
      tone: "ok",
      text: `正在从本地库搜索字幕：[${variants.join(", ")}]`,
    });
    if (organized || file.status === "done") {
      dirItems.push({ tone: "ok", text: "字幕搜索已完成" });
    } else {
      dirItems.push({ tone: "warn", text: "尚未搜索本地字幕" });
    }
  }
  if (targetRel) {
    dirItems.push({ tone: "ok", text: `成功创建目录：'${targetRel}'` });
  } else if (organized || file.status === "done") {
    dirItems.push({ tone: "warn", text: "未记录目标目录路径" });
  } else if (file.status === "failed") {
    dirItems.push({ tone: "fail", text: "创建目录失败（任务已失败）" });
  } else {
    dirItems.push({ tone: "warn", text: "尚未创建整理目录" });
  }

  // 4. 下载图片（刮削 → data/covers 缓存；整理 → 片库 poster/thumb）
  const imageItems: LogItem[] = [];
  if (meta?.coverUrl || file.cover_url) {
    imageItems.push({
      tone: "ok",
      text: `正在下载封面：${meta?.coverUrl || file.cover_url}`,
    });
  }
  if (meta?.coverLocal) {
    imageItems.push({
      tone: "ok",
      text: `封面缓存已保存：'${displayRelativePath(meta.coverLocal)}'`,
    });
  }
  if (organized && targetRel && hasCover) {
    const targetDir = targetRel.replace(/\/[^/]+$/, "") || targetRel;
    imageItems.push({
      tone: "ok",
      text: `海报已写入：'${targetDir}/poster.jpg'`,
    });
    imageItems.push({
      tone: "ok",
      text: `缩略图已写入：'${targetDir}/thumb.jpg'`,
    });
  } else if (meta?.coverLocal) {
    imageItems.push({ tone: "warn", text: "等待整理：海报将写入片库目标目录" });
  } else if (hasCover && !organized) {
    imageItems.push({ tone: "warn", text: "封面已缓存，待整理写入片库" });
  } else if (hasCover) {
    imageItems.push({ tone: "ok", text: "封面已就绪（本地海报/缩略图）" });
  } else if (meta?.ok) {
    imageItems.push({ tone: "warn", text: "未下载到封面" });
  } else {
    imageItems.push({ tone: "warn", text: "尚未下载封面" });
  }
  if (fanartCount > 0) {
    imageItems.push({
      tone: "ok",
      text: `剧照 ${fanartCount} 张${meta?.extrafanartLocal?.length ? "（已落盘）" : ""}`,
    });
  } else {
    imageItems.push({ tone: "warn", text: "无剧照或未下载剧照" });
  }

  // 5. 转移文件
  const transferItems: LogItem[] = [];
  if (organized && targetRel) {
    transferItems.push({
      tone: "ok",
      text: `成功整理到 '${targetRel}'`,
    });
  } else if (file.target_path && !organized) {
    transferItems.push({
      tone: "warn",
      text: `已规划目标路径：'${targetRel}'（尚未完成转移）`,
    });
  } else if (file.status === "failed") {
    transferItems.push({
      tone: "fail",
      text: file.error ? `转移失败：${file.error}` : "转移失败",
    });
  } else {
    transferItems.push({ tone: "warn", text: "尚未转移文件" });
  }

  // 6. 生成 NFO
  const nfoItems: LogItem[] = [];
  if (nfoDone) {
    nfoItems.push({ tone: "ok", text: "正在写入 NFO 元数据…" });
    nfoItems.push({
      tone: "ok",
      text: targetRel
        ? `成功生成 NFO：'${targetRel.replace(/[/\\][^/\\]*$/, "")}/${nfoFileName}'`
        : "成功生成 NFO 元数据",
    });
    const nfoFields = [
      "title",
      "plot",
      "actors",
      "genres",
      "studio",
      "premiered",
      "runtime",
      "score",
    ].filter((k) => Boolean(fieldSources[k])).join(", ");
    if (nfoFields) {
      nfoItems.push({ tone: "ok", text: `已写入字段：${nfoFields}` });
    }
  } else if (file.status === "failed") {
    nfoItems.push({ tone: "fail", text: "未生成 NFO（任务失败）" });
  } else {
    nfoItems.push({ tone: "warn", text: "尚未生成 NFO" });
  }

  const steps: LogStep[] = [
    { title: "解析番号", done: parseDone, items: parseItems },
    { title: "刮削数据", done: scrapeDone, items: scrapeItems },
    { title: "创建目录", done: dirDone, items: dirItems },
    { title: "下载图片", done: imageDone, items: imageItems },
    { title: "转移文件", done: transferDone, items: transferItems },
    { title: "生成 NFO", done: nfoDone, items: nfoItems },
  ];

  if (file.status === "failed" && file.error) {
    steps.push({
      title: "任务失败",
      done: false,
      items: [{ tone: "fail", text: file.error }],
    });
  }

  return steps;
}
