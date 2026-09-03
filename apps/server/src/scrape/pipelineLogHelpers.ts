import type { ScrapeMeta, SourceId } from "./types.js";
import {
  appendPipelineItem,
  getPipeline,
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

/** 数据源无数据、HTTP 失败等 → 黄灯（非超时/中断） */
export function isNonCriticalSourceError(error?: string): boolean {
  return !isCriticalSourceError(error);
}

/** 单源超时/中断等基础设施故障 → 红灯 */
export function isCriticalSourceError(error?: string): boolean {
  const err = String(error || "").trim().toLowerCase();
  if (!err) return false;
  const patterns = ["timeout", "timed out", "time out", "abort", "cancelled", "canceled"];
  return patterns.some((p) => err.includes(p));
}

export function sourceRunLogTone(
  run: { ok: boolean; error?: string; channel: "fast" | "slow" },
): PipelineLogTone {
  if (run.ok) return "ok";
  if (isCriticalSourceError(run.error)) return "fail";
  return "warn";
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

export function appendScrapeCacheHitLog(fileId: number, meta: ScrapeMeta): void {
  const scrapedMs = meta.scrapedAt ? Date.parse(meta.scrapedAt) : NaN;
  const age =
    Number.isFinite(scrapedMs) && scrapedMs > 0
      ? `（缓存 ${new Date(scrapedMs).toLocaleString("zh-CN")}）`
      : "";
  appendPipelineItem(fileId, PIPELINE_STEPS.scrape, {
    tone: "info",
    text: `使用本地元数据缓存，跳过网络刮削${age}`,
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

/** 刮削阶段已写入步骤后，补登记整理阶段四步（避免 steps.length===0 误判） */
export function ensureOrganizePipelineSteps(fileId: number): void {
  const cur = getPipeline(fileId);
  if (!cur?.active) return;
  if (cur.steps.some((s) => s.title === PIPELINE_STEPS.mkdir)) return;
  startOrganizeSteps(fileId);
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
  } else {
    appendPipelineItem(fileId, PIPELINE_STEPS.images, {
      tone: "warn",
      text: "未下载到封面",
    });
  }
  markPipelineStepDone(fileId, PIPELINE_STEPS.images);
}

/** 整理阶段：海报/缩略图写入片库目标目录 */
export function appendOrganizePoster(
  fileId: number,
  posterRel: string | null,
  thumbRel?: string | null,
): void {
  if (posterRel) {
    appendPipelineItem(fileId, PIPELINE_STEPS.images, {
      tone: "ok",
      text: `海报已写入：'${displayPipelinePath(posterRel)}'`,
    });
  }
  if (thumbRel) {
    appendPipelineItem(fileId, PIPELINE_STEPS.images, {
      tone: "ok",
      text: `缩略图已写入：'${displayPipelinePath(thumbRel)}'`,
    });
  }
  if (posterRel || thumbRel) {
    markPipelineStepDone(fileId, PIPELINE_STEPS.images);
  }
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

/** 重刮：跳过目录/转移，保留海报与 NFO 写入 */
export function skipOrganizeTransferSteps(fileId: number): void {
  appendPipelineItem(fileId, PIPELINE_STEPS.mkdir, {
    tone: "info",
    text: "重刮跳过目录创建（请用「重新整理」生成片库目录）",
  });
  markPipelineStepDone(fileId, PIPELINE_STEPS.mkdir);

  appendPipelineItem(fileId, PIPELINE_STEPS.transfer, {
    tone: "info",
    text: "重刮跳过文件转移（请用「重新整理」）",
  });
  markPipelineStepDone(fileId, PIPELINE_STEPS.transfer);
}

export function appendOrganizeNfo(
  fileId: number,
  targetRel: string,
  fieldSources: Record<string, string>,
  nfoAbs?: string,
): void {
  appendPipelineItem(fileId, PIPELINE_STEPS.nfo, { tone: "ok", text: "正在写入 NFO 元数据…" });
  const nfoDir = displayPipelinePath(targetRel).replace(/[/\\][^/\\]*$/, "");
  const nfoName = nfoAbs ? path.basename(nfoAbs) : "movie.nfo";
  appendPipelineItem(fileId, PIPELINE_STEPS.nfo, {
    tone: "ok",
    text: nfoDir ? `成功生成 NFO：'${nfoDir}/${nfoName}'` : "成功生成 NFO 元数据",
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
