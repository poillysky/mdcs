/** JavDB 图床 jdbstatic.com URL 识别（下载需 javdb 会话，当前环境不可达则跳过） */

export function isJdbstaticImageUrl(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);
    const host = hostname.toLowerCase();
    if (!host.endsWith("jdbstatic.com")) return false;
    return /\.(jpe?g|png|webp|gif|bmp|avif)(\?|$)/i.test(pathname);
  } catch {
    return false;
  }
}
