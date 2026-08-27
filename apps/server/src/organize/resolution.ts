import { spawnSync } from "node:child_process";
import type { GlobalNamingConfig, NamingResolutionKey } from "../scrape/types.js";

const RES_ORDER: NamingResolutionKey[] = ["720P", "1080P", "4K", "8K"];

export function detectResolutionFromPath(sourcePath: string, fileName: string): string {
  const t = `${sourcePath} ${fileName}`.toUpperCase();
  if (/\b8K\b|4320P/.test(t)) return "8K";
  if (/\b4K\b|2160P|UHD/.test(t)) return "4K";
  if (/1080P|1920X1080|FHD/.test(t)) return "1080P";
  if (/720P|1280X720/.test(t)) return "720P";
  return "";
}

/** 用 ffprobe 读真实分辨率；不可用时返回空 */
export function detectResolutionByProbe(videoAbs: string): string {
  if (!videoAbs) return "";
  try {
    const r = spawnSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height",
        "-of",
        "csv=p=0:s=x",
        videoAbs,
      ],
      { encoding: "utf8", timeout: 8000, windowsHide: true },
    );
    if (r.status !== 0) return "";
    const out = String(r.stdout || "").trim();
    const m = out.match(/(\d+)\s*[xX]\s*(\d+)/);
    if (!m) return "";
    const w = Number(m[1]);
    const h = Number(m[2]);
    const long = Math.max(w, h);
    if (long >= 3800) return "8K";
    if (long >= 2000) return "4K";
    if (long >= 1700) return "1080P";
    if (long >= 1200) return "720P";
    return "";
  } catch {
    return "";
  }
}

/** 按 resolutionTextMap（如 720P, 1080P, 4K, 8K）把档位映射成显示文案 */
export function mapResolutionText(key: string, textMap: string): string {
  if (!key) return "";
  const parts = String(textMap || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const idx = RES_ORDER.indexOf(key as NamingResolutionKey);
  if (idx >= 0 && parts[idx]) return parts[idx]!;
  return key;
}

/**
 * 按 naming.resolutionSource / Fallback 解析分辨率档位（720P/1080P/4K/8K）。
 */
export function resolveResolutionKey(opts: {
  naming: GlobalNamingConfig;
  sourcePath: string;
  fileName: string;
  videoAbs?: string;
}): string {
  const mode = opts.naming.resolutionSource || "prefer_path";
  const fallback = opts.naming.resolutionFallback !== false;
  const fromPath = () => detectResolutionFromPath(opts.sourcePath, opts.fileName);
  const fromProbe = () =>
    opts.videoAbs ? detectResolutionByProbe(opts.videoAbs) : "";

  if (mode === "path") return fromPath();
  if (mode === "probe") return fromProbe();
  if (mode === "prefer_probe") {
    const p = fromProbe();
    if (p) return p;
    return fallback ? fromPath() : "";
  }
  // prefer_path（默认）
  const pathHit = fromPath();
  if (pathHit) return pathHit;
  return fallback ? fromProbe() : "";
}
