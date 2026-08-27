import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import {
  ArrowPathIcon,
  CheckIcon,
  PencilSquareIcon,
  PhotoIcon,
  StarIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";
import { useEffect, useMemo, useRef, useState } from "react";
import { LazyCover } from "./LazyCover";
import { CoverCropModal } from "./CoverCropModal";
import { RecordMetaEditModal } from "./RecordMetaEditModal";
import {
  RecordTaskActionModal,
  type RecordTaskActionOptions,
} from "./RecordTaskActionModal";
import { displayFieldSource, FILE_STATUS_LABELS, kindLabel } from "../lib/labels";
import {
  appendAssetCacheBust,
  resolveCoverImageSrc,
  resolveCoverUrl,
  resolveGalleryImageSrcs,
  resolveRemotePosterUrl,
  resolvePublishNumber,
} from "../lib/metaDisplay";
import { displayRelativePath, looksAbsolutePath } from "../lib/paths";
import { fetchFileGallery, fetchFilePipelineLog, type PipelineRunKind, type PipelineRunView } from "../api";
import type { FileRow, ScrapeMetaView } from "../types";

type DetailField = {
  key: string;
  label: string;
  value: unknown;
  sourceKey?: string;
  multiline?: boolean;
  isTags?: boolean;
  isLink?: boolean;
};

type LogTone = "ok" | "warn" | "info" | "fail";

type LogItem = { tone: LogTone; text: string };

type LogStep = { title: string; done: boolean; items: LogItem[] };

type LogRunOption = {
  id: string;
  kind: PipelineRunKind;
  at: number;
  steps: LogStep[];
};

const PIPELINE_KIND_LABELS: Record<PipelineRunKind, string> = {
  initial: "首次",
  retry: "重试",
  rescrape: "重新刮削",
  reorganize: "重新整理",
};

function formatPipelineAt(at: number): string {
  if (!Number.isFinite(at) || at <= 0) return "";
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}

function pipelineRunLabel(kind: PipelineRunKind, at: number): string {
  const date = formatPipelineAt(at);
  return date ? `${PIPELINE_KIND_LABELS[kind]} - ${date}` : PIPELINE_KIND_LABELS[kind];
}

/** 下拉：首次置顶，其余按时间正序（最旧→最新） */
function sortLogRunsChronological<T extends { kind: PipelineRunKind; at: number }>(runs: T[]): T[] {
  return [...runs].sort((a, b) => {
    if (a.kind === "initial" && b.kind !== "initial") return -1;
    if (b.kind === "initial" && a.kind !== "initial") return 1;
    return a.at - b.at;
  });
}

function pickLatestLogRun<T extends { at: number }>(runs: T[]): T | undefined {
  if (!runs.length) return undefined;
  return runs.reduce((best, r) => (r.at >= best.at ? r : best));
}

function parseScrapedAtMs(file: FileRow, meta: ScrapeMetaView | null): number {
  if (typeof file.scraped_at === "number" && file.scraped_at > 0) return file.scraped_at;
  if (meta?.scrapedAt) {
    const t = Date.parse(meta.scrapedAt);
    if (Number.isFinite(t)) return t;
  }
  if (typeof file.organized_at === "number" && file.organized_at > 0) return file.organized_at;
  return Date.now();
}

/** 归档日志里旧绝对路径 → 相对路径；旧文案「封面已保存」→「封面缓存已保存」 */
function sanitizePipelineLogText(text: string): string {
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

function toLogRunOption(run: PipelineRunView): LogRunOption {
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

type Props = {
  file: FileRow | null;
  meta: ScrapeMetaView | null;
  loading: boolean;
  detailId: number;
  listItems: FileRow[];
  highlightSource: string | null;
  onHighlightSource: (source: string | null) => void;
  onClose: () => void;
  onNavigate: (id: number) => void;
  onTaskAction: (opts: RecordTaskActionOptions) => void | Promise<void>;
  onDelete: () => void;
  onMetaSave?: (
    fields: Record<string, { value: string; source: string }>,
  ) => void | Promise<void>;
  onMetaRefresh?: (meta: ScrapeMetaView) => void;
  onFileRefresh?: () => void | Promise<void>;
};

function formatFieldValue(v: unknown): string {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  return String(v);
}

function formatRuntime(minutes?: number | null): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return "—";
  return `${minutes}分钟`;
}

function formatRating(meta: ScrapeMetaView | null): string | null {
  if (!meta) return null;
  if (meta.ratingValue != null) {
    const n = Number(meta.ratingValue);
    return Number.isFinite(n) ? n.toFixed(2).replace(/\.?0+$/, "") : String(meta.ratingValue);
  }
  if (meta.score != null) {
    const n = Number(meta.score);
    return Number.isFinite(n) ? n.toFixed(2).replace(/\.?0+$/, "") : String(meta.score);
  }
  return null;
}

function mosaicLabel(raw?: string | null): string {
  if (!raw) return "—";
  const map: Record<string, string> = {
    censored: "有码",
    uncensored: "无码",
    cracked: "破解",
    leak: "流出",
  };
  return map[raw] ?? raw;
}

function sourceBadgeClass(source: string): string {
  const s = source.toLowerCase();
  if (!source || s === "custom" || s === "自定义") return "rd-src rd-src--custom";
  if (s === "dmm") return "rd-src rd-src--dmm";
  if (s.includes("airav")) return "rd-src rd-src--airav";
  if (s.includes("javbus")) return "rd-src rd-src--javbus";
  if (s.includes("sevenmmtv") || s === "7mmtv") return "rd-src rd-src--mmtv";
  if (s.includes("iqqtv")) return "rd-src rd-src--iqqtv";
  if (s.includes("freejav")) return "rd-src rd-src--freejav";
  if (s.includes("miss_av") || s.includes("missav")) return "rd-src rd-src--miss";
  if (s.includes("jav321") || s.includes("mgstage") || s.includes("javlibrary") || s.includes("libredmm")) {
    return "rd-src rd-src--jav";
  }
  if (s.includes("系统") || s === "system") return "rd-src rd-src--sys";
  if (s.includes("fc2")) return "rd-src rd-src--fc2";
  if (s === "forum") return "rd-src rd-src--custom";
  return "rd-src";
}

const NAV_LABEL_MAX = 28;

function fullNavLabel(f: FileRow): string {
  const code = String(f.code || "").trim();
  const title = String(f.titleZh || f.title || "").trim();
  if (code && title && title !== code) {
    if (title.startsWith(`${code} `) || title.startsWith(`${code}-`)) return title;
    return `${code} ${title}`;
  }
  return title || code || f.file_name || `#${f.id}`;
}

function shortNavLabel(f: FileRow): string {
  const text = fullNavLabel(f);
  return text.length > NAV_LABEL_MAX ? `${text.slice(0, NAV_LABEL_MAX)}…` : text;
}

/** 从文件名/路径粗检分辨率（详细数据展示；无则 —） */
function detectResolutionLabel(file: FileRow): string | null {
  const hay = `${file.file_name || ""} ${file.source_path || ""} ${file.target_path || ""}`;
  if (/\b8K\b|4320p/i.test(hay)) return "8K";
  if (/\b4K\b|2160p|UHD/i.test(hay)) return "4K";
  if (/\b1080p?\b|FHD/i.test(hay)) return "1080P";
  if (/\b720p?\b|HD/i.test(hay)) return "720P";
  return null;
}

function buildDetailFields(file: FileRow, meta: ScrapeMetaView | null): DetailField[] {
  const rating = formatRating(meta);
  // 封面优先大图 pl；海报优先缩略图 ps（对齐参考 UI）
  const coverUrl = resolveRemotePosterUrl(meta, file) || resolveCoverUrl(meta, file);
  const posterUrl = resolveCoverUrl(meta, file);
  const runtime =
    meta?.runtime != null && Number.isFinite(meta.runtime) && meta.runtime > 0
      ? String(meta.runtime)
      : null;
  return [
    { key: "code", label: "番号", value: meta?.code || file.code, sourceKey: "code" },
    {
      key: "publishNumber",
      label: "发行码",
      value: resolvePublishNumber(meta, file),
      sourceKey: "publishNumber",
    },
    { key: "title", label: "标题", value: meta?.titleZh || meta?.title, sourceKey: "titleZh" },
    { key: "originaltitle", label: "原标题", value: meta?.title, sourceKey: "title" },
    { key: "actors", label: "演员", value: meta?.actors, sourceKey: "actors" },
    { key: "plot", label: "简介", value: meta?.plot, sourceKey: "plot", multiline: true },
    { key: "genres", label: "标签", value: meta?.genres, sourceKey: "genres", isTags: true },
    {
      key: "coverUrl",
      label: "封面",
      value: coverUrl || null,
      sourceKey: "cover",
      isLink: true,
    },
    {
      key: "poster",
      label: "海报",
      value: posterUrl || null,
      sourceKey: "cover",
      isLink: true,
    },
    { key: "premiered", label: "发行日期", value: meta?.premiered, sourceKey: "premiered" },
    { key: "runtime", label: "时长", value: runtime, sourceKey: "runtime" },
    { key: "directors", label: "导演", value: meta?.directors, sourceKey: "directors" },
    { key: "studio", label: "制作", value: meta?.studio, sourceKey: "studio" },
    { key: "series", label: "系列", value: meta?.series, sourceKey: "series" },
    { key: "score", label: "评分", value: rating, sourceKey: "score" },
    { key: "votes", label: "想看人数", value: meta?.votes, sourceKey: "votes" },
    { key: "translateEngine", label: "翻译引擎", value: null },
    {
      key: "mosaic",
      label: "马赛克",
      value: mosaicLabel(meta?.mosaic || file.mosaic),
      sourceKey: "mosaic",
    },
    { key: "resolution", label: "分辨率", value: detectResolutionLabel(file) },
  ];
}

function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0.000s";
  return `${(ms / 1000).toFixed(3)}s`;
}

function codeSearchVariants(code: string): string[] {
  const raw = String(code || "").trim();
  const compact = raw.replace(/[-_\s]/g, "");
  return [...new Set([raw, compact].filter(Boolean))];
}

function isNonCriticalSourceError(error?: string): boolean {
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

function sourceRunTone(
  ok: boolean,
  error?: string,
): LogTone {
  if (ok) return "ok";
  return isNonCriticalSourceError(error) ? "warn" : "fail";
}

function buildLogSteps(file: FileRow, meta: ScrapeMetaView | null): LogStep[] {
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

function FieldSourceBadge({
  source,
  active,
  onClick,
}: {
  source: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${sourceBadgeClass(source)}${active ? " is-active" : ""}`}
      onClick={onClick}
    >
      {displayFieldSource(source)}
    </button>
  );
}

export function RecordDetailView({
  file,
  meta,
  loading,
  detailId,
  listItems,
  highlightSource,
  onHighlightSource,
  onClose,
  onNavigate,
  onTaskAction,
  onDelete,
  onMetaSave,
  onMetaRefresh,
  onFileRefresh,
}: Props) {
  const galleryRef = useRef<HTMLElement | null>(null);
  const [metaEditOpen, setMetaEditOpen] = useState(false);
  const [coverCropOpen, setCoverCropOpen] = useState(false);
  const [coverVersion, setCoverVersion] = useState(0);
  const [taskActionOpen, setTaskActionOpen] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState<LogStep[] | null>(null);
  const [pipelineRuns, setPipelineRuns] = useState<LogRunOption[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollGenRef = useRef(0);
  const pipelineWaitRefreshRef = useRef(false);

  const stopPipelinePoll = () => {
    pollGenRef.current += 1;
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const applyPipelineLog = (
    p: Awaited<ReturnType<typeof fetchFilePipelineLog>>,
    opts?: { keepSelectedRun?: boolean },
  ) => {
    const runs = (p.runs ?? []).map(toLogRunOption);
    setPipelineRuns(runs);
    // 仅 active 时保持「进行中」；结束后即使内存里还有 steps 也退出
    if (p.active) {
      const liveSteps = (p.steps ?? []).map((step) => ({
        title: step.title,
        done: step.done,
        items: (step.items ?? []).map((item) => ({
          tone: item.tone,
          text: sanitizePipelineLogText(item.text),
        })),
      }));
      setPipelineSteps(liveSteps.length ? liveSteps : []);
      setSelectedRunId("__live__");
      return true;
    }
    setPipelineSteps(null);
    if (runs.length) {
      const latest = pickLatestLogRun(runs)!;
      if (opts?.keepSelectedRun) {
        setSelectedRunId((prev) =>
          prev && prev !== "__live__" && runs.some((r) => r.id === prev) ? prev : latest.id,
        );
      } else {
        setSelectedRunId(latest.id);
      }
    } else {
      setSelectedRunId("");
    }
    return false;
  };

  const startPipelinePoll = (fileId: number) => {
    stopPipelinePoll();
    const gen = pollGenRef.current;
    pollRef.current = setInterval(() => {
      void fetchFilePipelineLog(fileId)
        .then((p) => {
          if (gen !== pollGenRef.current) return;
          const stillActive = applyPipelineLog(p);
          if (!stillActive) stopPipelinePoll();
        })
        .catch(() => {
          /* 轮询静默失败 */
        });
    }, 400);
  };

  useEffect(() => {
    setMetaEditOpen(false);
    setCoverCropOpen(false);
    setCoverVersion(0);
    setTaskActionOpen(false);
    setPipelineSteps(null);
    setPipelineRuns([]);
    setSelectedRunId("");
    setGalleryImages([]);
    stopPipelinePoll();
  }, [detailId]);

  useEffect(() => {
    if (pipelineWaitRefreshRef.current && pipelineSteps === null && !pollRef.current) {
      pipelineWaitRefreshRef.current = false;
    }
  }, [meta, file?.status, file?.organized_at, file?.scraped_at, pipelineSteps]);

  useEffect(
    () => () => {
      stopPipelinePoll();
    },
    [],
  );

  useEffect(() => {
    if (!file?.id) {
      setPipelineRuns([]);
      setSelectedRunId("");
      return;
    }
    let cancelled = false;
    void fetchFilePipelineLog(file.id)
      .then((p) => {
        if (cancelled) return;
        const stillActive = applyPipelineLog(p, { keepSelectedRun: true });
        if (stillActive) startPipelinePoll(file.id);
        else stopPipelinePoll();
      })
      .catch(() => {
        if (!cancelled) setPipelineRuns([]);
      });
    return () => {
      cancelled = true;
    };
  }, [file?.id, file?.scraped_at, file?.organized_at, meta?.scrapedAt]);

  const plot = meta?.plot || meta?.originalPlot || "";

  const index = listItems.findIndex((f) => f.id === detailId);
  const prevItem = index > 0 ? listItems[index - 1] : null;
  const nextItem = index >= 0 && index < listItems.length - 1 ? listItems[index + 1] : null;

  const displayTitle = meta?.titleZh || meta?.title || file?.title || file?.code || file?.file_name || "—";
  const displayCode = meta?.code || file?.code || "";
  const heroTitle =
    displayCode && displayTitle !== displayCode
      ? `${displayCode} ${displayTitle}`
      : displayTitle;
  const rating = formatRating(meta);
  const actors = meta?.actors ?? (file?.actors ? file.actors.split(/[,，]/).map((s) => s.trim()) : []);
  const genres = meta?.genres ?? [];
  const cover = resolveCoverImageSrc(meta, file);
  const coverDisplay =
    cover && coverVersion > 0
      ? `${cover}${cover.includes("?") ? "&" : "?"}cv=${coverVersion}`
      : cover;

  // 固定字段表全量展示（空值显示 —），避免漏番号等标识字段
  const detailFields = useMemo(
    () => (file ? buildDetailFields(file, meta) : []),
    [file, meta],
  );

  const studio = meta?.studio || meta?.publisher || "";
  const series = String(meta?.series || "").trim();
  const directors = (meta?.directors ?? []).filter(Boolean);
  const directorText = directors.length ? directors.join("、") : "";

  useEffect(() => {
    if (!file) {
      setGalleryImages([]);
      return;
    }
    const fallback = resolveGalleryImageSrcs(meta, file);
    if (!file.id) {
      setGalleryImages(fallback);
      return;
    }
    let cancelled = false;
    void fetchFileGallery(file.id)
      .then((data) => {
        if (cancelled) return;
        const urls = (data.items ?? [])
          .map((item) => item.url)
          .filter(Boolean)
          .map((url) => appendAssetCacheBust(url, file, meta));
        setGalleryImages(urls.length ? urls : fallback);
      })
      .catch(() => {
        if (!cancelled) setGalleryImages(fallback);
      });
    return () => {
      cancelled = true;
    };
  }, [file, meta, file?.id, file?.scraped_at, file?.organized_at, file?.file_mtime, meta?.scrapedAt]);

  const logRunOptions = useMemo((): LogRunOption[] => {
    if (!file) return [];
    let options = [...pipelineRuns];
    const hasInitial = options.some((r) => r.kind === "initial");
    if (!hasInitial) {
      if (options.length) {
        // 无首次归档时：用时间最早的一条充当首次，勿用最新 scraped_at
        const oldest = options.reduce((best, r) => (r.at < best.at ? r : best));
        options = options.map((r) =>
          r.id === oldest.id ? { ...r, kind: "initial" as const } : r,
        );
      } else {
        options.push({
          id: `initial-${file.id}`,
          kind: "initial",
          at: parseScrapedAtMs(file, meta),
          steps: buildLogSteps(file, meta),
        });
      }
    }
    return sortLogRunsChronological(options);
  }, [file, meta, pipelineRuns]);

  const latestLogRun = useMemo(
    () => pickLatestLogRun(logRunOptions),
    [logRunOptions],
  );

  const selectedLogRun = useMemo(() => {
    if (!logRunOptions.length) return null;
    return logRunOptions.find((r) => r.id === selectedRunId) ?? latestLogRun ?? null;
  }, [logRunOptions, selectedRunId, latestLogRun]);

  const logSteps = useMemo(() => {
    if (pipelineSteps !== null) return pipelineSteps;
    return selectedLogRun?.steps ?? (file ? buildLogSteps(file, meta) : []);
  }, [file, meta, pipelineSteps, selectedLogRun]);

  useEffect(() => {
    if (pipelineSteps !== null) return;
    if (!selectedRunId && latestLogRun) {
      setSelectedRunId(latestLogRun.id);
    } else if (
      selectedRunId &&
      selectedRunId !== "__live__" &&
      logRunOptions.length &&
      !logRunOptions.some((r) => r.id === selectedRunId)
    ) {
      setSelectedRunId(latestLogRun?.id ?? "");
    }
  }, [logRunOptions, selectedRunId, pipelineSteps, latestLogRun]);

  const resultBadge = useMemo(() => {
    const status = file?.status ?? "";
    if (status === "failed" || meta?.ok === false) {
      return { label: "失败", className: "rd-status rd-status--fail" };
    }
    if (status === "done" || status === "scraped") {
      return { label: "成功", className: "rd-status rd-status--ok" };
    }
    if (status === "skipped") {
      return { label: "取消", className: "rd-status rd-status--muted" };
    }
    if (status === "scraping" || status === "organizing") {
      return { label: "处理中", className: "rd-status rd-status--pending" };
    }
    if (status === "pending" || status === "planned") {
      return { label: "等待中", className: "rd-status rd-status--pending" };
    }
    return {
      label: (FILE_STATUS_LABELS[status] ?? status) || "—",
      className: "rd-status rd-status--pending",
    };
  }, [file?.status, meta?.ok]);

  if (loading && !file) {
    return (
      <div className="record-detail">
        <div className="record-detail-nav">
          <button type="button" className="record-detail-nav-back" onClick={onClose}>
            返回列表
          </button>
        </div>
        <div className="empty-block">加载详情…</div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="record-detail">
        <div className="record-detail-nav">
          <button type="button" className="record-detail-nav-back" onClick={onClose}>
            返回列表
          </button>
        </div>
        <div className="empty-block">记录不存在</div>
      </div>
    );
  }

  const fs = meta?.fieldSources ?? {};

  return (
    <div className="record-detail">
      <nav className="record-detail-nav" aria-label="详情导航">
        <button
          type="button"
          className="record-detail-nav-side"
          disabled={!prevItem}
          title={prevItem ? fullNavLabel(prevItem) : undefined}
          onClick={() => prevItem && onNavigate(prevItem.id)}
        >
          <ChevronLeftIcon aria-hidden />
          <span>{prevItem ? shortNavLabel(prevItem) : "—"}</span>
        </button>
        <button type="button" className="record-detail-nav-back" onClick={onClose}>
          返回列表
        </button>
        <button
          type="button"
          className="record-detail-nav-side record-detail-nav-side--next"
          disabled={!nextItem}
          title={nextItem ? fullNavLabel(nextItem) : undefined}
          onClick={() => nextItem && onNavigate(nextItem.id)}
        >
          <span>{nextItem ? shortNavLabel(nextItem) : "—"}</span>
          <ChevronRightIcon aria-hidden />
        </button>
      </nav>

      <section className="record-detail-top">
        <aside className="record-detail-aside">
          <div className="record-detail-poster">
            <LazyCover src={coverDisplay} alt={heroTitle} className="record-detail-poster-img" />
          </div>
        </aside>

        <div className="record-detail-hero-main">
          <h1 className="record-detail-title">{heroTitle}</h1>
          <div className="record-detail-title-tools">
            <span className={resultBadge.className}>{resultBadge.label}</span>
            <div className="record-detail-actions">
              <button
                type="button"
                className="record-detail-icon-btn"
                title="编辑元数据"
                onClick={() => setMetaEditOpen(true)}
              >
                <PencilSquareIcon aria-hidden />
              </button>
              <button
                type="button"
                className="record-detail-icon-btn"
                title="封面裁剪"
                onClick={() => setCoverCropOpen(true)}
              >
                <PhotoIcon aria-hidden />
              </button>
              <button type="button" className="record-detail-icon-btn" title="删除" onClick={onDelete}>
                <TrashIcon aria-hidden />
              </button>
              <button
                type="button"
                className="record-detail-icon-btn"
                title="任务操作"
                onClick={() => setTaskActionOpen(true)}
              >
                <ArrowPathIcon aria-hidden />
              </button>
            </div>
          </div>

          <div className="record-detail-meta-row">
            {rating ? (
              <span className="record-detail-rating">
                <StarIcon className="record-detail-star" aria-hidden />
                {rating}
              </span>
            ) : null}
            <span className="record-detail-actors">
              {actors.length ? (
                actors.map((name, i) => (
                  <span key={name}>
                    {i > 0 ? "、" : ""}
                    <button type="button" className="record-detail-actor-link">
                      {name}
                    </button>
                  </span>
                ))
              ) : (
                <span className="record-detail-actors-unknown">未知演员</span>
              )}
            </span>
            {meta?.premiered ? <span>{meta.premiered}</span> : null}
            {meta?.runtime ? <span>{formatRuntime(meta.runtime)}</span> : null}
          </div>

          {genres.length ? (
            <div className="record-detail-tags">
              {genres.map((tag) => (
                <span key={tag} className="record-detail-tag">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          {plot ? (
            <div className="record-detail-plot-wrap">
              <p className="record-detail-plot">{plot}</p>
            </div>
          ) : null}

          {directorText || studio || series ? (
            <p className="record-detail-credits">
              {directorText ? <span className="record-detail-credit">导演: {directorText}</span> : null}
              {directorText && (studio || series) ? (
                <span className="record-detail-credit-dot" aria-hidden>
                  ·
                </span>
              ) : null}
              {studio ? <span className="record-detail-credit">制作: {studio}</span> : null}
              {studio && series ? (
                <span className="record-detail-credit-dot" aria-hidden>
                  ·
                </span>
              ) : null}
              {series ? <span className="record-detail-credit">系列: {series}</span> : null}
            </p>
          ) : null}
        </div>
      </section>

      {galleryImages.length ? (
        <section className="record-detail-gallery" ref={galleryRef}>
          <h2 className="record-detail-gallery-title">画廊</h2>
          <div className="record-detail-gallery-track">
            {galleryImages.map((url) => (
              <a
                key={url}
                className="record-detail-gallery-item"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <LazyCover src={url} alt="" className="record-detail-gallery-img" />
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <div className="record-detail-grid">
        <section className="record-detail-panel">
          <h2 className="record-detail-section-title">详细数据</h2>
          <div className="record-detail-table">
            {detailFields.length ? (
              detailFields.map((row) => {
                const hasCode = Boolean(meta?.code || file?.code);
                const source =
                  (row.sourceKey && fs[row.sourceKey]) ||
                  (row.key === "code" && hasCode ? "系统解析" : undefined) ||
                  (row.key === "mosaic" && !fs.mosaic
                    ? mosaicLabel(meta?.mosaic || file?.mosaic) !== "—"
                      ? "系统解析"
                      : undefined
                    : undefined);
                const val = row.value;
                const text = formatFieldValue(val);
                return (
                  <div
                    key={row.key}
                    className={`record-detail-row${row.multiline ? " is-multiline" : ""}`}
                  >
                    <div className="record-detail-row-label">{row.label}</div>
                    <div
                      className={`record-detail-row-value${row.multiline ? " is-multiline" : ""}`}
                    >
                      {row.isTags && Array.isArray(val) && val.length ? (
                        <div className="record-detail-inline-tags">
                          {val.map((tag) => (
                            <span key={String(tag)} className="record-detail-tag sm">
                              {String(tag)}
                            </span>
                          ))}
                        </div>
                      ) : row.key === "actors" && Array.isArray(val) && val.length ? (
                        <span>{val.map(String).join("、")}</span>
                      ) : row.isLink && typeof val === "string" && text !== "—" ? (
                        <a
                          href={val}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="record-detail-link record-detail-url"
                        >
                          {val}
                        </a>
                      ) : (
                        text
                      )}
                    </div>
                    <div className="record-detail-row-src">
                      {source ? (
                        <FieldSourceBadge
                          source={source}
                          active={highlightSource === source}
                          onClick={() =>
                            onHighlightSource(highlightSource === source ? null : source)
                          }
                        />
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="hint">尚无刮削缓存</p>
            )}
          </div>
        </section>

        <section className="record-detail-panel">
          <h2 className="record-detail-section-title">刮削日志</h2>
          {logRunOptions.length > 0 ? (
            <div className="record-detail-log-select-wrap">
              <select
                className="record-detail-log-select"
                aria-label="选择日志记录"
                value={
                  pipelineSteps !== null
                    ? "__live__"
                    : selectedLogRun?.id ||
                      (selectedRunId !== "__live__" ? selectedRunId : "") ||
                      latestLogRun?.id ||
                      ""
                }
                disabled={pipelineSteps !== null}
                onChange={(e) => {
                  const id = e.target.value;
                  if (id === "__live__") return;
                  setSelectedRunId(id);
                  setPipelineSteps(null);
                }}
              >
                {pipelineSteps !== null ? (
                  <option value="__live__">进行中…</option>
                ) : null}
                {logRunOptions.map((run) => (
                  <option key={run.id} value={run.id}>
                    {pipelineRunLabel(run.kind, run.at)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="record-detail-log">
            {logSteps.length === 0 && pipelineSteps !== null ? (
              <p className="hint">任务进行中，等待日志…</p>
            ) : null}
            {logSteps.map((step) => (
              <div key={step.title} className={`record-detail-log-step${step.done ? " is-done" : ""}`}>
                <div className="record-detail-log-head">
                  <span className="record-detail-log-node" aria-hidden>
                    {step.done ? <CheckIcon /> : null}
                  </span>
                  <h3>{step.title}</h3>
                </div>
                <ul className="record-detail-log-items">
                  {step.items.map((item, i) => {
                    const highlighted =
                      Boolean(highlightSource) &&
                      item.text.toLowerCase().includes(`<${highlightSource!.toLowerCase()}>`);
                    return (
                      <li
                        key={i}
                        className={`record-detail-log-item tone-${item.tone}${highlighted ? " is-highlight" : ""}`}
                      >
                        {item.text}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>

      <RecordMetaEditModal
        open={metaEditOpen}
        file={file}
        meta={meta}
        onClose={() => setMetaEditOpen(false)}
        onSave={onMetaSave}
        onMetaRefresh={onMetaRefresh}
      />

      <CoverCropModal
        open={coverCropOpen}
        file={file}
        onClose={() => setCoverCropOpen(false)}
        onDone={(updatedAt) => {
          setCoverVersion(updatedAt);
          void onFileRefresh?.();
        }}
      />

      <RecordTaskActionModal
        open={taskActionOpen}
        file={file}
        onClose={() => setTaskActionOpen(false)}
        onConfirm={(opts) => {
          setTaskActionOpen(false);
          setPipelineSteps([]);
          setSelectedRunId("__live__");
          startPipelinePoll(file.id);
          void (async () => {
            try {
              await onTaskAction(opts);
            } finally {
              stopPipelinePoll();
              try {
                const p = await fetchFilePipelineLog(file.id);
                if (applyPipelineLog(p)) startPipelinePoll(file.id);
              } catch {
                setPipelineSteps(null);
              }
              pipelineWaitRefreshRef.current = true;
            }
          })();
        }}
      />
    </div>
  );
}
