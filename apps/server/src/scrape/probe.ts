import { SOURCE_CATALOG, type ProviderAccess } from "./providers/catalog.js";
import { prepareProviderFetch, siteFetchOpts } from "./providers/providerSite.js";
import { fetchPageWithOpts } from "./network/fetch.js";
import { looksBlockedHtml } from "./network/flaresolverr.js";
import { getActiveProxy } from "./network/proxy.js";
import { getFlareSolverrUrl } from "./network/flaresolverr.js";
import {
  getSiteMirrorProfile,
  rememberSiteMirror,
  resolveSiteMirror,
} from "./network/siteMirror.js";
import {
  extractAiravRedirectTargets,
  getCachedAiravCnBase,
  isAiravOfficialBase,
  normalizeAiravCnBase,
  rememberAiravMirror,
} from "./network/airavMirror.js";
import { defaultCookieFor } from "./network/sourceCookies.js";
import { probeTheporndbApi, THEPORNDB_SITE_URL } from "./providers/theporndb.js";
import type { SourceId } from "./types.js";

export type ProbeResult = {
  id: string;
  label: string;
  url: string;
  access: ProviderAccess;
  implemented: boolean;
  ok: boolean;
  status?: number;
  ms: number;
  message: string;
  /** 探测实际可用基址（镜像跳转后） */
  resolvedBaseUrl?: string;
  /** direct=代理/直连 Node · curl · flare */
  probeVia?: string | null;
};

/** 内存态探活失败冷却：id → 解禁时间戳 */
const probeCooldownUntil = new Map<string, number>();

export function getProbeCooldownIds(now = Date.now()): Set<string> {
  const out = new Set<string>();
  for (const [id, until] of probeCooldownUntil) {
    if (until > now) out.add(id);
    else probeCooldownUntil.delete(id);
  }
  return out;
}

export function markProbeFailed(id: string, cooldownMs = 15 * 60 * 1000): void {
  probeCooldownUntil.set(id, Date.now() + cooldownMs);
}

export function clearProbeCooldown(id?: string): void {
  if (id) probeCooldownUntil.delete(id);
  else probeCooldownUntil.clear();
}

/** 基址已带路径时勿重复拼接 probePath（如 …/zh + /zh/） */
function joinBaseProbePath(base: string, probePath: string): string {
  const b = String(base || "").replace(/\/$/, "");
  let p = String(probePath || "/").trim() || "/";
  if (!p.startsWith("/")) p = `/${p}`;
  if (p !== "/") {
    const basePath = (() => {
      try {
        return new URL(b).pathname.replace(/\/+$/, "") || "";
      } catch {
        return "";
      }
    })();
    const probeNorm = p.replace(/\/+$/, "") || "";
    if (basePath && (basePath === probeNorm || basePath.endsWith(probeNorm))) {
      return `${b}/`;
    }
  }
  return p === "/" ? `${b}/` : `${b}${p}`;
}

function looksLikeAiravProbeHtml(html: string): boolean {
  if (!html || html.length < 800) return false;
  if (looksBlockedHtml(html) && html.length < 12000) return false;
  return /airav|瘋av|疯av|免費a片|免费a片|video-title|search_result|番[号號]/i.test(
    html.slice(0, 8000),
  );
}

function looksLikeJavlibraryProbeHtml(html: string): boolean {
  if (!html || html.length < 500) return false;
  if (/Just a moment|cf-browser-verification|Attention Required/i.test(html.slice(0, 4000))) {
    return false;
  }
  return (
    /id=["']video_title["']/.test(html) ||
    /class=["']video["'][^>]*id=|识别码搜寻|vl_searchbyid|video_jacket_img|video_id/.test(
      html.slice(0, 20000),
    )
  );
}
/** MissAV 详情/搜索：og:video.other 或 MissAV 站点标识 */
function looksLikeMissAvProbeHtml(html: string): boolean {
  if (!html || html.length < 3000) return false;
  if (/Just a moment|cf-browser-verification|Attention Required/i.test(html.slice(0, 4000))) {
    return false;
  }
  return (
    /property=["']og:site_name["']\s+content=["']MissAV["']/i.test(html) ||
    /property=["']og:type["']\s+content=["']video\.other["']/i.test(html) ||
    /missav|的搜寻结果|番号:/i.test(html.slice(0, 25000))
  );
}

/** NJAV / 123AV：watch 页或搜索页 */
function looksLikeNjavProbeHtml(html: string): boolean {
  if (!html || html.length < 3000) return false;
  if (/Just a moment|cf-browser-verification|Attention Required/i.test(html.slice(0, 4000))) {
    return false;
  }
  if (/123av\.com に移転|moved__title|404 — 123AV/i.test(html.slice(0, 12000))) return false;
  return (
    /og:site_name["']\s+content=["']123AV["']/i.test(html) ||
    /class=["']watch__title["']/.test(html) ||
    /class=["']watch__info-row["']/.test(html) ||
    /Search:\s*SONE/i.test(html.slice(0, 8000)) ||
    /\/ja\/v\//i.test(html.slice(0, 50000))
  );
}

/** MDCX 无 SPECIAL_CHECK_PATHS；MDCS 用搜索页探针，需有详情/搜索业务 DOM */
function looksLikeAvsexProbeHtml(html: string): boolean {
  if (!html || html.length < 500) return false;
  return /\/video\/detail\/|search\?query=|truncate|video\/detail/i.test(html.slice(0, 12000));
}

export async function probeProvider(
  id: string,
  opts?: { timeoutSec?: number },
): Promise<ProbeResult> {
  const entry = SOURCE_CATALOG.find((e) => e.id === id);
  if (!entry) {
    return {
      id,
      label: id,
      url: "",
      access: "proxy",
      implemented: false,
      ok: false,
      ms: 0,
      message: "未知 Provider",
    };
  }

  if (entry.probeable === false || !entry.defaultUrl?.trim()) {
    return {
      id: entry.id,
      label: entry.label,
      url: entry.defaultUrl,
      access: entry.access,
      implemented: entry.implemented,
      ok: false,
      ms: 0,
      message: entry.notes || "暂无 HTTP 测通（内部路由或未配置 URL）",
      probeVia: null,
    };
  }

  clearProbeCooldown(entry.id);

  if (id === "theporndb") {
    const started = Date.now();
    const auth = await probeTheporndbApi();
    const ms = Date.now() - started;
    if (!auth.ok) {
      markProbeFailed(entry.id);
      return {
        id: entry.id,
        label: entry.label,
        url: THEPORNDB_SITE_URL,
        access: entry.access,
        implemented: entry.implemented,
        ok: false,
        status: auth.status,
        ms,
        message: auth.message,
        probeVia: null,
      };
    }
    clearProbeCooldown(entry.id);
    return {
      id: entry.id,
      label: entry.label,
      url: THEPORNDB_SITE_URL,
      access: entry.access,
      implemented: entry.implemented,
      ok: true,
      status: auth.status ?? 200,
      ms,
      message: auth.message,
      resolvedBaseUrl: THEPORNDB_SITE_URL,
      probeVia: "api",
    };
  }

  if (id === "dmm") {
    const started = Date.now();
    const { probeDmmApi } = await import("./providers/dmm.js");
    const auth = await probeDmmApi();
    const ms = Date.now() - started;
    if (!auth.ok) {
      markProbeFailed(entry.id);
      return {
        id: entry.id,
        label: entry.label,
        url: entry.defaultUrl,
        access: entry.access,
        implemented: entry.implemented,
        ok: false,
        status: auth.status,
        ms,
        message: auth.message,
        probeVia: null,
      };
    }
    clearProbeCooldown(entry.id);
    return {
      id: entry.id,
      label: entry.label,
      url: "https://api.video.dmm.co.jp/graphql",
      access: entry.access,
      implemented: entry.implemented,
      ok: true,
      status: auth.status ?? 200,
      ms,
      message: auth.message,
      resolvedBaseUrl: "https://api.video.dmm.co.jp",
      probeVia: "api",
    };
  }

  const site = await prepareProviderFetch(entry.id as SourceId, entry.defaultUrl || "");
  const preferred = site.baseUrl;
  if (!preferred) {
    return {
      id: entry.id,
      label: entry.label,
      url: "",
      access: site.access,
      implemented: entry.implemented,
      ok: false,
      ms: 0,
      message: "未配置网站地址",
    };
  }

  let base = preferred;
  try {
    const resolved = await resolveSiteMirror(id, {
      preferred,
      skipDiscover: true,
    });
    if (resolved) base = resolved.replace(/\/$/, "");
  } catch {
    base = preferred;
  }

  const probePath = getSiteMirrorProfile(id)?.probePath || entry.probePath || "/";
  const basesToTry: string[] = [base];
  if (id === "javbus") {
    const seed =
      (getSiteMirrorProfile("javbus")?.seeds || []).find(
        (s) => s.replace(/\/$/, "") !== base,
      ) || "https://www.seejav.me";
    if (seed && seed.replace(/\/$/, "") !== base) {
      basesToTry.push(seed.replace(/\/$/, ""));
    }
  }
  if (id === "javlibrary") {
    const seeds = (getSiteMirrorProfile("javlibrary")?.seeds || [])
      .map((s) => s.replace(/\/$/, ""))
      .filter((s) => s && !/javlibrary\.com/i.test(s));
    basesToTry.length = 0;
    const cached = base.replace(/\/$/, "");
    if (cached) basesToTry.push(cached);
    for (const s of seeds) {
      if (!basesToTry.includes(s)) basesToTry.push(s);
      if (basesToTry.length >= 2) break;
    }
  }
  if (id === "airav_io") {
    const cached = getCachedAiravCnBase();
    if (cached) {
      const c = cached.replace(/\/$/, "");
      if (c && !basesToTry.includes(c)) basesToTry.unshift(c);
    }
    for (const seed of ["https://airav.io/cn", "https://www.airav.io/cn"]) {
      const s = seed.replace(/\/$/, "");
      if (s && !basesToTry.includes(s)) basesToTry.push(s);
    }
  }

  const access = site.access;
  const hasProxy = Boolean(getActiveProxy());
  const hasFlare = Boolean(getFlareSolverrUrl());
  const needsFlare = access === "proxy_flare" && hasFlare;
  const adaptive = access === "proxy_adaptive";

  const defaultSec =
    needsFlare || adaptive
      ? id === "airav_io"
        ? 42
        : id === "avsex"
          ? 55
          : id === "javlibrary"
            ? 22
            : 36
      : 18;
  const timeoutSec = Math.min(
    90,
    Math.max(
      3,
      typeof opts?.timeoutSec === "number" &&
        Number.isFinite(opts.timeoutSec) &&
        opts.timeoutSec > 0
        ? opts.timeoutSec
        : defaultSec,
    ),
  );
  const probeTimeoutMs = timeoutSec * 1000;

  let lastError =
    adaptive && !hasProxy
      ? "未配置代理（本源需代理）"
      : access === "proxy_flare" && !hasFlare
        ? "未配置 FlareSolverr（本源需代理过盾）"
        : "超时 / 无响应";
  let okBase = "";
  let probeVia: string | null = null;
  let airavOfficialOk: { base: string; via: string | null } | null = null;
  const started = Date.now();
  const maxTries =
    id === "airav_io" ? 6 : id === "javlibrary" ? 1 : basesToTry.length;

  for (let i = 0; i < basesToTry.length && i < maxTries; i++) {
    const b = String(basesToTry[i] || "").replace(/\/$/, "");
    if (!b) continue;
    const url = joinBaseProbePath(b, probePath);
    const javlibFlareFirst = id === "javlibrary" && adaptive && hasFlare;
    let page = await fetchPageWithOpts(
      url,
      siteFetchOpts(site, {
        timeoutMs: javlibFlareFirst ? Math.max(probeTimeoutMs, 35000) : probeTimeoutMs,
        strictTimeout: false,
        viaFlare: needsFlare || javlibFlareFirst,
        noSessionRetry: true,
        freshProbe: true,
        sourceId: javlibFlareFirst ? undefined : id,
        referer: `${b}/cn/`,
        cookie: site.cookie || defaultCookieFor(id),
      }),
    );
    let html = page?.html || "";
    // proxy_flare 冷启动：再补一轮无 session 过盾（仍禁止 create）
    if (!html && needsFlare && hasFlare) {
      page = await fetchPageWithOpts(
        url,
        siteFetchOpts(site, {
          timeoutMs: Math.max(probeTimeoutMs, 50000),
          strictTimeout: false,
          viaFlare: true,
          noSessionRetry: true,
          freshProbe: true,
          referer: `${b}/`,
          cookie: site.cookie || defaultCookieFor(id),
        }),
      );
      html = page?.html || "";
    }
    if (!html) {
      if (adaptive && !hasProxy) {
        lastError = "未配置代理（本源需代理）";
      } else if (access === "proxy_flare" && !hasFlare) {
        lastError = "未配置 FlareSolverr（本源需代理过盾）";
      } else if (adaptive) {
        lastError = hasFlare
          ? "直连与过盾均无响应（请确认代理/Flare 可达）"
          : "超时 / 无响应（未配 Flare，无法自适应过盾）";
      } else {
        lastError = needsFlare ? "过盾超时 / 无响应" : "超时 / 无响应";
      }
      continue;
    }

    if (id === "airav_io") {
      const landed =
        normalizeAiravCnBase(page?.finalUrl || "") ||
        normalizeAiravCnBase(b) ||
        b;
      if (looksLikeAiravProbeHtml(html)) {
        const targets = extractAiravRedirectTargets(
          html,
          page?.finalUrl || url,
          url,
        );
        const mirror = targets
          .map((t) => normalizeAiravCnBase(t).replace(/\/$/, ""))
          .find((n) => n && !isAiravOfficialBase(n));
        const landedBase = landed.replace(/\/$/, "");
        probeVia = page?.via || null;
        try {
          if (mirror) rememberAiravMirror(mirror, b);
          else if (!isAiravOfficialBase(landedBase)) rememberAiravMirror(landedBase, b);
        } catch {
          /* ignore */
        }
        if (
          mirror &&
          isAiravOfficialBase(landedBase) &&
          !basesToTry.includes(mirror) &&
          i + 1 < maxTries
        ) {
          airavOfficialOk = { base: landedBase, via: probeVia };
          basesToTry.splice(i + 1, 0, mirror);
          lastError = "官方已通，改测镜像以争取 curl 直链";
          continue;
        }
        okBase = (mirror || landedBase).replace(/\/$/, "");
        break;
      }
      const targets = extractAiravRedirectTargets(html, page?.finalUrl || url, url);
      let queued = 0;
      for (const t of targets) {
        const n = normalizeAiravCnBase(t).replace(/\/$/, "");
        if (!n || basesToTry.includes(n)) continue;
        if (!isAiravOfficialBase(n)) basesToTry.splice(i + 1 + queued, 0, n);
        else basesToTry.push(n);
        queued += 1;
        if (queued >= 3) break;
      }
      lastError = queued
        ? "入口为跳转壳，已跟镜像重试"
        : looksBlockedHtml(html)
          ? hasFlare
            ? "仍是挑战页（自适应过盾未完成）"
            : "仍是挑战页（请确认 FlareSolverr 可用）"
          : "未识别到可用 airav 镜像";
      continue;
    }

    if (looksBlockedHtml(html)) {
      const challenge =
        /Just a moment|cf-browser-verification|Attention Required|Cloudflare/i.test(
          html.slice(0, 4000),
        );
      lastError =
        id === "fc2_hub" || id === "javdb"
          ? "出口 IP 被站方封锁（换代理或暂时依赖其它源）"
          : adaptive
            ? challenge
              ? hasFlare
                ? "仍是挑战页（自适应过盾未完成）"
                : "仍是挑战页（不稳定过盾站，请配置 FlareSolverr）"
              : "空响应 / 封锁页"
            : challenge
              ? needsFlare
                ? "仍是挑战页（过盾未完成）"
                : "仍是挑战页（本源为代理直连，请换代理）"
              : "空响应 / 封锁页";
      continue;
    }
    if (id === "avsex" && !looksLikeAvsexProbeHtml(html)) {
      lastError = "搜索页无业务内容";
      continue;
    }
    if (id === "javlibrary" && !looksLikeJavlibraryProbeHtml(html)) {
      lastError = "搜索页无业务内容";
      continue;
    }
    if (id === "miss_av" && !looksLikeMissAvProbeHtml(html)) {
      lastError = "详情/搜索页无业务内容";
      continue;
    }
    if (id === "njav" && !looksLikeNjavProbeHtml(html)) {
      lastError = "详情/搜索页无业务内容（njav.tv 已迁移 123av.com）";
      continue;
    }
    okBase = b;
    probeVia = page?.via || null;
    break;
  }

  if (!okBase && airavOfficialOk) {
    okBase = airavOfficialOk.base;
    probeVia = airavOfficialOk.via;
  }

  const ms = Date.now() - started;
  if (!okBase) {
    markProbeFailed(entry.id);
    return {
      id: entry.id,
      label: entry.label,
      url: joinBaseProbePath(base, probePath),
      access: site.access,
      implemented: entry.implemented,
      ok: false,
      ms,
      message: lastError,
      probeVia: null,
    };
  }

  try {
    rememberSiteMirror(id, okBase);
  } catch {
    /* ignore */
  }
  if (id === "airav_io") {
    try {
      rememberAiravMirror(okBase);
    } catch {
      /* ignore */
    }
  }

  clearProbeCooldown(entry.id);
  return {
    id: entry.id,
    label: entry.label,
    url: joinBaseProbePath(okBase, probePath),
    access: site.access,
    implemented: entry.implemented,
    ok: true,
    status: 200,
    ms,
    message: probeVia ? `可达 · ${probeVia}` : "可达",
    resolvedBaseUrl: okBase,
    probeVia,
  };
}

export async function probeAllProviders(opts?: {
  onlyImplemented?: boolean;
  timeoutSec?: number;
}): Promise<ProbeResult[]> {
  const list = SOURCE_CATALOG.filter((e) =>
    opts?.onlyImplemented === false ? true : e.implemented,
  );
  const results: ProbeResult[] = [];
  for (const entry of list) {
    results.push(await probeProvider(entry.id, { timeoutSec: opts?.timeoutSec }));
  }
  return results;
}
