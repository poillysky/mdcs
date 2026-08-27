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

export function formatRecordPaths(
  source?: string,
  target?: string,
): { text: string; title: string } {
  const srcShort = shortRelativePath(source || "");
  const tgtShort = target ? shortRelativePath(target) : null;
  const srcFull = displayRelativePath(source);
  const tgtFull = target ? displayRelativePath(target) : null;
  if (tgtShort && tgtFull) {
    return {
      text: `${srcShort} → ${tgtShort}`,
      title: `${srcFull} → ${tgtFull}`,
    };
  }
  return { text: srcShort || "—", title: srcFull === "—" ? "" : srcFull };
}
