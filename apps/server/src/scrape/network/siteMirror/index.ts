/**
 * 通用站点镜像自动切换。
 * - 磁盘缓存 meta/site-mirrors.json（按 sourceId）
 * - 种子列表 + 跟随跳转 + 内容校验
 * - airav_io / iqqtv 委托既有专用模块
 */

import fs from "node:fs";
import path from "node:path";
import {
  getCachedAiravCnBase,
  isAiravOfficialBase,
  normalizeAiravCnBase,
  rememberAiravMirror,
} from "../airavMirror.js";
import { fetchPage } from "../download.js";
import {
  hostNeedsFlare,
  registerFlareHost,
} from "../flaresolverr.js";
import {
  getCachedIqqtvRoot,
  rememberIqqtvMirror,
  rememberIqqtvMirrorFromFinalUrl,
} from "../iqqtvMirror.js";
import { SOURCE_CATALOG } from "../../providers/catalog.js";

import {
  SITE_MIRROR_PROFILES,
  defaultLooksLike,
  hostOf,
  normalizeOrigin,
  originOf,
  type SiteMirrorProfile,
} from "./profiles.js";

const TTL_MS = 6 * 60 * 60 * 1000;


type MirrorEntry = {
  baseUrl: string;
  discoveredFrom?: string;
  updatedAt: string;
  expiresAt: number;
};

type StoreFile = {
  version: 1;
  mirrors: Record<string, MirrorEntry>;
};

let storePath = "";
const memory = new Map<string, MirrorEntry>();
const resolving = new Map<string, Promise<string>>();

function catalogDefault(id: string): string {
  return (
    SOURCE_CATALOG.find((s) => s.id === id)?.defaultUrl?.replace(/\/$/, "") ||
    ""
  );
}


function extractRedirectTargets(html: string, finalUrl: string): string[] {
  const out: string[] = [];
  const push = (raw: string | null | undefined) => {
    const o = originOf(String(raw || "").trim());
    if (o && !out.includes(o)) out.push(o);
  };
  push(finalUrl);
  const text = String(html || "");
  const patterns = [
    /http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"'>\s]+)/i,
    /content=["'][^"']*url=([^"'>\s]+)["'][^>]*http-equiv=["']refresh["']/i,
    /(?:window\.)?location(?:\.href|\.replace)?\s*=\s*['"](https?:\/\/[^'"]+)['"]/i,
    /location\.replace\(\s*['"](https?:\/\/[^'"]+)['"]/i,
    /(?:window\.)?location\.assign\(\s*['"](https?:\/\/[^'"]+)['"]/i,
  ];
  for (const re of patterns) {
    const g = new RegExp(
      re.source,
      re.flags.includes("g") ? re.flags : `${re.flags}g`,
    );
    let m: RegExpExecArray | null;
    while ((m = g.exec(text)) !== null) push(m[1]);
  }
  return out;
}


/** 各源镜像配置（官方稳定站也配 seeds，便于跟 301 换域） */
export function getSiteMirrorProfile(
  id: string,
): SiteMirrorProfile | undefined {
  return SITE_MIRROR_PROFILES[String(id || "").trim().toLowerCase()];
}

export function listMirrorProfileIds(): string[] {
  return Object.keys(SITE_MIRROR_PROFILES);
}

export function setSiteMirrorStorePath(filePath: string): void {
  storePath = String(filePath || "").trim();
  memory.clear();
  loadFromDisk();
}

function loadFromDisk(): void {
  if (!storePath || !fs.existsSync(storePath)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(storePath, "utf8")) as StoreFile;
    const now = Date.now();
    for (const [id, ent] of Object.entries(raw?.mirrors || {})) {
      if (!ent?.baseUrl || Number(ent.expiresAt) <= now) continue;
      memory.set(id, ent);
      const prof = SITE_MIRROR_PROFILES[id];
      if (prof?.viaFlare !== false && prof?.registerFlare !== false) {
        registerFlareHost(ent.baseUrl);
      }
    }
  } catch {
    /* ignore */
  }
}

function persistAll(): void {
  if (!storePath) return;
  try {
    const mirrors: Record<string, MirrorEntry> = {};
    for (const [id, ent] of memory.entries()) mirrors[id] = ent;
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    const payload: StoreFile = { version: 1, mirrors };
    fs.writeFileSync(storePath, JSON.stringify(payload, null, 2), "utf8");
  } catch (e) {
    console.warn(
      "[scrape] site-mirrors.json write failed:",
      e instanceof Error ? e.message : e,
    );
  }
}

function persistOne(id: string, ent: MirrorEntry, log = true): void {
  memory.set(id, ent);
  const prof = SITE_MIRROR_PROFILES[id];
  if (prof?.viaFlare !== false && prof?.registerFlare !== false) {
    registerFlareHost(ent.baseUrl);
  }
  persistAll();
  if (log) console.log(`[scrape] ${id} mirror → ${ent.baseUrl}`);
}

export function rememberSiteMirror(
  id: string,
  baseUrl: string,
  from?: string,
): void {
  const sid = String(id || "").trim().toLowerCase();
  if (sid === "airav_io") {
    rememberAiravMirror(baseUrl, from);
    return;
  }
  if (sid === "iqqtv") {
    rememberIqqtvMirror(baseUrl, from);
    return;
  }
  const prof = SITE_MIRROR_PROFILES[sid];
  if (!prof) return;
  const n = prof.normalize(baseUrl);
  if (!n) return;
  const host = hostOf(n);
  if (prof.sameFamily && host && !prof.sameFamily(host)) return;
  const prev = memory.get(sid);
  if (prev?.baseUrl === n && prev.expiresAt > Date.now()) return;
  persistOne(sid, {
    baseUrl: n,
    discoveredFrom: from || prev?.discoveredFrom,
    updatedAt: new Date().toISOString(),
    expiresAt: Date.now() + (prof.ttlMs || TTL_MS),
  });
}

/**
 * 取页落地后记住新镜像（同族 host 才写）。
 * 首次可经 301；之后 prepareProviderFetch / UI 都直连缓存。
 */
export function rememberSiteMirrorFromFinalUrl(
  id: string,
  finalUrl: string,
  from?: string,
): string | null {
  const sid = String(id || "").trim().toLowerCase();
  const raw = String(finalUrl || "").trim();
  if (!sid || !raw) return null;

  if (sid === "iqqtv") {
    return rememberIqqtvMirrorFromFinalUrl(raw, from);
  }
  if (sid === "airav_io") {
    const n = normalizeAiravCnBase(raw);
    if (!n || isAiravOfficialBase(n)) return null;
    rememberAiravMirror(n, from);
    return n;
  }

  const prof = SITE_MIRROR_PROFILES[sid];
  if (!prof) return null;
  const n = prof.normalize(raw);
  if (!n) return null;
  const host = hostOf(n);
  if (prof.sameFamily && host && !prof.sameFamily(host)) return null;
  rememberSiteMirror(sid, n, from);
  return n;
}

export function invalidateSiteMirror(id: string): void {
  const sid = String(id || "").trim().toLowerCase();
  memory.delete(sid);
  persistAll();
}

export function getCachedSiteMirror(id: string): string | null {
  const sid = String(id || "").trim().toLowerCase();
  if (sid === "airav_io") return getCachedAiravCnBase();
  if (sid === "iqqtv") {
    const root = getCachedIqqtvRoot();
    return root ? `${root}/cn` : null;
  }
  const ent = memory.get(sid);
  if (!ent?.baseUrl || ent.expiresAt <= Date.now()) return null;
  return ent.baseUrl;
}

/** 所有仍有效的落地镜像（含 airav_io / iqqtv），供 UI / 配置叠加 */
export function listLiveSiteMirrors(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of Object.keys(SITE_MIRROR_PROFILES)) {
    const u = getCachedSiteMirror(id);
    if (u) out[id] = u;
  }
  for (const id of ["airav_io", "iqqtv"] as const) {
    const u = getCachedSiteMirror(id);
    if (u) out[id] = u;
  }
  return out;
}

async function probeCandidate(
  prof: SiteMirrorProfile,
  seed: string,
): Promise<string | null> {
  const preferred = prof.normalize(seed) || seed.replace(/\/$/, "");
  if (!preferred) return null;
  const pathPart = prof.probePath || "/";
  const url = `${preferred.replace(/\/$/, "")}${
    pathPart === "/"
      ? "/"
      : pathPart.startsWith("/")
        ? pathPart
        : `/${pathPart}`
  }`;
  const viaFlare =
    prof.viaFlare !== undefined
      ? prof.viaFlare
      : hostNeedsFlare(url)
        ? true
        : undefined;
  // 代理直连源禁止登记过盾 host，否则后续探测会被 hostNeedsFlare 误吸进 Flare
  if (viaFlare !== false && prof.registerFlare !== false) {
    registerFlareHost(preferred);
  }

  const page = await fetchPage(url, {
    timeoutMs: viaFlare === true ? 55000 : 20000,
    sourceId: prof.id,
    viaFlare,
    referer: `${preferred}/`,
    strictTimeout: true,
  });
  if (!page?.html) return null;

  const targets = extractRedirectTargets(page.html, page.finalUrl || url)
    .map((t) => prof.normalize(t))
    .filter(Boolean);
  const self = prof.normalize(page.finalUrl || preferred) || preferred;
  const ordered = [...new Set([self, ...targets, preferred])];

  for (const cand of ordered) {
    const host = hostOf(cand);
    if (prof.sameFamily && host && !prof.sameFamily(host)) {
      continue;
    }
    const checkPath = prof.probePath || "/";
    const checkUrl = `${cand.replace(/\/$/, "")}${
      checkPath === "/"
        ? "/"
        : checkPath.startsWith("/")
          ? checkPath
          : `/${checkPath}`
    }`;
    let html = page.html;
    let finalUrl = page.finalUrl || url;
    if (prof.normalize(finalUrl) !== cand) {
      const again = await fetchPage(checkUrl, {
        timeoutMs: viaFlare === true ? 45000 : 16000,
        sourceId: prof.id,
        viaFlare,
        referer: `${cand}/`,
        strictTimeout: true,
      });
      if (!again?.html) continue;
      html = again.html;
      finalUrl = again.finalUrl || checkUrl;
    }
    const ok = prof.looksLike
      ? prof.looksLike(html, finalUrl)
      : defaultLooksLike(html);
    if (!ok) continue;
    return prof.normalize(finalUrl) || cand;
  }
  return null;
}

async function discoverOnce(
  prof: SiteMirrorProfile,
  preferred?: string,
): Promise<string> {
  const cached = memory.get(prof.id)?.baseUrl;
  const seeds = [
    preferred ? prof.normalize(preferred) : "",
    cached ? prof.normalize(cached) : "",
    ...prof.seeds.map((s) => prof.normalize(s) || s),
    catalogDefault(prof.id),
  ].filter(Boolean);
  const uniq = [...new Set(seeds)];

  for (const seed of uniq) {
    try {
      const hit = await probeCandidate(prof, seed);
      if (hit) {
        persistOne(prof.id, {
          baseUrl: hit,
          discoveredFrom: preferred || prof.seeds[0],
          updatedAt: new Date().toISOString(),
          expiresAt: Date.now() + (prof.ttlMs || TTL_MS),
        });
        return hit;
      }
    } catch {
      /* next */
    }
  }

  return (
    (preferred ? prof.normalize(preferred) : "") ||
    prof.normalize(prof.seeds[0] || "") ||
    catalogDefault(prof.id) ||
    prof.seeds[0] ||
    ""
  );
}

/**
 * 解析当前可用基址。airav_io / iqqtv 走专用模块。
 * 有落地缓存则直连；无缓存时发现一次并记住（即使 skipDiscover，避免每次经旧入口跳转）。
 */
export async function resolveSiteMirror(
  id: string,
  opts?: {
    preferred?: string;
    forceRefresh?: boolean;
    skipDiscover?: boolean;
  },
): Promise<string> {
  const sid = String(id || "").trim().toLowerCase();

  if (sid === "airav_io") {
    const { resolveAiravCnBase, getCachedAiravCnBase } =
      await import("../airavMirror.js");
    if (opts?.skipDiscover && !opts?.forceRefresh) {
      const cached = getCachedAiravCnBase();
      if (cached) return cached;
      // 无落地缓存：发现一次并记住，之后直连
    }
    return resolveAiravCnBase({
      preferred: opts?.preferred,
      forceRefresh: opts?.forceRefresh,
    });
  }
  if (sid === "iqqtv") {
    const { resolveIqqtvRoot, getCachedIqqtvRoot } =
      await import("../iqqtvMirror.js");
    if (opts?.skipDiscover && !opts?.forceRefresh) {
      const cached = getCachedIqqtvRoot();
      if (cached) return `${cached}/cn`;
      // 无落地缓存或仍是 301 入口：发现一次并记住新站，之后直连
    }
    const root = await resolveIqqtvRoot({
      preferred: opts?.preferred,
      forceRefresh: opts?.forceRefresh,
    });
    return `${root}/cn`;
  }

  const prof = SITE_MIRROR_PROFILES[sid];
  if (!prof) {
    return String(opts?.preferred || catalogDefault(sid) || "").replace(
      /\/$/,
      "",
    );
  }

  if (!opts?.forceRefresh) {
    const hit = memory.get(sid);
    if (hit && hit.expiresAt > Date.now() && hit.baseUrl) {
      if (prof.viaFlare !== false && prof.registerFlare !== false) {
        registerFlareHost(hit.baseUrl);
      }
      return hit.baseUrl;
    }
  }

  // skipDiscover：有缓存已在上方返回；无缓存则发现一次（记住落地站，避免每次经旧入口跳转）
  const existing = resolving.get(sid);
  if (existing) return existing;

  const p = discoverOnce(prof, opts?.preferred)
    .catch(
      () =>
        (opts?.preferred ? prof.normalize(opts.preferred) : "") ||
        prof.normalize(prof.seeds[0] || "") ||
        catalogDefault(sid),
    )
    .finally(() => {
      resolving.delete(sid);
    });
  resolving.set(sid, p);
  return p;
}

/** 刮削失败时：清缓存并强制重解析一次 */
export async function refreshSiteMirror(
  id: string,
  preferred?: string,
): Promise<string> {
  const sid = String(id || "").trim().toLowerCase();
  if (sid === "airav_io") {
    const { invalidateAiravMirror, resolveAiravCnBase } = await import(
      "../airavMirror.js"
    );
    invalidateAiravMirror();
    return resolveAiravCnBase({ preferred, forceRefresh: true });
  }
  if (sid === "iqqtv") {
    const { invalidateIqqtvMirror, resolveIqqtvRoot } = await import(
      "../iqqtvMirror.js"
    );
    invalidateIqqtvMirror();
    const root = await resolveIqqtvRoot({ preferred, forceRefresh: true });
    return `${root}/cn`;
  }
  invalidateSiteMirror(sid);
  return resolveSiteMirror(sid, { preferred, forceRefresh: true });
}

function hasMirrorFailover(id: string): boolean {
  const sid = String(id || "").trim().toLowerCase();
  if (sid === "airav_io" || sid === "iqqtv") return true;
  const seeds = SITE_MIRROR_PROFILES[sid]?.seeds || [];
  return seeds.length > 1;
}

/**
 * 刮削包装：先解析可用基址；失败且有多镜像时强制换站再试一次。
 * 成功时写入磁盘缓存（含跳转后的 host）。
 */
export async function withSiteMirrorBase<T>(
  id: string,
  preferred: string | undefined,
  run: (base: string) => Promise<T | null>,
): Promise<T | null> {
  const sid = String(id || "").trim().toLowerCase();
  const pref =
    String(preferred || "").trim() || catalogDefault(sid) || undefined;
  let base = await resolveSiteMirror(sid, { preferred: pref });
  if (!base) return null;
  let result = await run(base);
  if (result != null) {
    rememberSiteMirror(sid, base, pref);
    return result;
  }
  if (!hasMirrorFailover(sid)) return null;
  base = await refreshSiteMirror(sid, pref);
  if (!base) return null;
  result = await run(base);
  if (result != null) rememberSiteMirror(sid, base, pref);
  return result;
}

export { SITE_MIRROR_PROFILES, normalizeOrigin, originOf, hostOf };
export type { SiteMirrorProfile };
