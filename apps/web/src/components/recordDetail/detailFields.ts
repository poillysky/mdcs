import {
  resolveCoverUrl,
  resolveRemotePosterUrl,
  resolvePublishNumber,
} from "../../lib/metaDisplay";
import type { FileRow, ScrapeMetaView } from "../../types";
import type { DetailField } from "./types";

export function formatFieldValue(v: unknown): string {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  return String(v);
}

export function formatRuntime(minutes?: number | null): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return "—";
  return `${minutes}分钟`;
}

export function formatRating(meta: ScrapeMetaView | null): string | null {
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

export function mosaicLabel(raw?: string | null): string {
  if (!raw) return "—";
  const map: Record<string, string> = {
    censored: "有码",
    uncensored: "无码",
    cracked: "破解",
    leak: "流出",
  };
  return map[raw] ?? raw;
}

export function sourceBadgeClass(source: string): string {
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

export function fullNavLabel(f: FileRow): string {
  const code = String(f.code || "").trim();
  const title = String(f.titleZh || f.title || "").trim();
  if (code && title && title !== code) {
    if (title.startsWith(`${code} `) || title.startsWith(`${code}-`)) return title;
    return `${code} ${title}`;
  }
  return title || code || f.file_name || `#${f.id}`;
}

export function shortNavLabel(f: FileRow): string {
  const text = fullNavLabel(f);
  return text.length > NAV_LABEL_MAX ? `${text.slice(0, NAV_LABEL_MAX)}…` : text;
}

/** 从文件名/路径粗检分辨率（详细数据展示；无则 —） */
export function detectResolutionLabel(file: FileRow): string | null {
  const hay = `${file.file_name || ""} ${file.source_path || ""} ${file.target_path || ""}`;
  if (/\b8K\b|4320p/i.test(hay)) return "8K";
  if (/\b4K\b|2160p|UHD/i.test(hay)) return "4K";
  if (/\b1080p?\b|FHD/i.test(hay)) return "1080P";
  if (/\b720p?\b|HD/i.test(hay)) return "720P";
  return null;
}

export function buildDetailFields(file: FileRow, meta: ScrapeMetaView | null): DetailField[] {
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
