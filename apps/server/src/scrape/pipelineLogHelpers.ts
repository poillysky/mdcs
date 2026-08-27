import type { ScrapeMeta, SourceId } from "./types.js";
import {
  appendPipelineItem,
  markPipelineStepDone,
  pushPipelineStep,
  type PipelineLogItem,
  type PipelineLogTone,
} from "./pipelineProgress.js";
import { PROJECT_ROOT, toPosixRelative } from "../paths.js";
import path from "node:path";

export const PIPELINE_STEPS = {
  parse: "解析番号",
  scrape: "刮削数据",
  mkdir: "创建目录",
  images: "下载图片",
  transfer: "转移文件",
  nfo: "生成 NFO",
} as const;

const KIND_LABELS: Record<string, string> = {
  japan_censored: "日本有码",
  japan_gravure: "日本写真",
  japan_uncensored: "日本无码",
  japan_amateur: "日本素人",
  fc2: "FC2",
  china: "国产无码",
  western: "欧美无码",
};

function kindLabel(id: string): string {
  return KIND_LABELS[id] ?? id;
}

/** 日志展示用相对路径（相对项目根；非项目内则保留原样） */
export function displayPipelinePath(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  const norm = s.replace(/\\/g, "/");
  if (path.isAbsolute(s) || /^[a-zA-Z]:/.test(norm)) {
    const rel = toPosixRelative(s, PROJECT_ROOT);
    if (rel && !rel.startsWith("..")) return rel;
  }
  return norm.replace(/^\//, "");
}

export function formatPipelineMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0.000s";
  return `${(ms / 1000).toFixed(3)}s`;
}

/** 番号搜索字幕时的名称变体（如 SONE-999 / SONE999） */
export function codeSearchVariants(code: string): string[] {
  const raw = String(code || "").trim();
  const compact = raw.replace(/[-_\s]/g, "");
  return [...new Set([raw, compact].filter(Boolean))];
}

/** 数据源无数据、详情页未找到等 → 黄灯 */
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

export function sourceRunLogTone(
  run: { ok: boolean; error?: string; channel: "fast" | "slow" },
): PipelineLogTone {
  if (run.ok) return "ok";
  if (isNonCriticalSourceError(run.error)) return "warn";
  return "fail";
}

export function startParseStep(
  fileId: number,
  sourcePath: string,
  code: string,
  kind?: string,
): void {
  pushPipelineStep(fileId, {
    title: PIPELINE_STEPS.parse,
    done: false,
    items: [
      { tone: "ok", text: "MDCS 刮削引擎" },
      { tone: "ok", text: `文件路径：'${displayPipelinePath(sourcePath)}'` },
      { tone: "ok", text: `番号识别结果：'${code}'` },
    ],
  });
  if (kind) {
    appendPipelineItem(fileId, PIPELINE_STEPS.parse, {
      tone: "ok",
      text: `路径分类：${kindLabel(kind)}`,
    });
  }
  markPipelineStepDone(fileId, PIPELINE_STEPS.parse);
}

export function startScrapeStep(fileId: number, sourceIds: SourceId[]): void {
  pushPipelineStep(fileId, {
    title: PIPELINE_STEPS.scrape,
    done: false,
    items: [
      {
        tone: "ok",
        text: `正在从 ${sourceIds.length} 个站点刮削数据：${sourceIds.join(", ")}`,
      },
    ],
  });
}

export function appendSourceRunItem(
  fileId: number,
  run: { id: SourceId; ok: boolean; ms: number; error?: string; channel: "fast" | "slow" },
): void {
  if (run.ok) {
    appendPipelineItem(fileId, PIPELINE_STEPS.scrape, {
      tone: "ok",
      text: `成功抓取到数据，用时 ${formatPipelineMs(run.ms)} <${run.id}>`,
    });
  } else {
    appendPipelineItem(fileId, PIPELINE_STEPS.scrape, {
      tone: sourceRunLogTone(run),
      text: `未抓取到数据 <${run.id}>${run.error ? `: ${run.error}` : ""}`,
    });
  }
}

export function finishScrapeStep(fileId: number, meta: ScrapeMeta): void {
  const fieldPairs = Object.entries(meta.fieldSources ?? {});
  if (fieldPairs.length) {
    const summary = fieldPairs
      .slice(0, 8)
      .map(([field, source]) => `${field}←${source}`)
      .join(" · ");
    appendPipelineItem(fileId, PIPELINE_STEPS.scrape, {
      tone: "ok",
      text: `字段来源：${summary}${fieldPairs.length > 8 ? " …" : ""}`,
    });
  }
  if (meta.ok) {
    appendPipelineItem(fileId, PIPELINE_STEPS.scrape, { tone: "ok", text: "元数据获取成功" });
  } else if (meta.message) {
    appendPipelineItem(fileId, PIPELINE_STEPS.scrape, {
      tone: "fail",
      text: meta.message,
    });
  }
  markPipelineStepDone(fileId, PIPELINE_STEPS.scrape);
}

export function startOrganizeSteps(fileId: number): void {
  pushPipelineStep(fileId, {
    title: PIPELINE_STEPS.mkdir,
    done: false,
    items: [],
  });
  pushPipelineStep(fileId, {
    title: PIPELINE_STEPS.images,
    done: false,
    items: [],
  });
  pushPipelineStep(fileId, {
    title: PIPELINE_STEPS.transfer,
    done: false,
    items: [],
  });
  pushPipelineStep(fileId, {
    title: PIPELINE_STEPS.nfo,
    done: false,
    items: [],
  });
}

export function appendSubtitleSearch(
  fileId: number,
  code: string,
  foundCount: number,
  configured: boolean,
): void {
  const variants = codeSearchVariants(code);
  appendPipelineItem(fileId, PIPELINE_STEPS.mkdir, {
    tone: "ok",
    text: `正在从本地库搜索字幕：[${variants.join(", ")}]`,
  });
  if (!configured) {
    appendPipelineItem(fileId, PIPELINE_STEPS.mkdir, {
      tone: "warn",
      text: "未配置字幕库路径，跳过字幕搜索",
    });
    return;
  }
  appendPipelineItem(fileId, PIPELINE_STEPS.mkdir, {
    tone: foundCount > 0 ? "ok" : "warn",
    text:
      foundCount > 0
        ? `找到 ${foundCount} 个字幕文件并已复制到视频目录`
        : "没有找到字幕文件",
  });
}

export function appendCoverDownload(
  fileId: number,
  url: string,
  local?: string | null,
): void {
  appendPipelineItem(fileId, PIPELINE_STEPS.images, {
    tone: "ok",
    text: `正在下载封面：${url}`,
  });
  if (local) {
    appendPipelineItem(fileId, PIPELINE_STEPS.images, {
      tone: "ok",
      // 刮削阶段只写入 data/covers 缓存；poster/thumb 在整理阶段写入片库目标目录
      text: `封面缓存已保存：'${displayPipelinePath(local)}'`,
    });
    markPipelineStepDone(fileId, PIPELINE_STEPS.images);
  }
}

/** 整理阶段：海报/缩略图写入片库目标目录 */
export function appendOrganizePoster(
  fileId: number,
  posterRel: string,
  thumbRel?: string | null,
): void {
  appendPipelineItem(fileId, PIPELINE_STEPS.images, {
    tone: "ok",
    text: `海报已写入：'${displayPipelinePath(posterRel)}'`,
  });
  if (thumbRel) {
    appendPipelineItem(fileId, PIPELINE_STEPS.images, {
      tone: "ok",
      text: `缩略图已写入：'${displayPipelinePath(thumbRel)}'`,
    });
  }
  markPipelineStepDone(fileId, PIPELINE_STEPS.images);
}

export function appendOrganizeDir(fileId: number, targetRel: string): void {
  appendPipelineItem(fileId, PIPELINE_STEPS.mkdir, {
    tone: "ok",
    text: `成功创建目录：'${displayPipelinePath(targetRel)}'`,
  });
  markPipelineStepDone(fileId, PIPELINE_STEPS.mkdir);
}

export function appendOrganizeTransfer(fileId: number, targetRel: string, mode?: string): void {
  const modeLabel =
    mode === "hardlink"
      ? "硬链接"
      : mode === "softlink"
        ? "软链接"
        : mode === "copy"
          ? "复制"
          : mode === "move"
            ? "移动"
            : "";
  const rel = displayPipelinePath(targetRel);
  const action = modeLabel ? `视频文件${modeLabel}成功` : `成功整理到 '${rel}'`;
  appendPipelineItem(fileId, PIPELINE_STEPS.transfer, {
    tone: "ok",
    text: action,
  });
  if (modeLabel) {
    appendPipelineItem(fileId, PIPELINE_STEPS.transfer, {
      tone: "ok",
      text: `目标路径：'${rel}'`,
    });
  }
  markPipelineStepDone(fileId, PIPELINE_STEPS.transfer);
}

export function appendOrganizeNfo(fileId: number, targetRel: string, fieldSources: Record<string, string>): void {
  appendPipelineItem(fileId, PIPELINE_STEPS.nfo, { tone: "ok", text: "正在写入 NFO 元数据…" });
  const nfoDir = displayPipelinePath(targetRel).replace(/[/\\][^/\\]*$/, "");
  appendPipelineItem(fileId, PIPELINE_STEPS.nfo, {
    tone: "ok",
    text: nfoDir
      ? `成功生成 NFO：'${nfoDir}/movie.nfo'`
      : "成功生成 NFO 元数据",
  });
  const nfoFields = ["title", "plot", "actors", "genres", "studio", "premiered", "runtime", "score"]
    .filter((k) => Boolean(fieldSources[k]))
    .join(", ");
  if (nfoFields) {
    appendPipelineItem(fileId, PIPELINE_STEPS.nfo, { tone: "ok", text: `已写入字段：${nfoFields}` });
  }
  markPipelineStepDone(fileId, PIPELINE_STEPS.nfo);
}

export function appendPipelineFailure(fileId: number, stepTitle: string, item: PipelineLogItem): void {
  appendPipelineItem(fileId, stepTitle, item);
}
