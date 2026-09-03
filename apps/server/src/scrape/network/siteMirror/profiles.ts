/** Site mirror seed profiles (pure data + normalizers). */

import { looksBlockedHtml } from "../flaresolverr.js";

export type SiteMirrorProfile = {
  id: string;
  /** 探测/切换种子（完整 URL 或 origin） */
  seeds: string[];
  /** 规范化为刮削用基址 */
  normalize: (raw: string) => string;
  /** 落地 host 是否同族 */
  sameFamily?: (host: string) => boolean;
  /** HTML 像不像本站 */
  looksLike?: (html: string, finalUrl: string) => boolean;
  /** 强制 viaFlare；undefined = hostNeedsFlare */
  viaFlare?: boolean;
  /** 登记 Flare host，默认 true */
  registerFlare?: boolean;
  /** 探测路径，拼在 normalize 结果后 */
  probePath?: string;
  ttlMs?: number;
};

export function originOf(raw: string): string {
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "";
  }
}

export function hostOf(raw: string): string {
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** 仅保留 origin（无 path） */
export function normalizeOrigin(raw: string): string {
  return originOf(String(raw || "").trim()).replace(/\/$/, "");
}

export function defaultLooksLike(html: string): boolean {
  if (!html || html.length < 600) return false;
  if (looksBlockedHtml(html) && html.length < 12000) return false;
  return true;
}

export const SITE_MIRROR_PROFILES: Record<string, SiteMirrorProfile> = {
  javbus: {
    id: "javbus",
    seeds: [
      "https://www.javbus.com",
      "https://www.seejav.me",
      "https://seejav.me",
    ],
    normalize: normalizeOrigin,
    sameFamily: (h) => /javbus|seejav/i.test(h),
    looksLike: (html) =>
      defaultLooksLike(html) &&
      (/javbus|seejav|bigImage|磁力|女優|女优/i.test(html) || html.length > 4000),
    viaFlare: false,
    registerFlare: false,
    probePath: "/",
  },
  miss_av: {
    id: "miss_av",
    seeds: [
      "https://missav123.com",
      "https://missav.com",
      "https://www.missav123.com",
      "https://missav.ws",
      "https://missav.live",
    ],
    normalize: normalizeOrigin,
    sameFamily: (h) => /missav/i.test(h),
    looksLike: (html) =>
      defaultLooksLike(html) &&
      (/missav|og:title|space-y-2|女优|女優/i.test(html) || html.length > 8000),
    probePath: "/cn/sone-001",
  },
  njav: {
    id: "njav",
    seeds: [
      "https://123av.com/ja",
      "https://www.123av.com/ja",
      "https://njav.tv/ja",
      "https://www.njav.tv/ja",
    ],
    normalize: (raw) => {
      const o = normalizeOrigin(raw);
      if (!o) return o;
      if (/\/(ja|en|cn|zh|ko)$/i.test(o)) return o;
      return `${o}/ja`;
    },
    sameFamily: (h) => /123av|njav/i.test(h),
    looksLike: (html) =>
      defaultLooksLike(html) &&
      (/123av|watch__title|watch__info-row|og:site_name.*123AV/i.test(html) ||
        html.length > 8000),
    probePath: "/v/sone-001",
  },
  sevenmmtv: {
    id: "sevenmmtv",
    seeds: [
      "https://7mmtv.sx",
      "https://www.7mmtv.sx",
      "https://7mmtv.com",
      "https://7mm.tv",
    ],
    normalize: (raw) =>
      normalizeOrigin(raw).replace(/\/zh$/i, "") || normalizeOrigin(raw),
    sameFamily: (h) => /7mm/i.test(h),
    looksLike: (html) =>
      defaultLooksLike(html) &&
      (/7mmtv|censored_content|searchall|search_keyword/i.test(html) ||
        html.length > 5000),
    // 不稳定过盾：由 sourceId adaptive 决定，勿锁死 viaFlare:false
    probePath: "/zh/",
  },
  avmoo: {
    id: "avmoo",
    seeds: ["https://avmoo.shop", "https://www.avmoo.shop"],
    normalize: normalizeOrigin,
    sameFamily: (h) => /avmoo/i.test(h),
    looksLike: (html) =>
      defaultLooksLike(html) &&
      (/avmoo|\/cn\/movies|q-page|女优|女優/i.test(html) || html.length > 2000),
    // Quasar SPA：Flare 用于渲染 JS，不是 CF 挑战
    viaFlare: true,
    probePath: "/cn",
  },
  avsox: {
    id: "avsox",
    seeds: ["https://avsox.click", "https://www.avsox.click"],
    normalize: normalizeOrigin,
    sameFamily: (h) => /avsox/i.test(h),
    looksLike: (html) =>
      defaultLooksLike(html) &&
      (/avsox|\/cn\/movies|q-page|女优|女優/i.test(html) || html.length > 2000),
    // 同 avmoo：SPA 渲染
    viaFlare: true,
    probePath: "/cn",
  },
  javdb: {
    id: "javdb",
    seeds: [
      "https://javdb.com",
      "https://www.javdb.com",
      "https://javdb368.com",
    ],
    normalize: normalizeOrigin,
    sameFamily: (h) => /javdb/i.test(h),
    looksLike: (html) =>
      defaultLooksLike(html) &&
      (/javdb|movie-list|strong.uid|over18/i.test(html) || html.length > 5000),
    viaFlare: true,
    probePath: "/",
  },
  javlibrary: {
    id: "javlibrary",
    seeds: [
      "https://www.f101w.com",
      "https://www.c97k.com",
      "https://www.b47w.com",
      "https://www.javlibrary.com",
    ],
    normalize: normalizeOrigin,
    sameFamily: (h) => /javlibrary|f101w|c97k|b47w/i.test(h),
    looksLike: (html) =>
      defaultLooksLike(html) &&
      (/javlibrary|videothumblist|idinfo|vl_searchbyid/i.test(html) ||
        html.length > 4000),
    viaFlare: false,
    registerFlare: false,
    probePath: "/cn/vl_searchbyid.php?keyword=SONE-001",
  },
  avbase: {
    id: "avbase",
    seeds: ["https://www.avbase.net", "https://avbase.net"],
    normalize: normalizeOrigin,
    sameFamily: (h) => /avbase/i.test(h),
    looksLike: (html) =>
      defaultLooksLike(html) &&
      (/avbase|作品|女優|女优/i.test(html) || html.length > 8000),
    // 不稳定过盾：adaptive
    probePath: "/",
  },
  fc2_hub: {
    id: "fc2_hub",
    seeds: ["https://javten.com", "https://www.javten.com"],
    normalize: normalizeOrigin,
    sameFamily: (h) => /javten/i.test(h),
    looksLike: (html) =>
      defaultLooksLike(html) &&
      (/javten|fc2|作品|\/en\/|\/cn\//i.test(html) || html.length > 5000),
    viaFlare: true,
    // CF 后常跳 /en；探测跟用户打开路径
    probePath: "/en",
  },
  fd2ppv: {
    id: "fd2ppv",
    seeds: ["https://fd2ppv.cc", "https://www.fd2ppv.cc"],
    normalize: normalizeOrigin,
    sameFamily: (h) => /fd2ppv/i.test(h),
    looksLike: (html) =>
      defaultLooksLike(html) &&
      (/fd2ppv|fc2|ppv/i.test(html) || html.length > 3000),
    viaFlare: true,
    probePath: "/",
  },
  freejavbt: {
    id: "freejavbt",
    seeds: ["https://freejavbt.com", "https://www.freejavbt.com"],
    normalize: normalizeOrigin,
    sameFamily: (h) => /freejavbt/i.test(h),
    looksLike: (html) =>
      defaultLooksLike(html) &&
      (/freejavbt|javbt/i.test(html) || html.length > 3000),
    viaFlare: false,
    registerFlare: false,
    probePath: "/",
  },
  madou: {
    id: "madou",
    seeds: ["https://madou.club", "https://www.madou.club"],
    normalize: normalizeOrigin,
    sameFamily: (h) => /madou\.club/i.test(h),
    looksLike: (html) =>
      defaultLooksLike(html) &&
      (/madou|麻豆/i.test(html) || html.length > 3000),
    viaFlare: false,
    registerFlare: false,
    probePath: "/",
  },
  madouqu: {
    id: "madouqu",
    seeds: ["https://madouqu.com", "https://www.madouqu.com"],
    normalize: normalizeOrigin,
    sameFamily: (h) => /madouqu/i.test(h),
    looksLike: (html) =>
      defaultLooksLike(html) &&
      (/madouqu|麻豆/i.test(html) || html.length > 3000),
    // 本机/代理通常无 CF；强制 Flare 反而慢且详情常缺封面图
    viaFlare: false,
    registerFlare: false,
    probePath: "/",
  },
  xiao_huang_shu: {
    id: "xiao_huang_shu",
    seeds: ["https://xchina.co", "https://www.xchina.co"],
    normalize: normalizeOrigin,
    sameFamily: (h) => /xchina/i.test(h),
    looksLike: (html) =>
      defaultLooksLike(html) &&
      (/xchina|小黄书|写真/i.test(html) || html.length > 3000),
    // 本机/代理通常无 CF；强制 Flare 反而慢
    viaFlare: false,
    registerFlare: false,
    probePath: "/search.html",
  },
  jav321: {
    id: "jav321",
    seeds: ["https://www.jav321.com", "https://jav321.com"],
    normalize: normalizeOrigin,
    sameFamily: (h) => /jav321/i.test(h),
    looksLike: (html) =>
      defaultLooksLike(html) &&
      (/jav321|v\.php|search/i.test(html) || html.length > 2000),
    viaFlare: false,
    registerFlare: false,
    probePath: "/",
  },
  dmm: {
    id: "dmm",
    seeds: ["https://www.dmm.co.jp"],
    normalize: (raw) => {
      const o = normalizeOrigin(raw);
      // 登录域不是业务站，禁止当成镜像落地
      if (/accounts\.dmm\.co\.jp/i.test(o)) return "https://www.dmm.co.jp";
      return o || "https://www.dmm.co.jp";
    },
    sameFamily: (h) =>
      /dmm\.co\.jp/i.test(h) && !/^accounts\./i.test(h.replace(/^www\./, "")),
    looksLike: (html, finalUrl) => {
      if (/accounts\.dmm\.co\.jp/i.test(finalUrl || "")) return false;
      const head = String(html || "").slice(0, 4000);
      if (/ログイン|アカウント|DMMアカウント/i.test(head) && head.length < 15000) {
        return false;
      }
      return String(html || "").length > 1000;
    },
    viaFlare: false,
    registerFlare: false,
    probePath: "/",
  },
  mgstage: {
    id: "mgstage",
    seeds: ["https://www.mgstage.com"],
    normalize: normalizeOrigin,
    sameFamily: (h) => /mgstage/i.test(h),
    looksLike: (html) =>
      defaultLooksLike(html) &&
      (/mgstage|adc/i.test(html) || html.length > 2000),
    // 不稳定过盾：先直连/代理，遇盾再 Flare（勿锁死 viaFlare:true）
    probePath: "/",
  },
  carib: {
    id: "carib",
    seeds: ["https://www.caribbeancom.com"],
    normalize: normalizeOrigin,
    sameFamily: (h) => /caribbeancom/i.test(h),
    looksLike: (html) => html.length > 1000,
    viaFlare: false,
    registerFlare: false,
    probePath: "/",
  },
  fc2: {
    id: "fc2",
    seeds: ["https://adult.contents.fc2.com"],
    normalize: normalizeOrigin,
    sameFamily: (h) => /fc2\.com/i.test(h),
    looksLike: (html) => html.length > 1000,
    viaFlare: false,
    registerFlare: false,
    probePath: "/",
  },
  libredmm: {
    id: "libredmm",
    seeds: ["https://www.libredmm.com"],
    normalize: normalizeOrigin,
    sameFamily: (h) => /libredmm/i.test(h),
    looksLike: (html) => html.length > 400,
    viaFlare: false,
    registerFlare: false,
    probePath: "/",
  },
  airav: {
    id: "airav",
    seeds: ["https://www.airav.wiki", "https://airav.wiki"],
    normalize: normalizeOrigin,
    sameFamily: (h) => /airav\.wiki/i.test(h),
    looksLike: (html) =>
      defaultLooksLike(html) &&
      (/airav|wiki|video/i.test(html) || html.length > 2000),
    // 不稳定过盾：由 sourceId adaptive 决定
    probePath: "/",
  },
};

