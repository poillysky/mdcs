export const KIND_SHORT_LABELS: Record<string, string> = {
  japan_censored: "有码",
  japan_gravure: "写真",
  japan_uncensored: "无码",
  japan_amateur: "素人",
  fc2: "FC2",
  china: "国产",
  western: "欧美",
};

export const KIND_LABELS: Record<string, string> = {
  japan_censored: "日本有码",
  japan_gravure: "日本写真",
  japan_uncensored: "日本无码",
  japan_amateur: "日本素人",
  fc2: "FC2",
  china: "国产无码",
  western: "欧美无码",
};

export const JOB_MODE_LABELS: Record<string, string> = {
  scan_only: "仅扫描",
  scrape_only: "仅刮削",
  organize_only: "仅整理",
  full: "扫描 + 刮削",
  rescan: "重新扫描",
};

export const JOB_STATUS_LABELS: Record<string, string> = {
  queued: "排队中",
  running: "运行中",
  paused: "已暂停",
  done: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

/** 任务列表展示用（对齐参考 UI「成功」文案） */
export const JOB_TABLE_STATUS_LABELS: Record<string, string> = {
  ...JOB_STATUS_LABELS,
  done: "成功",
};

export const ORGANIZE_MODE_LABELS: Record<string, string> = {
  hardlink: "硬链接",
  softlink: "软链接",
  inplace: "原地整理",
  copy: "复制",
  move: "移动",
};

export const FILE_STATUS_LABELS: Record<string, string> = {
  indexed: "已索引",
  pending: "待处理",
  scraping: "刮削中",
  scraped: "已刮削",
  planned: "已规划",
  organizing: "整理中",
  done: "完成",
  failed: "失败",
  skipped: "跳过",
};

export const TAB_ITEMS = [
  { id: "config" as const, label: "项目配置", icon: "⚙" },
  { id: "sources" as const, label: "数据源配置", icon: "⬡" },
  { id: "jobs" as const, label: "任务队列", icon: "▶" },
  { id: "live" as const, label: "实时日志", icon: "◎" },
];

export function kindLabel(id: string, fallback?: string) {
  return fallback ?? KIND_LABELS[id] ?? id;
}

/** 记录详情字段来源角标展示名 */
export function displayFieldSource(source: string): string {
  if (!source) return "—";
  if (source === "custom") return "自定义";
  if (source === "forum") return "色花堂";
  if (source === "llm") return "翻译";
  if (source.includes("系统") || source === "system") return "系统解析";
  if (source === "sevenmmtv") return "7mmtv";
  if (!source.includes("_") && source) {
    const s = source.replace(/\s+/g, "");
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return source
    .split("_")
    .map((part, i) => (i === 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join("_");
}

export function formatTime(ts: string | number) {
  const d = typeof ts === "number" ? new Date(ts) : new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleString("zh-CN", { hour12: false });
}
