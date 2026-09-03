/** 路径统一为项目内相对路径（展示与存储均不带盘符） */

export function normalizeSlashes(path: string): string {
  return path.replace(/\\/g, "/");
}

export function looksAbsolutePath(value: string): boolean {
  const norm = normalizeSlashes(value);
  return /^[a-zA-Z]:/.test(norm) || /^\/[A-Za-z]:/.test(norm) || norm.includes(":/");
}

/** 从绝对路径提取 media/index 段 */
export function absToRelativePath(value: string): string {
  const norm = normalizeSlashes(value);
  for (const marker of ["/media/", "/index/", "/data/"]) {
    const idx = norm.toLowerCase().indexOf(marker);
    if (idx >= 0) return norm.slice(idx);
  }
  const parts = norm.split("/").filter(Boolean);
  const anchor = parts.findIndex((p) => p === "media" || p === "index" || p === "data");
  if (anchor >= 0) return `/${parts.slice(anchor).join("/")}`;
  if (parts.length <= 2) return `/${parts.join("/")}`;
  return `/${parts.slice(-2).join("/")}`;
}

/** 任意路径 → 相对路径（带前导 /） */
export function toRelativePath(value?: string): string {
  if (!value?.trim()) return "";
  const trimmed = value.trim();
  if (looksAbsolutePath(trimmed)) return absToRelativePath(trimmed);
  const norm = normalizeSlashes(trimmed).replace(/^\/+/, "").replace(/\/+$/, "");
  return norm ? `/${norm}` : "";
}

/** 比较/存储用：无前导斜杠、无尾斜杠 */
export function normalizeRelativePath(path: string): string {
  return toRelativePath(path).replace(/^\/+/, "").replace(/\/+$/, "");
}

/** 已是 media/index/data 或片库/索引根下的项目相对路径 */
export function isProjectRelativePath(value?: string): boolean {
  const norm = normalizeRelativePath(String(value || ""));
  return (
    /^(?:media|index|data)\//i.test(norm) ||
    norm.includes("片商目录") ||
    norm.includes("本地索引")
  );
}

/**
 * 将 DB 中的 target_path（相对片库根）展开为项目相对路径。
 * 例：HMN/HMN-467/HMN-467.strm → media/片商目录/日本有码/HMN/HMN-467/HMN-467.strm
 */
export function expandLibraryTargetPath(targetRel?: string, libraryRoot?: string): string {
  const raw = normalizeRelativePath(String(targetRel || ""));
  if (!raw) return "";
  if (looksAbsolutePath(raw)) return absToRelativePath(raw).replace(/^\/+/, "");
  if (isProjectRelativePath(raw)) return raw;
  const lib = normalizeRelativePath(String(libraryRoot || ""));
  if (!lib) return raw;
  return `${lib}/${raw}`;
}

/** 由片库视频路径推导 NFO 文件名（如 HMN-467.nfo） */
export function nfoFileNameForTarget(targetRel?: string, libraryRoot?: string): string {
  const full = expandLibraryTargetPath(targetRel, libraryRoot);
  if (!full) return "movie.nfo";
  const base = full.split("/").pop() || "";
  const stem = base.replace(/\.[^.]+$/, "");
  return stem ? `${stem}.nfo` : "movie.nfo";
}

/** UI 展示：带前导 /，空为 — */
export function displayRelativePath(value?: string): string {
  const rel = toRelativePath(value);
  return rel || "—";
}

/** 列表短路径：保留末尾若干段 */
export function shortRelativePath(path: string, tailSegments = 3): string {
  const rel = toRelativePath(path);
  if (!rel) return "—";
  const parts = rel.replace(/^\/+/, "").split("/").filter(Boolean);
  if (parts.length <= tailSegments) return rel;
  return `/${parts.slice(-tailSegments).join("/")}`;
}

export function pickDisplayPath(relative?: string, absolute?: string): { display: string } {
  const rel = relative?.trim();
  const abs = absolute?.trim();

  if (rel && !looksAbsolutePath(rel)) {
    return { display: displayRelativePath(rel) };
  }

  const absSource = rel && looksAbsolutePath(rel) ? rel : abs;
  if (absSource) {
    return { display: absToRelativePath(absSource) };
  }

  return { display: "—" };
}

/** 在 / 后插入零宽字符，窄列换行时优先在路径段边界断开 */
function pathWithWrapHints(path: string): string {
  if (!path || path === "—") return path;
  return path.replace(/\//g, "/\u200b");
}

export function formatRecordPaths(
  source?: string,
  target?: string,
  libraryRoot?: string,
): { source: string; target?: string; title: string } {
  const srcFull = displayRelativePath(source);
  const tgtFull = target
    ? displayRelativePath(expandLibraryTargetPath(target, libraryRoot))
    : undefined;
  const title =
    tgtFull && srcFull && srcFull !== "—"
      ? `${srcFull} → ${tgtFull}`
      : srcFull === "—"
        ? ""
        : srcFull;
  return {
    source: pathWithWrapHints((srcFull === "—" ? "—" : srcFull).trim()),
    target:
      tgtFull && tgtFull !== "—" ? pathWithWrapHints(tgtFull.trim()) : undefined,
    title,
  };
}
