import { kindLabel } from "../../lib/labels";
import { displayRelativePath, looksAbsolutePath } from "../../lib/paths";
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
      items: (step.items ?? []).map((item) => ({
        tone: item.tone,
        text: sanitizePipelineLogText(item.text),
      })),
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

export function isNonCriticalSourceError(error?: string): boolean {
  const err = String(error || "").trim().toLowerCase();
  if (!err) return true;
  const patterns = [
    "未找到",
    "没有找到",
    "无数据",
    "无结果",
    "not found",
    "no result",
    "no data",
    "no match",
    "404",
    "详情页",
    "empty",
    "stub",
    "无元数据",
    "无有效",
  ];
  return patterns.some((p) => err.includes(p));
}

export function sourceRunTone(
  ok: boolean,
  error?: string,
): LogTone {
  if (ok) return "ok";
  return isNonCriticalSourceError(error) ? "warn" : "fail";
}

export function buildLogSteps(file: FileRow, meta: ScrapeMetaView | null): LogStep[] {
  const runs = meta?.sourceRuns ?? [];
  const tried = meta?.sourcesTried ?? [];
  const snapshots = meta?.sourceSnapshots ?? {};
  const fieldSources = meta?.fieldSources ?? {};
  const code = file.code || meta?.code || "";
  const targetRel = file.target_path ? displayRelativePath(file.target_path) : "";
  const sourceRel = displayRelativePath(file.source_path);
  const hasCover = Boolean(meta?.coverUrl || meta?.coverLocal || file.cover_url);
  const fanartCount =
    (meta?.extrafanartLocal?.length || 0) || (meta?.extrafanartUrls?.length || 0);
  const organized = Boolean(file.organized_at || (file.target_path && file.status === "done"));
  const nfoDone = file.status === "done" || Boolean(file.organized_at);

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
      dirItems.push({ tone: "warn", text: "没有找到字幕文件" });
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
  if (organized && targetRel) {
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
    imageItems.push({ tone: "ok", text: "等待整理：海报将写入片库目标目录" });
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
  } else if (file.target_path) {
    transferItems.push({
      tone: "ok",
      text: `目标路径：'${targetRel}'`,
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
        ? `成功生成 NFO：'${targetRel.replace(/[/\\][^/\\]*$/, "")}/movie.nfo'`
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
    { title: "刮削数据", done: Boolean(meta?.ok), items: scrapeItems },
    { title: "创建目录", done: Boolean(targetRel), items: dirItems },
    { title: "下载图片", done: hasCover, items: imageItems },
    { title: "转移文件", done: organized, items: transferItems },
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
