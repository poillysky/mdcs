/**
 * CDN 封面 Referer 映射。
 * MDCX 刮削阶段 avsex 设 image_download=False，后续下载走站点会话；
 * image.avsex.cc 需 Referer 为详情页/avsex.cc（非 CDN origin），否则 403。
 */
import { isJdbstaticImageUrl } from "./jdbstaticImage.js";

export function isNetcdnImageUrl(imageUrl: string): boolean {
  try {
    return /netcdn\.space/i.test(new URL(imageUrl).hostname);
  } catch {
    return false;
  }
}

export function isAvsexCdnUrl(imageUrl: string): boolean {
  try {
    const host = new URL(imageUrl).hostname.toLowerCase();
    return host === "image.avsex.cc" || host.endsWith(".image.avsex.cc");
  } catch {
    return false;
  }
}

export function isFourhoiImageUrl(imageUrl: string): boolean {
  try {
    return /fourhoi\.com/i.test(new URL(imageUrl).hostname);
  } catch {
    return false;
  }
}

export function is123AvCdnUrl(imageUrl: string): boolean {
  try {
    return /icdn\.123av\.me/i.test(new URL(imageUrl).hostname);
  } catch {
    return false;
  }
}

export function isXchinaCdnUrl(imageUrl: string): boolean {
  try {
    return /(?:^|\.)xchina\.io$/i.test(new URL(imageUrl).hostname);
  } catch {
    return false;
  }
}

export function isLulubarCdnUrl(imageUrl: string): boolean {
  try {
    return /(?:^|\.)lulubar\.co$/i.test(new URL(imageUrl).hostname);
  } catch {
    return false;
  }
}

export function resolveCoverImageReferer(
  imageUrl: string,
  ctx?: { sourceId?: string; pageUrl?: string },
): string {
  try {
    if (isNetcdnImageUrl(imageUrl)) {
      if (ctx?.pageUrl?.startsWith("http")) return ctx.pageUrl;
      return "https://avmoo.shop/";
    }
    if (isAvsexCdnUrl(imageUrl)) {
      if (ctx?.pageUrl?.startsWith("http")) return ctx.pageUrl;
      return "https://avsex.cc/";
    }
    if (isJdbstaticImageUrl(imageUrl)) {
      return "https://javdb.com/";
    }
    if (isFourhoiImageUrl(imageUrl) || ctx?.sourceId === "miss_av") {
      if (ctx?.pageUrl?.startsWith("http")) return ctx.pageUrl;
      return "https://missav123.com/";
    }
    if (is123AvCdnUrl(imageUrl) || ctx?.sourceId === "njav") {
      if (ctx?.pageUrl?.startsWith("http")) return ctx.pageUrl;
      return "https://123av.com/ja/";
    }
    if (isXchinaCdnUrl(imageUrl) || ctx?.sourceId === "xiao_huang_shu") {
      if (ctx?.pageUrl?.startsWith("http")) return ctx.pageUrl;
      return "https://xchina.co/";
    }
    if (isLulubarCdnUrl(imageUrl) || ctx?.sourceId === "lulubar") {
      if (ctx?.pageUrl?.startsWith("http")) return ctx.pageUrl;
      return "https://lulubar.co/";
    }
  } catch {
    /* ignore */
  }
  try {
    return `${new URL(imageUrl).origin}/`;
  } catch {
    return "";
  }
}
