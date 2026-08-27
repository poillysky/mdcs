import type { ToastLevel } from "./notify";

const TITLE: Record<ToastLevel, string> = {
  ok: "成功",
  warn: "注意",
  error: "失败",
  info: "提示",
};

/** API code → 用户文案（对齐 UI-COPY §12） */
const CODE_MESSAGES: Record<string, string> = {
  not_found: "接口不存在",
  internal_error: "服务器内部错误，请稍后重试",
  job_not_found: "任务不存在",
  job_create_invalid: "无法创建任务，请检查分区与模式",
  scan_failed: "扫描失败，请检查来源目录是否存在",
  bad_request: "请求无效",
  kind_not_found: "未知分区",
  kind_update_invalid: "分区配置无效，请检查字段",
  kind_unavailable: "分区不可用",
  path_not_allowed: "路径不在允许范围内，请选择已配置的来源或输出目录",
  unauthorized: "未授权：请配置正确的 API Token",
  scrape_disabled: "在线刮削已关闭，请先在数据源页开启",
  missing_code: "请填写番号",
  invalid_kind: "分区无效",
  no_cache: "没有找到该番号的缓存",
  config_invalid: "配置格式无效，请检查后重试",
  invalid_json: "服务器返回了无效响应",
};

const EXACT: Record<string, string> = {
  "Not Found": "接口不存在",
  请求失败: "请求失败",
  任务不存在: "任务不存在",
  无缓存: "没有找到该番号的缓存",
  "刮削已禁用": "在线刮削已关闭，请先在数据源页开启",
  "缺少 code": "请填写番号",
  "Failed to fetch": "无法连接后端服务，请确认服务已启动",
  "NetworkError when attempting to fetch resource.":
    "网络异常，无法连接后端服务",
  所有源均未返回有效元数据: "所有数据源都没有返回有效信息",
  源暂未实现: "该数据源尚未实现",
};

const PATTERNS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^无效 kind[:：]?\s*(.*)$/i, (m) => `分区无效：${m[1] || "未知"}`],
  [/^未知分区[:：]?\s*(.*)$/i, (m) => `未知分区：${m[1] || ""}`],
  [/^分区不可用[:：]?\s*(.*)$/i, (m) => `分区不可用：${m[1] || ""}`],
  [/^HTTP\s+(\d+)\s+(.+)$/i, (m) => `远程站点返回 ${m[1]}，无法访问 ${m[2]}`],
  [/^load failed$/i, () => "网络加载失败"],
  [/^failed to fetch$/i, () => "无法连接后端服务，请确认服务已启动"],
  [/ECONNREFUSED/i, () => "后端拒绝连接，请确认 9210 端口已启动"],
  [/timeout/i, () => "请求超时，请检查网络或代理"],
  [/ENOSPC|no space left/i, () => "磁盘空间不足，请清理后重试整理或封面下载"],
  [/EACCES|permission denied/i, () => "没有写入权限，请检查目录权限"],
  [/FlareSolverr/i, () => "FlareSolverr 不可用，请检查地址或改用直连/代理源"],
  [/不在允许范围内/, () => CODE_MESSAGES.path_not_allowed],
  [/unauthorized/i, () => "未授权：请配置正确的 API Token"],
];

export function toastTitle(level: ToastLevel, override?: string) {
  return override ?? TITLE[level];
}

export function localizeMessage(raw: unknown): string {
  if (raw instanceof Error && "code" in raw) {
    const code = String((raw as { code?: string }).code ?? "");
    if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];
  }

  if (raw && typeof raw === "object" && "code" in raw) {
    const code = String((raw as { code?: string }).code ?? "");
    if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];
  }

  const text = raw instanceof Error ? raw.message : String(raw ?? "");
  const trimmed = text.trim();
  if (!trimmed) return "发生未知错误";

  if (EXACT[trimmed]) return EXACT[trimmed];

  const lower = trimmed.toLowerCase();
  for (const [key, value] of Object.entries(EXACT)) {
    if (key.toLowerCase() === lower) return value;
  }

  for (const [re, fn] of PATTERNS) {
    const m = trimmed.match(re);
    if (m) return fn(m);
  }

  return trimmed;
}

/** 按钮/状态文案（UI-COPY 子集） */
export const COPY = {
  save: "保存修改",
  create: "创建",
  createTask: "创建任务",
  cancel: "取消",
  close: "关闭",
  delete: "删除",
  refresh: "刷新数据",
  testConnection: "测试连接",
  advancedSettings: "高级设置",
  backToList: "返回列表",
  emptyActors: "完成刮削后，演员会从本地缓存聚合显示",
  emptyRecords: "完成一次任务后，结果会出现在这里",
  emptyTasks: "还没有任务，从文件管理选目录或直接创建任务",
} as const;
