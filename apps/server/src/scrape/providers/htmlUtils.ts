export function stripTags(s: string): string {
  return String(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function codeKey(s: string): string {
  return String(s || "")
    .replace(/[-_\s]/g, "")
    .toUpperCase();
}

export function pageMentionsCode(html: string, code: string): boolean {
  const want = codeKey(code);
  if (!want) return false;
  return codeKey(html).includes(want);
}

export function absUrl(href: string | undefined | null, base: string): string | null {
  const u = String(href || "").trim();
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("//")) return `https:${u}`;
  try {
    const root = base.endsWith("/") ? base : `${base}/`;
    return new URL(u, root).href;
  } catch {
    const b = base.replace(/\/$/, "");
    return `${b}${u.startsWith("/") ? "" : "/"}${u}`;
  }
}

export function collectByRe(html: string, re: RegExp): string[] {
  const out: string[] = [];
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  const r = new RegExp(re.source, flags);
  for (const m of html.matchAll(r)) {
    const val = stripTags(m[1] || "");
    if (val && !out.includes(val)) out.push(val);
  }
  return out;
}

export function cleanTitle(raw: string, code: string): string {
  let t = stripTags(raw);
  if (code) {
    t = t.replace(new RegExp(`\\b${code.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "ig"), "");
  }
  return t.replace(/\s+/g, " ").trim();
}

export function isJunkTitle(s: string): boolean {
  const t = String(s || "").trim();
  if (!t || t.length < 2) return true;
  return /^(undefined|null|n\/a|unknown|untitled)$/i.test(t);
}

export function isJunkCoverUrl(url: string): boolean {
  return /\/(?:logo|icon|avatar|placeholder|1x1|blank)\./i.test(url);
}

export function pickOgTitle(html: string): string {
  const m =
    html.match(/property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
    html.match(/content=["']([^"']+)["']\s+property=["']og:title["']/i);
  return m?.[1] ? stripTags(m[1]) : "";
}

export function pickOgImage(html: string): string | null {
  const m =
    html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
    html.match(/content=["']([^"']+)["']\s+property=["']og:image["']/i);
  return m?.[1] || null;
}

export function pickTwitterImage(html: string): string | null {
  const m =
    html.match(/name=["']twitter:image(?::src)?["']\s+content=["']([^"']+)["']/i) ||
    html.match(/content=["']([^"']+)["']\s+name=["']twitter:image(?::src)?["']/i);
  return m?.[1] || null;
}

/** 标准 JAV 番号（FC2/麻豆前导零场景勿用） */
export function stdCode(raw: string): string {
  const s = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/_/g, "-");
  if (!s) return "";
  if (!s.includes("-")) {
    const m = s.match(/^([A-Z]{1,12})(\d{2,}[A-Z0-9-]*)$/);
    if (m) return `${m[1]}-${m[2]}`;
  }
  return s;
}
